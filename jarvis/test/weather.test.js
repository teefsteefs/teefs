import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherCodeText, formatWeatherAnswer } from '../server/tools/weather.js';

test('WMO code mapping', () => {
  assert.equal(weatherCodeText(0, 'vi'), 'trời quang');
  assert.equal(weatherCodeText(0, 'en'), 'clear sky');
  assert.equal(weatherCodeText(63, 'vi'), 'mưa');
  assert.equal(weatherCodeText(95, 'vi'), 'dông bão');
  assert.equal(weatherCodeText(999, 'en'), 'unknown');
});

const FIXTURE = {
  location: 'Đà Nẵng',
  region: '',
  country: 'Việt Nam',
  current: { temperature: 31.4, feelsLike: 36.2, humidity: 70, windKmh: 12, code: 2, description: 'ít mây' },
  today: { min: 26.1, max: 33.8, rainChance: 40, description: 'ít mây' },
  tomorrow: { min: 25.5, max: 33.1, rainChance: 60, description: 'mưa' },
};

test('formatWeatherAnswer (vi)', () => {
  const s = formatWeatherAnswer(FIXTURE, 'vi');
  assert.match(s, /Đà Nẵng, Việt Nam/);
  assert.match(s, /31 độ C/);
  assert.match(s, /từ 26 đến 34 độ/);
  assert.match(s, /khả năng mưa 40%/);
});

test('formatWeatherAnswer (en)', () => {
  const s = formatWeatherAnswer({ ...FIXTURE, current: { ...FIXTURE.current, description: 'partly cloudy' } }, 'en');
  assert.match(s, /Weather in Đà Nẵng/);
  assert.match(s, /31°C/);
  assert.match(s, /40% chance of rain/);
});
