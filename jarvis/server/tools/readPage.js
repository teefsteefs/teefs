import config from '../config.js';
import { fetchWithTimeout } from '../util/http.js';
import { extractMainText, extractTitle } from '../util/htmlText.js';
import { assertPublicHttpUrl } from '../util/ssrf.js';

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 8000;

/**
 * Fetch a public web page and return its readable text.
 * Used by the agent when search snippets are not enough, and guarded
 * against SSRF because the URL is untrusted.
 */
export async function readPage(rawUrl) {
  const url = await assertPublicHttpUrl(rawUrl);

  const res = await fetchWithTimeout(url, {
    timeoutMs: config.pageTimeoutMs,
    headers: { accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url.hostname}`);

  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type && !type.includes('html') && !type.includes('text/plain') && !type.includes('xml')) {
    throw new Error(`Trang không phải văn bản (${type.split(';')[0]})`);
  }

  // Bounded read — never buffer arbitrarily large responses.
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    chunks.push(value);
    if (received >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const html = Buffer.concat(chunks).toString('utf8');

  return {
    url: url.href,
    title: extractTitle(html) || url.hostname,
    text: extractMainText(html, MAX_TEXT),
  };
}
