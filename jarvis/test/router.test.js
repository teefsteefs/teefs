import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, extractPlace } from '../server/orchestrator/router.js';
import { tryLocalSkills, tryCannedReply } from '../server/skills/local.js';
import { detectLanguage } from '../server/util/lang.js';

test('weather intent with place (vi)', () => {
  const r = classify('thời tiết ở Đà Nẵng hôm nay thế nào?');
  assert.equal(r.intent, 'weather');
  assert.equal(r.place, 'Đà Nẵng');
});

test('weather intent, place right after keyword', () => {
  const r = classify('thời tiết Hà Nội ngày mai');
  assert.equal(r.intent, 'weather');
  assert.match(r.place, /Hà Nội/);
});

test('weather intent without place', () => {
  const r = classify('hôm nay trời có mưa không');
  assert.equal(r.intent, 'weather');
  assert.equal(r.place, '');
});

test('weather intent (en)', () => {
  const r = classify('what is the weather in Tokyo');
  assert.equal(r.intent, 'weather');
  assert.equal(r.place, 'Tokyo');
});

test('news/price questions route to search', () => {
  assert.equal(classify('giá vàng hôm nay bao nhiêu').intent, 'search');
  assert.equal(classify('tin tức mới nhất về AI').intent, 'search');
  assert.equal(classify('who is the CEO of OpenAI?').intent, 'search');
});

test('short pleasantries route to smalltalk', () => {
  assert.equal(classify('ừ đúng rồi').intent, 'smalltalk');
  assert.equal(classify('ok hay đấy').intent, 'smalltalk');
});

test('local skill: time (vi + en)', () => {
  const now = new Date('2026-07-15T03:30:00Z'); // 10:30 at UTC+7
  const vi = tryLocalSkills('bây giờ là mấy giờ rồi', { lang: 'vi', timezone: 'Asia/Ho_Chi_Minh', now });
  assert.equal(vi.skill, 'time');
  assert.match(vi.answer, /10:30/);
  const en = tryLocalSkills('what time is it', { lang: 'en', timezone: 'Asia/Ho_Chi_Minh', now });
  assert.equal(en.skill, 'time');
});

test('local skill: date', () => {
  const now = new Date('2026-07-15T03:30:00Z');
  const r = tryLocalSkills('hôm nay là thứ mấy', { lang: 'vi', timezone: 'Asia/Ho_Chi_Minh', now });
  assert.equal(r.skill, 'date');
  assert.match(r.answer, /15/);
});

test('local skill: math wins over search', () => {
  const r = tryLocalSkills('125 nhân 8 bằng bao nhiêu', { lang: 'vi' });
  assert.equal(r.skill, 'math');
  assert.match(r.answer, /1[.,]000/);
});

test('local skills pass through normal questions', () => {
  assert.equal(tryLocalSkills('giá bitcoin hôm nay', { lang: 'vi' }), null);
});

test('canned replies', () => {
  assert.match(tryCannedReply('xin chào', 'vi').answer, /JARVIS/);
  assert.match(tryCannedReply('who are you', 'en').answer, /JARVIS/i);
  assert.equal(tryCannedReply('giá xăng hôm nay', 'vi'), null);
});

test('language detection', () => {
  assert.equal(detectLanguage('thời tiết hôm nay thế nào'), 'vi');
  assert.equal(detectLanguage('gia vang hom nay bao nhieu'), 'vi'); // no diacritics but vi words
  assert.equal(detectLanguage('what is the capital of France'), 'en');
});
