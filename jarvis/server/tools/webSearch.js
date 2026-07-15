import config from '../config.js';
import { fetchJson, fetchText, withRetry } from '../util/http.js';
import { decodeEntities, stripTags } from '../util/htmlText.js';
import { createLogger } from '../util/logger.js';

const log = createLogger('search');

/**
 * Web search with a provider fallback chain.
 *
 * Order: paid/keyed providers first (better quality, only if configured),
 * then keyless providers so the assistant ALWAYS has a way to reach the web:
 *
 *   Brave (key) → Tavily (key) → DuckDuckGo HTML → DuckDuckGo Lite → Wikipedia
 *
 * Each provider has its own timeout; failure of one silently moves to the
 * next. Only when every provider fails does the caller see an error.
 */

// ---------- Parsers (exported for tests) ----------

/** Resolve DuckDuckGo redirect links (//duckduckgo.com/l/?uddg=...) */
export function resolveDdgUrl(href) {
  if (!href) return null;
  let url = href;
  if (url.startsWith('//')) url = `https:${url}`;
  try {
    const u = new URL(url, 'https://duckduckgo.com');
    if (u.hostname.endsWith('duckduckgo.com') && u.pathname.startsWith('/l/')) {
      const uddg = u.searchParams.get('uddg');
      return uddg ? decodeURIComponent(uddg) : null;
    }
    if (u.hostname.endsWith('duckduckgo.com')) return null; // internal/ad link
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Attribute-order-independent scan for `<a ...>text</a>` elements whose
 * class list contains `classToken`. Returns [{ href, inner }].
 */
function findAnchors(html, classToken) {
  const out = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const [, attrs, inner] = m;
    if (!attrs.includes(classToken)) continue;
    const href = hrefRe.exec(attrs)?.[1] || '';
    out.push({ href, inner });
  }
  return out;
}

export function parseDdgHtml(html) {
  const snippets = findAnchors(html, 'result__snippet').map((a) => stripTags(a.inner));
  const results = [];
  for (const a of findAnchors(html, 'result__a')) {
    const url = resolveDdgUrl(decodeEntities(a.href));
    if (!url) continue; // ads and internal links resolve to null
    const title = stripTags(a.inner);
    if (!title) continue;
    results.push({ title, url, snippet: snippets[results.length] || '' });
  }
  return results;
}

export function parseDdgLite(html) {
  const snippets = [];
  const snippetRe = /<td[^>]*class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/gi;
  let sm;
  while ((sm = snippetRe.exec(html)) !== null) snippets.push(stripTags(sm[1]));

  const results = [];
  for (const a of findAnchors(html, 'result-link')) {
    const url = resolveDdgUrl(decodeEntities(a.href));
    if (!url) continue;
    results.push({ title: stripTags(a.inner), url, snippet: snippets[results.length] || '' });
  }
  return results;
}

// ---------- Providers ----------

async function braveSearch(query, { lang, count }) {
  const u = new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q', query);
  u.searchParams.set('count', String(count));
  u.searchParams.set('search_lang', lang === 'vi' ? 'vi' : 'en');
  u.searchParams.set('country', lang === 'vi' ? 'VN' : 'US');
  const data = await fetchJson(u, {
    timeoutMs: config.searchTimeoutMs,
    headers: { 'X-Subscription-Token': config.braveApiKey },
  });
  return (data?.web?.results || []).map((r) => ({
    title: stripTags(r.title || ''),
    url: r.url,
    snippet: stripTags(r.description || ''),
  }));
}

async function tavilySearch(query, { count }) {
  const data = await fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    timeoutMs: config.searchTimeoutMs,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: config.tavilyApiKey, query, max_results: count }),
  });
  return (data?.results || []).map((r) => ({
    title: r.title || '',
    url: r.url,
    snippet: (r.content || '').slice(0, 400),
  }));
}

async function ddgHtmlSearch(query, { lang }) {
  const u = new URL('https://html.duckduckgo.com/html/');
  u.searchParams.set('q', query);
  u.searchParams.set('kl', lang === 'vi' ? 'vn-vi' : 'us-en');
  const html = await fetchText(u, { timeoutMs: config.searchTimeoutMs });
  return parseDdgHtml(html);
}

async function ddgLiteSearch(query, { lang }) {
  const u = new URL('https://lite.duckduckgo.com/lite/');
  u.searchParams.set('q', query);
  u.searchParams.set('kl', lang === 'vi' ? 'vn-vi' : 'us-en');
  const html = await fetchText(u, { timeoutMs: config.searchTimeoutMs });
  return parseDdgLite(html);
}

async function wikipediaSearch(query, { lang, count }) {
  const wiki = lang === 'vi' ? 'vi' : 'en';
  const u = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
  u.searchParams.set('action', 'opensearch');
  u.searchParams.set('search', query);
  u.searchParams.set('limit', String(Math.min(count, 3)));
  u.searchParams.set('format', 'json');
  const [, titles = [], , urls = []] = await fetchJson(u, { timeoutMs: config.searchTimeoutMs });

  const results = titles.map((title, i) => ({ title, url: urls[i], snippet: '' }));
  if (results.length > 0) {
    try {
      const summary = await fetchJson(
        `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0].replace(/ /g, '_'))}`,
        { timeoutMs: config.searchTimeoutMs },
      );
      if (summary?.extract) results[0].snippet = summary.extract.slice(0, 900);
    } catch {
      // summary is a bonus; the title list alone is still useful
    }
  }
  return results;
}

// ---------- Chain ----------

function buildChain() {
  const chain = [];
  if (config.braveApiKey) chain.push({ name: 'brave', fn: braveSearch });
  if (config.tavilyApiKey) chain.push({ name: 'tavily', fn: tavilySearch });
  chain.push({ name: 'duckduckgo', fn: ddgHtmlSearch });
  chain.push({ name: 'duckduckgo-lite', fn: ddgLiteSearch });
  chain.push({ name: 'wikipedia', fn: wikipediaSearch });
  return chain;
}

export function availableProviders() {
  return buildChain().map((p) => p.name);
}

function dedupe(results, count) {
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (!r?.url || !r?.title) continue;
    let key;
    try {
      const u = new URL(r.url);
      key = `${u.hostname}${u.pathname}`;
    } catch {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: r.title.slice(0, 300), url: r.url, snippet: (r.snippet || '').slice(0, 500) });
    if (out.length >= count) break;
  }
  return out;
}

/**
 * @param {string} query
 * @param {{ lang?: 'vi'|'en', count?: number }} opts
 * @returns {Promise<{ provider: string, results: Array<{title,url,snippet}> }>}
 * @throws when every provider in the chain failed or returned nothing
 */
export async function webSearch(query, { lang = 'vi', count = 6 } = {}) {
  const errors = [];
  for (const provider of buildChain()) {
    try {
      const results = await withRetry(() => provider.fn(query, { lang, count }), { retries: 0 });
      const clean = dedupe(results, count);
      if (clean.length > 0) {
        log.info(`"${query.slice(0, 60)}" → ${clean.length} results via ${provider.name}`);
        return { provider: provider.name, results: clean };
      }
      errors.push(`${provider.name}: no results`);
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
      log.warn(`provider ${provider.name} failed: ${err.message}`);
    }
  }
  throw new Error(`Tất cả nguồn tìm kiếm đều thất bại (${errors.join('; ')})`);
}
