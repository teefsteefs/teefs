/** Lightweight Vietnamese/English detection for routing and TTS hints. */

const VI_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const VI_WORDS = new Set([
  'không', 'được', 'của', 'là', 'gì', 'bao', 'nhiêu', 'hôm', 'nay', 'ngày',
  'giờ', 'bây', 'cho', 'tôi', 'bạn', 'và', 'có', 'thế', 'nào', 'ở', 'tại',
  'với', 'này', 'đi', 'làm', 'sao', 'rồi', 'mấy', 'ai', 'đâu', 'khi', 'vì',
]);

export function detectLanguage(text) {
  if (!text) return 'vi';
  if (VI_DIACRITICS.test(text)) return 'vi';
  const words = text.toLowerCase().split(/[^a-zà-ỹđ]+/i).filter(Boolean);
  let viHits = 0;
  for (const w of words) if (VI_WORDS.has(w)) viHits++;
  if (viHits >= 1) return 'vi';
  // ASCII-only text with no Vietnamese markers → treat as English.
  return /^[\x00-\x7F]*$/.test(text) ? 'en' : 'vi';
}

/** Strip Vietnamese diacritics — used for keyword matching. */
export function stripDiacritics(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
