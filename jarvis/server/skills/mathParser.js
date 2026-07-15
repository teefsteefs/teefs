/**
 * Safe arithmetic evaluator (no eval, no Function). Handles Vietnamese and
 * English spoken math: "12 nhân 5", "5% của 200", "căn bậc hai của 144",
 * decimal commas ("3,5") and Vietnamese thousand dots ("1.000.000").
 */

/**
 * Word-boundary helper that works with Vietnamese: JS `\b` is ASCII-only,
 * so patterns ending in a diacritic letter ("trừ", "mũ") never match with
 * it. Use Unicode-letter lookarounds instead.
 */
const W = (alternatives) =>
  new RegExp(`(?<![\\p{L}\\d])(?:${alternatives})(?![\\p{L}\\d])`, 'giu');

const WORD_OPS = [
  [W('cộng với|cộng|plus'), ' + '],
  [W('trừ đi|trừ|minus'), ' - '],
  [W('nhân với|nhân|times|multiplied by'), ' * '],
  [W('chia cho|chia|divided by|over'), ' / '],
  [W('lũy thừa|mũ|to the power of|power'), ' ^ '],
  [W('căn bậc hai của|căn bậc hai|căn của|căn|square root of|sqrt'), ' sqrt '],
];

const FILLER = [
  W('tính giúp( tôi| mình)?'), W('tính( hộ| dùm)?( tôi| mình)?'),
  W('kết quả( của)?( phép tính)?'), W('phép tính'),
  W('bằng bao nhiêu'), W('bằng mấy'), W('là bao nhiêu'), W('bao nhiêu'), W('bằng'),
  W("what is|what's|calculate|compute|equals?|how much is"),
  /[?=]/g,
];

/** Normalize number formats: 1.000.000 → 1000000, 3,5 → 3.5 */
export function normalizeNumbers(text) {
  let t = text;
  // Vietnamese thousands separators: digits grouped by dots.
  t = t.replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, (m) => m.replace(/\./g, ''));
  // Decimal comma → decimal dot (only between digits).
  t = t.replace(/(\d),(\d)/g, '$1.$2');
  return t;
}

function normalize(text) {
  let t = ` ${text.toLowerCase()} `;
  t = normalizeNumbers(t);
  for (const f of FILLER) t = t.replace(f, ' ');
  // "5% của 200" / "5% of 200" → (5 / 100) * 200
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:%|phần trăm|percent)\s*(?:của|of)\s*/gi, '($1/100)*');
  t = t.replace(/phần trăm|percent/gi, '%');
  for (const [re, op] of WORD_OPS) t = t.replace(re, op);
  t = t.replace(/[x×]/gi, '*').replace(/[÷:]/g, '/').replace(/,/g, ' ');
  return t.trim();
}

// ---- Tokenizer + recursive-descent parser ----

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < input.length && /[\d.]/.test(input[j])) j++;
      const num = Number(input.slice(i, j));
      if (!Number.isFinite(num)) return null;
      tokens.push({ type: 'num', value: num });
      i = j;
      continue;
    }
    if ('+-*/^%()'.includes(c)) { tokens.push({ type: c }); i++; continue; }
    if (input.startsWith('sqrt', i)) { tokens.push({ type: 'sqrt' }); i += 4; continue; }
    return null; // unknown token → not a math expression
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() { // + -
    let left = parseTerm();
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = next().type;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() { // * / %
    let left = parseFactor();
    while (peek() && (peek().type === '*' || peek().type === '/' || peek().type === '%')) {
      const op = next().type;
      const right = parseFactor();
      if (op === '*') left *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('division by zero');
        left /= right;
      } else left %= right;
    }
    return left;
  }

  function parseFactor() { // ^ (right-assoc)
    const base = parseUnary();
    if (peek() && peek().type === '^') {
      next();
      return base ** parseFactor();
    }
    return base;
  }

  function parseUnary() {
    if (peek() && peek().type === '-') { next(); return -parseUnary(); }
    if (peek() && peek().type === '+') { next(); return parseUnary(); }
    if (peek() && peek().type === 'sqrt') {
      next();
      const v = parseUnary();
      if (v < 0) throw new Error('sqrt of negative');
      return Math.sqrt(v);
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error('unexpected end');
    if (t.type === 'num') return t.value;
    if (t.type === '(') {
      const v = parseExpr();
      if (!peek() || next().type !== ')') throw new Error('missing )');
      return v;
    }
    throw new Error(`unexpected token ${t.type}`);
  }

  const value = parseExpr();
  if (pos !== tokens.length) throw new Error('trailing tokens');
  return value;
}

/**
 * @returns {{ value: number, expression: string } | null}
 * null when the text is not a pure arithmetic question.
 */
export function evaluateMath(text) {
  if (!text || !/\d/.test(text)) return null;
  const expr = normalize(text);
  // After normalization only math characters may remain — this is what
  // prevents "iphone 15 giá bao nhiêu" from being treated as arithmetic.
  if (!/^[\d\s+\-*/^%().]*$/.test(expr.replace(/sqrt/g, ' '))) return null;
  // Require an actual operation (or sqrt) — a bare number is not a question.
  if (!/[+\-*/^%]/.test(expr) && !expr.includes('sqrt')) return null;

  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return null;
  try {
    const value = parse(tokens);
    if (!Number.isFinite(value)) return null;
    return { value, expression: expr.replace(/\s+/g, ' ').trim() };
  } catch {
    return null;
  }
}

export function formatNumber(value, lang = 'vi') {
  const rounded = Math.round(value * 1e6) / 1e6;
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 6,
  }).format(rounded);
}
