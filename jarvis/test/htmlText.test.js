import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, stripTags, extractMainText, extractTitle } from '../server/util/htmlText.js';

test('decodeEntities: named, decimal, hex', () => {
  assert.equal(decodeEntities('a &amp; b &lt;c&gt;'), 'a & b <c>');
  assert.equal(decodeEntities('s&#225;ng'), 'sáng');
  assert.equal(decodeEntities('&#x1EA1;'), 'ạ');
  assert.equal(decodeEntities('50&nbsp;km'), '50 km');
});

test('stripTags removes scripts/styles and collapses whitespace', () => {
  const html = '<p>Hello</p><script>alert("x")</script><style>.a{}</style>  <b>world</b>';
  assert.equal(stripTags(html), 'Hello world');
});

test('extractMainText prefers <article>', () => {
  const html = `
    <html><body>
      <nav>MENU MENU MENU</nav>
      <article>${'Nội dung chính của bài viết. '.repeat(30)}</article>
      <footer>chân trang</footer>
    </body></html>`;
  const text = extractMainText(html);
  assert.match(text, /Nội dung chính/);
  assert.ok(!text.includes('MENU'));
  assert.ok(!text.includes('chân trang'));
});

test('extractMainText strips chrome when no article', () => {
  const html = '<body><nav>menu here</nav><div>Phần thân trang web.</div><footer>foot</footer></body>';
  const text = extractMainText(html);
  assert.match(text, /Phần thân/);
  assert.ok(!text.includes('menu here'));
});

test('extractMainText caps length', () => {
  const html = `<article>${'x'.repeat(20000)}</article>`;
  assert.ok(extractMainText(html, 100).length <= 101);
});

test('extractTitle', () => {
  assert.equal(extractTitle('<head><title> Trang chủ &amp; Tin tức </title></head>'), 'Trang chủ & Tin tức');
});
