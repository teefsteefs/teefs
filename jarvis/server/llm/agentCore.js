import config from '../config.js';
import { webSearch } from '../tools/webSearch.js';
import { readPage } from '../tools/readPage.js';
import { getWeather } from '../tools/weather.js';
import { userMemory } from '../memory/userMemory.js';

/**
 * Provider-agnostic core of agent mode: the persona, the dynamic context
 * block and the tool specifications. claudeAgent.js and openaiAgent.js both
 * consume this, each mapping the specs onto its own SDK's native tool
 * format — same brain, two backends.
 */

export const SYSTEM_PROMPT = `You are JARVIS, a voice-first AI assistant inspired by Iron Man's butler AI: composed, precise, quietly witty and unfailingly helpful. The user talks to you by voice and hears your answers read aloud by a speech synthesizer.

Language:
- Always reply in the language the user used. Vietnamese questions get Vietnamese answers; English questions get English answers.

Voice output rules (strict):
- Plain prose only. Never use markdown, bullet points, headings, tables, emoji, or code blocks.
- Never read URLs aloud and never include raw URLs in your prose; the app shows your sources on screen separately. Refer to sources by name, e.g. "Theo VnExpress" or "According to Reuters".
- Be concise: two to four short sentences for typical questions. Expand only when the user explicitly asks for detail.
- Round numbers sensibly for speech.

Deciding when to use tools:
- Easy questions you are confident about (definitions, general knowledge, translations, advice, conversions you can compute) — answer directly, no tools.
- Anything involving current or time-sensitive information (news, prices, exchange rates, sports results, schedules, product releases, people in the news), niche or local facts, or anything after your knowledge cutoff — call web_search FIRST, silently, then answer from the results.
- If search snippets are too thin to answer reliably, call read_page on the most promising result.
- For weather questions, call get_weather with the place name.
- When unsure whether your knowledge is current, prefer searching over guessing. Never invent prices, dates, scores or news.
- After using web results, weave the source name into the answer naturally.

Long-term memory:
- The <context> block may contain user_memory: durable facts remembered from earlier conversations. Use them naturally (name, preferences, ongoing projects) without reciting the list.
- When the user shares a durable fact about themselves or their preferences, or explicitly asks you to remember something, call the remember tool with ONE short factual sentence, then acknowledge briefly.
- Do not store one-off request details, trivia, or anything sensitive like passwords.

Honesty:
- If a tool fails or the network is down, say so plainly and give your best offline answer with an explicit caveat.
- Never claim you searched when you did not.

Each user message begins with an auto-generated <context> block (current date/time, timezone, locale, remembered facts). Use it silently and never mention the block itself.`;

export function buildContextBlock(ctx) {
  const tz = ctx.timezone || config.defaultTimezone;
  let now;
  try {
    now = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
  } catch {
    now = new Date().toISOString();
  }
  const facts = userMemory.list();
  const memory = facts.length
    ? `; user_memory: ${facts.slice(-25).join(' | ')}`.slice(0, 1400)
    : '';
  return `<context>now: ${now} (${tz}); locale: ${ctx.locale || 'vi-VN'}${memory}</context>`;
}

/**
 * Tool specifications shared by every provider.
 * Each spec: { name, description, parameters (JSON Schema), run(input) → string }.
 *
 * @param {{ emit: Function, sources: Array, lang: 'vi'|'en' }} reqCtx per-request state
 */
export function buildToolSpecs({ emit, sources, lang }) {
  const remember = (items) => {
    for (const s of items) {
      if (s?.url && !sources.some((x) => x.url === s.url)) {
        sources.push({ title: s.title || s.url, url: s.url });
      }
    }
  };

  return [
    {
      name: 'web_search',
      description:
        'Search the public web. Call this whenever the answer depends on current, recent, local or niche information (news, prices, weather beyond forecasts, releases, schedules, specific people or businesses), or whenever you are not fully confident your knowledge is up to date. Do NOT call it for math, small talk, or stable general knowledge. Returns a JSON list of {title, url, snippet}.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query, in the same language as the user question when that helps (Vietnamese queries for Vietnamese local topics).',
          },
        },
        required: ['query'],
      },
      run: async ({ query }) => {
        emit('status', { stage: 'search', detail: query });
        try {
          const { provider, results } = await webSearch(query, { lang, count: 6 });
          remember(results.slice(0, 3));
          emit('sources', sources.slice());
          return JSON.stringify({ provider, results });
        } catch (err) {
          return JSON.stringify({ error: `search failed: ${err.message}` });
        }
      },
    },

    {
      name: 'read_page',
      description:
        'Fetch the readable text of one web page, typically a URL taken from web_search results, when snippets alone are not enough to answer reliably. Returns JSON {url, title, text}.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http(s) URL to read.' },
        },
        required: ['url'],
      },
      run: async ({ url }) => {
        let host = url;
        try {
          host = new URL(url).hostname;
        } catch {
          /* keep raw for the status line */
        }
        emit('status', { stage: 'read', detail: host });
        try {
          const page = await readPage(url);
          remember([{ title: page.title, url: page.url }]);
          emit('sources', sources.slice());
          return JSON.stringify(page);
        } catch (err) {
          return JSON.stringify({ error: `read_page failed: ${err.message}` });
        }
      },
    },

    {
      name: 'get_weather',
      description:
        'Get current weather and the 2-day forecast for a named place (city, district, landmark). Always use this for weather questions instead of web_search. Returns structured JSON.',
      parameters: {
        type: 'object',
        properties: {
          place: { type: 'string', description: 'Place name, e.g. "Hà Nội", "Đà Nẵng", "Tokyo".' },
        },
        required: ['place'],
      },
      run: async ({ place }) => {
        emit('status', { stage: 'weather', detail: place });
        try {
          return JSON.stringify(await getWeather(place, { lang }));
        } catch (err) {
          return JSON.stringify({ error: `get_weather failed: ${err.message}` });
        }
      },
    },

    {
      name: 'remember',
      description:
        'Save ONE durable fact about the user to long-term memory (their name, preferences, recurring context, ongoing projects), phrased as a short standalone sentence. Call it when the user shares such a fact or explicitly asks you to remember something. Never store passwords, secrets, or one-off request details.',
      parameters: {
        type: 'object',
        properties: {
          fact: { type: 'string', description: 'The fact to remember, one short sentence.' },
        },
        required: ['fact'],
      },
      run: async ({ fact }) => {
        emit('status', { stage: 'memory', detail: String(fact).slice(0, 80) });
        const saved = userMemory.add(fact);
        return JSON.stringify({ saved, totalFacts: userMemory.count });
      },
    },
  ];
}

/**
 * Shared availability state machine: providers mark themselves down on
 * auth/connection failures and self-heal after a cooldown.
 */
export function createAvailabilityState(cooldownMs = 5 * 60_000) {
  let available = false;
  let lastFailure = 0;
  let lastFailureReason = '';
  return {
    get enabled() {
      return available;
    },
    get reason() {
      return lastFailureReason;
    },
    up() {
      available = true;
      lastFailureReason = '';
    },
    down(err) {
      available = false;
      lastFailure = Date.now();
      lastFailureReason = err?.message || String(err);
    },
    usable(hasClient) {
      if (!hasClient) return false;
      if (available) return true;
      // After the cooldown, let the next request try again (self-healing).
      return Date.now() - lastFailure > cooldownMs;
    },
  };
}

export function fallbackEmptyAnswer(lang) {
  return lang === 'vi'
    ? 'Xin lỗi, tôi chưa tạo được câu trả lời. Bạn thử hỏi lại giúp tôi nhé.'
    : "Sorry, I couldn't produce an answer. Please try asking again.";
}
