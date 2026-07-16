import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserMemory, parseMemoryCommand } from '../server/memory/userMemory.js';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-mem-'));
  return path.join(dir, 'memory.json');
}

test('add, dedupe and list facts', () => {
  const mem = new UserMemory(tmpFile());
  assert.equal(mem.add('Tên tôi là Nam'), true);
  assert.equal(mem.add('tên tôi là nam'), true); // case-insensitive dup → kept once
  assert.equal(mem.count, 1);
  assert.equal(mem.add(''), false);
  mem.add('Tôi thích trả lời ngắn gọn');
  assert.deepEqual(mem.list(), ['Tên tôi là Nam', 'Tôi thích trả lời ngắn gọn']);
});

test('persists facts across instances', () => {
  const file = tmpFile();
  const a = new UserMemory(file);
  a.add('Tôi sống ở Đà Nẵng');
  a.flush();
  const b = new UserMemory(file);
  assert.deepEqual(b.list(), ['Tôi sống ở Đà Nẵng']);
});

test('clear empties memory and reports count', () => {
  const mem = new UserMemory(tmpFile());
  mem.add('a');
  mem.add('b');
  assert.equal(mem.clear(), 2);
  assert.equal(mem.count, 0);
});

test('parseMemoryCommand: Vietnamese remember forms', () => {
  assert.deepEqual(parseMemoryCommand('nhớ rằng tôi thích cà phê sữa'), {
    action: 'remember',
    fact: 'tôi thích cà phê sữa',
  });
  assert.deepEqual(parseMemoryCommand('Hãy nhớ là tôi làm ở Kaiizen.'), {
    action: 'remember',
    fact: 'tôi làm ở Kaiizen',
  });
  assert.deepEqual(parseMemoryCommand('ghi nhớ: deadline dự án là thứ Sáu'), {
    action: 'remember',
    fact: 'deadline dự án là thứ Sáu',
  });
});

test('parseMemoryCommand: English remember forms', () => {
  assert.deepEqual(parseMemoryCommand('remember that my name is Alex'), {
    action: 'remember',
    fact: 'my name is Alex',
  });
  assert.deepEqual(parseMemoryCommand('Remember I prefer short answers'), {
    action: 'remember',
    fact: 'I prefer short answers',
  });
});

test('parseMemoryCommand: forget and recall', () => {
  assert.deepEqual(parseMemoryCommand('quên hết đi'), { action: 'forget_all' });
  assert.deepEqual(parseMemoryCommand('xóa trí nhớ của bạn đi'), { action: 'forget_all' });
  assert.deepEqual(parseMemoryCommand('forget everything'), { action: 'forget_all' });
  assert.deepEqual(parseMemoryCommand('bạn đang nhớ những gì?'), { action: 'recall' });
  assert.deepEqual(parseMemoryCommand('what do you remember'), { action: 'recall' });
});

test('parseMemoryCommand: non-commands pass through', () => {
  assert.equal(parseMemoryCommand('bạn có nhớ không?'), null);
  assert.equal(parseMemoryCommand('giá bitcoin bao nhiêu'), null);
  assert.equal(parseMemoryCommand('tôi không nhớ rằng mình đã nói gì'), null);
  assert.equal(parseMemoryCommand(''), null);
});
