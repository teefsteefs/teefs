import config from '../config.js';
import { evaluateMath, formatNumber } from './mathParser.js';
import { stripDiacritics } from '../util/lang.js';

/**
 * Deterministic skills that never need the network or a model:
 * clock, calendar and arithmetic. They run first in every mode so trivial
 * questions get instant answers.
 */

const TIME_RE = /(mấy giờ|may gio|giờ là|bây giờ là mấy|gio la|what time|current time|time is it)/i;
const DATE_RE = /(hôm nay (là )?(ngày|thứ)|ngày (mấy|bao nhiêu)|thứ mấy|hom nay.*(ngay|thu)|what (day|date)|today'?s date)/i;

function fmt(now, timezone, lang, opts) {
  try {
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { timeZone: timezone, ...opts }).format(now);
  } catch {
    return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { timeZone: config.defaultTimezone, ...opts }).format(now);
  }
}

/**
 * @param {string} message
 * @param {{ timezone?: string, lang?: 'vi'|'en', now?: Date }} ctx
 * @returns {{ answer: string, skill: string } | null}
 */
export function tryLocalSkills(message, ctx = {}) {
  const lang = ctx.lang || 'vi';
  const timezone = ctx.timezone || config.defaultTimezone;
  const now = ctx.now || new Date();
  const plain = stripDiacritics(message.toLowerCase());

  const math = evaluateMath(message);
  if (math) {
    const value = formatNumber(math.value, lang);
    return {
      skill: 'math',
      answer: lang === 'vi' ? `Kết quả là ${value}.` : `The result is ${value}.`,
    };
  }

  if (TIME_RE.test(message) || /(may gio|gio roi)/.test(plain)) {
    const time = fmt(now, timezone, lang, { hour: '2-digit', minute: '2-digit' });
    const day = fmt(now, timezone, lang, { weekday: 'long', day: 'numeric', month: 'long' });
    return {
      skill: 'time',
      answer: lang === 'vi' ? `Bây giờ là ${time}, ${day}.` : `It is ${time}, ${day}.`,
    };
  }

  if (DATE_RE.test(message) || /(hom nay .*(ngay|thu) (may|bao nhieu))/.test(plain)) {
    const date = fmt(now, timezone, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return {
      skill: 'date',
      answer: lang === 'vi' ? `Hôm nay là ${date}.` : `Today is ${date}.`,
    };
  }

  return null;
}

/**
 * Canned personality replies — used only in direct mode (without Claude,
 * small talk would otherwise be sent to a search engine).
 */
const CANNED = [
  {
    re: /^(xin chào|chào( bạn| jarvis)?|hello|hi|hey)[!. ]*$/i,
    vi: 'Xin chào! Tôi là JARVIS, trợ lý ảo của bạn. Bạn cần tôi giúp gì?',
    en: "Hello! I'm JARVIS, your virtual assistant. How can I help?",
  },
  {
    re: /(bạn là ai|bạn tên gì|who are you|what are you|your name)/i,
    vi: 'Tôi là JARVIS — trợ lý giọng nói có khả năng tự tìm kiếm thông tin trên web khi cần. Cứ hỏi, tôi sẽ tra cứu cho bạn.',
    en: "I'm JARVIS — a voice assistant that searches the web on its own when needed. Ask away.",
  },
  {
    re: /(bạn khỏe không|khỏe không|how are you)/i,
    vi: 'Mọi hệ thống hoạt động bình thường. Tôi sẵn sàng nhận lệnh.',
    en: 'All systems operational. Ready for your command.',
  },
  {
    re: /(cảm ơn|cám ơn|thank)/i,
    vi: 'Rất hân hạnh được phục vụ.',
    en: 'My pleasure.',
  },
  {
    re: /(tạm biệt|ngủ ngon|bye|good ?night)/i,
    vi: 'Tạm biệt. Gọi "Jarvis" khi bạn cần tôi.',
    en: 'Goodbye. Say "Jarvis" whenever you need me.',
  },
  {
    re: /(bạn làm được (những )?gì|giúp được gì|what can you do|help me)/i,
    vi: 'Tôi trả lời câu hỏi bằng giọng nói, tự tìm kiếm web khi câu hỏi cần thông tin mới, xem thời tiết, tính toán và xem giờ. Ví dụ: "thời tiết Đà Nẵng", "giá vàng hôm nay", "125 nhân 8".',
    en: 'I answer by voice, search the web automatically when a question needs fresh information, check weather, do math and tell time. Try: "weather in Hanoi", "gold price today", "125 times 8".',
  },
];

export function tryCannedReply(message, lang = 'vi') {
  const m = message.trim();
  for (const c of CANNED) {
    if (c.re.test(m)) return { skill: 'smalltalk', answer: lang === 'vi' ? c.vi : c.en };
  }
  return null;
}
