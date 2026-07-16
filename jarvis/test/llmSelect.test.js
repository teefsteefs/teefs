import test from 'node:test';
import assert from 'node:assert/strict';
import { pickProviderOrder } from '../server/llm/index.js';

const base = { llmProvider: 'auto', anthropicApiKey: '', anthropicAuthToken: '', openaiApiKey: '' };

test('auto: no keys → no agent backends (direct mode)', () => {
  assert.deepEqual(pickProviderOrder(base), []);
});

test('auto: only OpenAI key → openai', () => {
  assert.deepEqual(pickProviderOrder({ ...base, openaiApiKey: 'sk-x' }), ['openai']);
});

test('auto: only Anthropic key → claude', () => {
  assert.deepEqual(pickProviderOrder({ ...base, anthropicApiKey: 'sk-ant-x' }), ['claude']);
});

test('auto: both keys → claude first, openai fallback', () => {
  assert.deepEqual(pickProviderOrder({ ...base, anthropicApiKey: 'a', openaiApiKey: 'b' }), [
    'claude',
    'openai',
  ]);
});

test('forced provider wins over auto ordering', () => {
  assert.deepEqual(
    pickProviderOrder({ ...base, llmProvider: 'openai', anthropicApiKey: 'a', openaiApiKey: 'b' }),
    ['openai'],
  );
  assert.deepEqual(pickProviderOrder({ ...base, llmProvider: 'claude', openaiApiKey: 'b' }), ['claude']);
  assert.deepEqual(pickProviderOrder({ ...base, llmProvider: 'none', openaiApiKey: 'b' }), []);
});
