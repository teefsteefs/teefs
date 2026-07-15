import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionStore } from '../server/memory/sessions.js';

test('history trimming keeps the most recent turns', () => {
  const store = new SessionStore({ maxTurns: 3, ttlMs: 1000 });
  for (let i = 0; i < 10; i++) {
    store.append('s1', 'user', `q${i}`);
    store.append('s1', 'assistant', `a${i}`);
  }
  const s = store.get('s1');
  assert.equal(s.history.length, 6); // 3 turns × 2 entries
  assert.equal(s.history[0].text, 'q7');
  assert.equal(s.history.at(-1).text, 'a9');
  store.close();
});

test('sweep removes idle sessions', () => {
  const store = new SessionStore({ ttlMs: 50 });
  store.append('old', 'user', 'hi');
  store.get('old').updatedAt = Date.now() - 1000;
  store.append('fresh', 'user', 'hello');
  store.sweep();
  assert.equal(store.sessions.has('old'), false);
  assert.equal(store.sessions.has('fresh'), true);
  store.close();
});

test('sessions are isolated', () => {
  const store = new SessionStore({});
  store.append('a', 'user', 'x');
  assert.equal(store.get('b').history.length, 0);
  store.close();
});
