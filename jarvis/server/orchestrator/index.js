import config from '../config.js';
import { createLogger } from '../util/logger.js';
import { detectLanguage } from '../util/lang.js';
import { tryLocalSkills, tryCannedReply } from '../skills/local.js';
import { classify } from './router.js';
import { composeSearchAnswer, noInternetAnswer } from './directAnswer.js';
import { webSearch } from '../tools/webSearch.js';
import { getWeather, formatWeatherAnswer } from '../tools/weather.js';

const log = createLogger('orchestrator');

/**
 * Pipeline for every voice command:
 *
 *   1. Local skills (clock / calendar / math)      — instant, offline
 *   2. Agent mode (Claude decides its own tools)   — when credentials work
 *   3. Direct mode (heuristic router + web search) — always available
 *
 * Step 3 is a full fallback, not an error page: without any API key the
 * assistant still searches the web itself and answers extractively. If the
 * agent throws mid-request, the same command is transparently re-run in
 * direct mode.
 */
export function createOrchestrator({ claude, sessions }) {
  async function runDirect({ message, lang, emit }) {
    const canned = tryCannedReply(message, lang);
    if (canned) return { answer: canned.answer, sources: [], mode: 'direct' };

    const intent = classify(message);

    if (intent.intent === 'smalltalk') {
      return {
        answer:
          lang === 'vi'
            ? 'Tôi nghe đây. Bạn muốn hỏi gì hoặc cần tôi tra cứu gì trên mạng?'
            : "I'm listening. What would you like to know, or look up on the web?",
        sources: [],
        mode: 'direct',
      };
    }

    if (intent.intent === 'weather') {
      const place = intent.place || config.defaultCity;
      emit('status', { stage: 'weather', detail: place });
      try {
        const w = await getWeather(place, { lang });
        let answer = formatWeatherAnswer(w, lang);
        if (!intent.place) {
          answer =
            (lang === 'vi'
              ? `Bạn không nói địa điểm nên tôi lấy ${config.defaultCity}. `
              : `You didn't name a place, so I used ${config.defaultCity}. `) + answer;
        }
        return { answer, sources: [{ title: 'Open-Meteo', url: 'https://open-meteo.com/' }], mode: 'direct' };
      } catch (err) {
        log.warn(`weather failed: ${err.message}`);
        // Weather API down → degrade to a normal web search below.
      }
    }

    emit('status', { stage: 'search', detail: message });
    try {
      const search = await webSearch(message, { lang, count: 6 });
      const { answer, sources } = composeSearchAnswer(message, search, lang);
      return { answer, sources, mode: 'direct' };
    } catch (err) {
      log.error(`all search providers failed: ${err.message}`);
      return { answer: noInternetAnswer(lang), sources: [], mode: 'direct' };
    }
  }

  /**
   * @param {{ sessionId: string, message: string, context?: object, emit: Function }} req
   * @returns {Promise<{ answer, sources, mode, lang }>}
   */
  async function handleChat({ sessionId, message, context = {}, emit }) {
    const text = String(message || '').trim().slice(0, config.maxMessageChars);
    if (!text) throw Object.assign(new Error('empty message'), { statusCode: 400 });

    const lang = detectLanguage(text);
    const ctx = {
      lang,
      timezone: context.timezone || config.defaultTimezone,
      locale: context.locale || (lang === 'vi' ? 'vi-VN' : 'en-US'),
    };
    const session = sessions.get(sessionId);

    emit('status', { stage: 'routing' });

    // 1) Instant offline skills — both modes.
    const local = tryLocalSkills(text, ctx);
    if (local) {
      emit('delta', { text: local.answer });
      finishTurn(session, text, local.answer);
      return { answer: local.answer, sources: [], mode: 'local', lang };
    }

    // 2) Agent mode when Claude is reachable.
    if (claude.isAvailable()) {
      try {
        emit('status', { stage: 'thinking' });
        const { answer, sources, finalText } = await claude.ask({
          history: session.history,
          message: text,
          ctx,
          emit,
        });
        emit('sources', sources);
        finishTurn(session, text, finalText || answer);
        return { answer, sources, mode: 'agent', lang };
      } catch (err) {
        log.error(`agent failed, falling back to direct mode: ${err.message}`);
        emit('status', { stage: 'fallback' });
      }
    }

    // 3) Direct mode — keyless operation or agent failure.
    const result = await runDirect({ message: text, lang, emit });
    emit('delta', { text: result.answer });
    emit('sources', result.sources);
    finishTurn(session, text, result.answer);
    return { ...result, lang };
  }

  function finishTurn(session, userText, assistantText) {
    sessions.append(session.id, 'user', userText);
    sessions.append(session.id, 'assistant', assistantText);
  }

  return { handleChat };
}
