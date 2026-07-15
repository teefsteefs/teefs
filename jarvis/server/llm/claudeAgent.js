import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import config from '../config.js';
import { createLogger } from '../util/logger.js';
import { webSearch } from '../tools/webSearch.js';
import { readPage } from '../tools/readPage.js';
import { getWeather } from '../tools/weather.js';

const log = createLogger('claude');

/**
 * Agent mode: Claude drives the conversation and decides ON ITS OWN whether
 * a question needs a web search, a page read, weather data — or no tool at
 * all. This is the "search depending on question difficulty" behavior.
 *
 * The system prompt is intentionally static (cache-friendly); all dynamic
 * context (current time, timezone, locale) travels inside the user turn.
 */
const SYSTEM_PROMPT = `You are JARVIS, a voice-first AI assistant inspired by Iron Man's butler AI: composed, precise, quietly witty and unfailingly helpful. The user talks to you by voice and hears your answers read aloud by a speech synthesizer.

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

Honesty:
- If a tool fails or the network is down, say so plainly and give your best offline answer with an explicit caveat.
- Never claim you searched when you did not.

Each user message begins with an auto-generated <context> block (current date/time, timezone, locale). Use it for anything time-related and never mention the block itself.`;

function buildContextBlock(ctx) {
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
  return `<context>now: ${now} (${tz}); locale: ${ctx.locale || 'vi-VN'}</context>`;
}

export function createClaudeService() {
  const hasCredentials = Boolean(config.anthropicApiKey || config.anthropicAuthToken);
  let client = null;
  let available = false;
  let lastFailure = 0;
  let lastFailureReason = '';
  const FAILURE_COOLDOWN_MS = 5 * 60_000;

  if (hasCredentials) {
    client = new Anthropic({
      apiKey: config.anthropicApiKey || undefined,
      authToken: config.anthropicAuthToken || undefined,
      timeout: 120_000,
      maxRetries: 1,
    });
  }

  async function probe() {
    if (!client) {
      lastFailureReason = 'no credentials configured';
      return false;
    }
    try {
      await client.models.retrieve(config.claudeModel);
      available = true;
      lastFailureReason = '';
      log.info(`agent mode ready (model ${config.claudeModel}, effort ${config.claudeEffort})`);
      return true;
    } catch (err) {
      available = false;
      lastFailure = Date.now();
      lastFailureReason = err?.message || String(err);
      log.warn(`agent mode unavailable: ${lastFailureReason}`);
      return false;
    }
  }

  function isAvailable() {
    if (!client) return false;
    if (available) return true;
    // After a cooldown, let the next request try again (self-healing).
    return Date.now() - lastFailure > FAILURE_COOLDOWN_MS;
  }

  function markFailed(err) {
    available = false;
    lastFailure = Date.now();
    lastFailureReason = err?.message || String(err);
  }

  function buildTools({ emit, sources, lang }) {
    const remember = (items) => {
      for (const s of items) {
        if (s?.url && !sources.some((x) => x.url === s.url)) {
          sources.push({ title: s.title || s.url, url: s.url });
        }
      }
    };

    return [
      betaTool({
        name: 'web_search',
        description:
          'Search the public web. Call this whenever the answer depends on current, recent, local or niche information (news, prices, weather beyond forecasts, releases, schedules, specific people or businesses), or whenever you are not fully confident your knowledge is up to date. Do NOT call it for math, small talk, or stable general knowledge. Returns a JSON list of {title, url, snippet}.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query, in the same language as the user question when that helps (Vietnamese queries for Vietnamese local topics).',
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
      }),

      betaTool({
        name: 'read_page',
        description:
          'Fetch the readable text of one web page, typically a URL taken from web_search results, when snippets alone are not enough to answer reliably. Returns JSON {url, title, text}.',
        inputSchema: {
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
          } catch { /* keep raw for the status line */ }
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
      }),

      betaTool({
        name: 'get_weather',
        description:
          'Get current weather and the 2-day forecast for a named place (city, district, landmark). Always use this for weather questions instead of web_search. Returns structured JSON.',
        inputSchema: {
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
      }),
    ];
  }

  /**
   * Run one voice command through the agent.
   * Streams text deltas through emit('delta', {text}) as they are generated.
   *
   * @returns {Promise<{ answer: string, sources: Array<{title,url}> }>}
   */
  async function ask({ history, message, ctx, emit }) {
    if (!client) throw new Error('Claude client not configured');

    const sources = [];
    const lang = ctx.lang || 'vi';
    const tools = buildTools({ emit, sources, lang });

    const messages = [
      ...history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: `${buildContextBlock(ctx)}\n${message}` },
    ];

    const runner = client.beta.messages.toolRunner({
      model: config.claudeModel,
      max_tokens: config.claudeMaxTokens,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { effort: config.claudeEffort },
      tools,
      messages,
      max_iterations: config.maxAgentIterations,
      stream: true,
    });

    let lastMessage = null;
    let streamedText = '';

    try {
      for await (const messageStream of runner) {
        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            streamedText += event.delta.text;
            emit('delta', { text: event.delta.text });
          }
        }
        const msg = await messageStream.finalMessage();
        lastMessage = msg;
        // Server-side pause (defensive — only relevant if server tools are
        // ever added): resume by pushing the paused assistant turn back.
        if (msg.stop_reason === 'pause_turn') {
          runner.pushMessages({ role: 'assistant', content: msg.content });
        }
        // Visual separation between "let me check..." and the final answer.
        if (msg.stop_reason === 'tool_use' && streamedText && !streamedText.endsWith('\n')) {
          streamedText += '\n';
          emit('delta', { text: '\n' });
        }
      }
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError ||
        err instanceof Anthropic.APIConnectionError
      ) {
        markFailed(err);
      }
      throw err;
    }

    const finalText = (lastMessage?.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (lastMessage?.stop_reason === 'refusal') {
      log.warn('model refused the request');
    }
    if (lastMessage?.stop_reason === 'max_tokens') {
      log.warn('answer hit max_tokens cap');
    }

    const answer = (streamedText.trim() || finalText) || fallbackEmptyAnswer(lang);
    return { answer, sources, finalText: finalText || answer };
  }

  return {
    get enabled() {
      return available;
    },
    get model() {
      return config.claudeModel;
    },
    get lastFailureReason() {
      return lastFailureReason;
    },
    hasCredentials,
    probe,
    isAvailable,
    ask,
  };
}

function fallbackEmptyAnswer(lang) {
  return lang === 'vi'
    ? 'Xin lỗi, tôi chưa tạo được câu trả lời. Bạn thử hỏi lại giúp tôi nhé.'
    : "Sorry, I couldn't produce an answer. Please try asking again.";
}
