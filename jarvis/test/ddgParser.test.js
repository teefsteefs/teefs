import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDdgHtml, parseDdgLite, resolveDdgUrl } from '../server/tools/webSearch.js';

const HTML_FIXTURE = `
<div class="results">
  <div class="result results_links results_links_deep web-result">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvnexpress.net%2Fgia-vang-hom-nay&amp;rut=abc123">
        Giá vàng hôm nay &#8211; VnExpress
      </a>
    </h2>
    <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvnexpress.net%2Fgia-vang-hom-nay">
      Giá vàng <b>SJC</b> tăng mạnh trong phiên s&#225;ng nay&hellip;
    </a>
  </div>
  <div class="result result--ad">
    <a rel="nofollow" class="result__a" href="https://duckduckgo.com/y.js?ad_provider=foo">Quảng cáo</a>
  </div>
  <div class="result">
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.pnj.com.vn%2Fgia-vang" class="result__a" rel="nofollow">Bảng giá vàng PNJ</a>
    <a class="result__snippet" href="#">Cập nhật bảng giá vàng PNJ mới nhất.</a>
  </div>
</div>`;

test('parseDdgHtml extracts results, decodes redirect + entities, skips ads', () => {
  const results = parseDdgHtml(HTML_FIXTURE);
  assert.equal(results.length, 2);

  assert.equal(results[0].url, 'https://vnexpress.net/gia-vang-hom-nay');
  assert.match(results[0].title, /Giá vàng hôm nay – VnExpress/);
  assert.match(results[0].snippet, /SJC tăng mạnh trong phiên sáng nay…/);

  // second anchor has href BEFORE class → attribute order must not matter
  assert.equal(results[1].url, 'https://www.pnj.com.vn/gia-vang');
});

const LITE_FIXTURE = `
<table>
  <tr><td><a rel='nofollow' href='https://en.wikipedia.org/wiki/Iron_Man' class='result-link'>Iron Man - Wikipedia</a></td></tr>
  <tr><td class='result-snippet'>Iron Man is a superhero appearing in American comic books&hellip;</td></tr>
</table>`;

test('parseDdgLite handles single-quoted attributes', () => {
  const results = parseDdgLite(LITE_FIXTURE);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://en.wikipedia.org/wiki/Iron_Man');
  assert.equal(results[0].title, 'Iron Man - Wikipedia');
  assert.match(results[0].snippet, /superhero/);
});

test('resolveDdgUrl', () => {
  assert.equal(
    resolveDdgUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa%20b&rut=x'),
    'https://example.com/a b',
  );
  assert.equal(resolveDdgUrl('https://duckduckgo.com/y.js?ad=1'), null);
  assert.equal(resolveDdgUrl('https://example.com/page'), 'https://example.com/page');
  assert.equal(resolveDdgUrl(''), null);
});
