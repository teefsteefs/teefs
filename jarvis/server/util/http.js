/**
 * Fetch helpers with hard timeouts and bounded retries.
 * Every outbound call in the app goes through these so a single slow
 * provider can never hang a request.
 */

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export async function fetchWithTimeout(url, { timeoutMs = 10_000, headers = {}, ...opts } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...opts,
      headers: { 'user-agent': BROWSER_UA, ...headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).hostname}`);
  return res.text();
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, {
    ...opts,
    headers: { accept: 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).hostname}`);
  return res.json();
}

/** Retry transient failures (network errors / 5xx-shaped messages) with backoff. */
export async function withRetry(fn, { retries = 1, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
