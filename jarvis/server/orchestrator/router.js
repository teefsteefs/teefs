import { stripDiacritics } from '../util/lang.js';

/**
 * Heuristic intent router for DIRECT mode (no Claude available).
 * In agent mode Claude itself decides whether a question needs the web —
 * this router is the deterministic stand-in for that judgment.
 */

const WEATHER_RE = /(thời tiết|thoi tiet|nhiệt độ|nhiet do|dự báo|du bao|có mưa|co mua|nắng không|nang khong|weather|forecast|temperature|raining|is it rainy)/i;

// "ở Hà Nội", "tại Đà Nẵng", "in Tokyo", "at London" — capture the tail.
// (^|\s) instead of \b: JS \b is ASCII-only and never matches around "ở".
const PLACE_RE = /(?:^|\s)(?:ở|tại|o|tai|in|at)\s+([^?.!,;]{2,60})/iu;

// Cheap follow-up markers so short replies stay conversational in direct mode.
const SMALLTALK_MAX_WORDS = 6;

/**
 * @returns {{ intent: 'weather'|'search'|'smalltalk', place?: string }}
 */
export function classify(message) {
  const text = message.trim();
  const plain = stripDiacritics(text.toLowerCase());

  if (WEATHER_RE.test(text) || WEATHER_RE.test(plain)) {
    return { intent: 'weather', place: extractPlace(text) };
  }

  // Bare pleasantries without a question mark or interrogative → smalltalk.
  const words = text.split(/\s+/).filter(Boolean);
  const hasQuestionWord = /(gì|sao|nào|đâu|mấy|bao nhiêu|khi nào|ai\b|\?|what|how|why|when|where|who|which)/i.test(text);
  if (words.length <= SMALLTALK_MAX_WORDS && !hasQuestionWord && !/\d/.test(text)) {
    return { intent: 'smalltalk' };
  }

  return { intent: 'search' };
}

export function extractPlace(text) {
  const m = PLACE_RE.exec(text);
  if (m) {
    return cleanPlace(m[1]);
  }
  // "thời tiết Đà Nẵng hôm nay" — words right after the weather keyword.
  const after = /(?:thời tiết|thoi tiet|weather|dự báo(?:\s+thời tiết)?|forecast)\s+(?:hôm nay\s+|ngày mai\s+|today\s+|tomorrow\s+)?([^?.!,;]{2,60})/i.exec(text);
  if (after) {
    const cleaned = cleanPlace(after[1]);
    if (cleaned) return cleaned;
  }
  return '';
}

function cleanPlace(raw) {
  let p = raw.trim();
  p = p.replace(/\b(hôm nay|ngày mai|bây giờ|lúc này|thế nào|ra sao|như thế nào|today|tomorrow|now|right now|like|going to be)\b/gi, ' ');
  p = p.replace(/\s+/g, ' ').replace(/[?.!,;]+$/, '').trim();
  // Leftover interrogatives mean we never actually had a place.
  if (!p || /^(thế nào|sao|not|the|how|what)$/i.test(p)) return '';
  return p;
}
