import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMath, normalizeNumbers } from '../server/skills/mathParser.js';

test('basic arithmetic', () => {
  assert.equal(evaluateMath('2 + 2').value, 4);
  assert.equal(evaluateMath('(3 + 4) * 2').value, 14);
  assert.equal(evaluateMath('2^10').value, 1024);
  assert.equal(evaluateMath('-5 + 3').value, -2);
  assert.equal(evaluateMath('10 % 3').value, 1);
});

test('Vietnamese spoken math', () => {
  assert.equal(evaluateMath('12 nhân 5').value, 60);
  assert.equal(evaluateMath('100 chia 8').value, 12.5);
  assert.equal(evaluateMath('7 cộng 8 bằng bao nhiêu').value, 15);
  assert.equal(evaluateMath('20 trừ 6 bằng mấy?').value, 14);
  assert.equal(evaluateMath('tính giúp tôi 125 nhân 8').value, 1000);
  assert.equal(evaluateMath('2 mũ 8').value, 256);
});

test('English spoken math', () => {
  assert.equal(evaluateMath('what is 9 times 9').value, 81);
  assert.equal(evaluateMath('calculate 144 divided by 12').value, 12);
});

test('percent of', () => {
  assert.equal(evaluateMath('5% của 200').value, 10);
  assert.equal(evaluateMath('15 percent of 80').value, 12);
});

test('square root', () => {
  assert.equal(evaluateMath('căn bậc hai của 144').value, 12);
  assert.equal(evaluateMath('sqrt 81').value, 9);
});

test('Vietnamese number formats', () => {
  assert.equal(normalizeNumbers('1.000.000'), '1000000');
  assert.equal(normalizeNumbers('3,5'), '3.5');
  assert.equal(evaluateMath('1.000 + 500').value, 1500);
  assert.equal(evaluateMath('3,5 + 1,5').value, 5);
});

test('rejects non-math questions containing digits', () => {
  assert.equal(evaluateMath('iphone 15 giá bao nhiêu'), null);
  assert.equal(evaluateMath('dân số việt nam 2024'), null);
  assert.equal(evaluateMath('kết quả trận việt nam tối qua 2 1'), null);
  assert.equal(evaluateMath('hôm nay ngày mấy'), null);
});

test('rejects bare numbers and division by zero', () => {
  assert.equal(evaluateMath('42'), null);
  assert.equal(evaluateMath('5 / 0'), null);
});
