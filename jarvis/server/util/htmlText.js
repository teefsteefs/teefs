/**
 * Dependency-free HTML → text utilities used by the search result parsers
 * and the page reader.
 */

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ouml: 'ö', uuml: 'ü',
  deg: '°', middot: '·', bull: '•', laquo: '«', raquo: '»', sect: '§',
};

export function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeFromCodePoint(cp) {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

/** Remove tags, scripts and styles; collapse whitespace. */
export function stripTags(html) {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort extraction of the readable body of a web page.
 * Prefers <article>/<main>; falls back to <body> minus chrome elements.
 */
export function extractMainText(html, maxLen = 8000) {
  if (!html) return '';
  let scope = html;

  const article = /<article[\s\S]*?<\/article>/i.exec(html)?.[0];
  const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0];
  const preferred = article && article.length > 500 ? article : main && main.length > 500 ? main : null;

  if (preferred) {
    scope = preferred;
  } else {
    scope = html
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form[\s\S]*?<\/form>/gi, ' ');
  }

  const text = stripTags(scope);
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html || '');
  return m ? stripTags(m[1]).slice(0, 300) : '';
}
