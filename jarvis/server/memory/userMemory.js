import path from 'node:path';
import config from '../config.js';
import { createLogger } from '../util/logger.js';
import { readJsonSafe, atomicWriteJson, createDebouncedSaver } from '../util/persist.js';

const log = createLogger('memory');

const MAX_FACTS = 200;
const MAX_FACT_CHARS = 400;

/**
 * Long-term user memory: short durable facts ("tên tôi là Nam", "tôi thích
 * trả lời ngắn gọn") persisted to disk so the assistant remembers across
 * restarts.
 *
 * Written from two places:
 *  - agent mode: the model calls the `remember` tool when the user shares
 *    something durable;
 *  - both modes: explicit commands ("nhớ rằng …", "remember that …") parsed
 *    deterministically by parseMemoryCommand below.
 */
export class UserMemory {
  constructor(file) {
    this.file = file || null;
    this.facts = [];
    this.saver = createDebouncedSaver(() => this.#save());
    this.#load();
  }

  #load() {
    if (!this.file) return;
    const raw = readJsonSafe(this.file);
    if (Array.isArray(raw?.facts)) {
      this.facts = raw.facts
        .filter((f) => typeof f?.text === 'string' && f.text.trim())
        .slice(-MAX_FACTS);
      if (this.facts.length) log.info(`loaded ${this.facts.length} remembered fact(s)`);
    }
  }

  #save() {
    if (!this.file) return;
    atomicWriteJson(this.file, { facts: this.facts });
  }

  /** @returns {boolean} true when stored (or already known) */
  add(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_FACT_CHARS);
    if (!t) return false;
    if (this.facts.some((f) => f.text.toLowerCase() === t.toLowerCase())) return true;
    this.facts.push({ text: t, at: new Date().toISOString() });
    if (this.facts.length > MAX_FACTS) this.facts = this.facts.slice(-MAX_FACTS);
    this.saver.schedule();
    return true;
  }

  list() {
    return this.facts.map((f) => f.text);
  }

  clear() {
    const n = this.facts.length;
    this.facts = [];
    this.saver.schedule();
    return n;
  }

  get count() {
    return this.facts.length;
  }

  flush() {
    this.saver.flushNow();
  }
}

export const userMemory = new UserMemory(path.join(config.dataDir, 'memory.json'));

// ---- Explicit memory commands (work in every mode, no LLM needed) ----

const REMEMBER_RES = [
  /^(?:hãy\s+|làm ơn\s+)?nhớ\s+(?:rằng|là)\s+(.+)$/i,
  /^(?:hãy\s+)?ghi nhớ\s*(?:rằng|là|:)?\s*(.+)$/i,
  /^nhớ\s*:\s*(.+)$/i,
  /^(?:please\s+)?remember\s+(?:that\s+|:\s*)?(.+)$/i,
  /^note that\s+(.+)$/i,
];

const FORGET_RE =
  /^(?:quên hết(?:\s+(?:đi|mọi thứ|những gì .*))?|xóa\s+(?:hết\s+)?(?:trí nhớ|bộ nhớ|memory)(?:\s+của bạn)?(?:\s+đi)?|forget everything|clear (?:your\s+)?memory)\s*[.!]?$/i;

const RECALL_RE =
  /^(?:bạn (?:đang |đã )?nhớ (?:những )?gì|bạn biết gì về tôi|what do you remember|what do you know about me)\s*[?.!]?$/i;

/**
 * @returns {{action:'remember',fact:string}|{action:'forget_all'}|{action:'recall'}|null}
 */
export function parseMemoryCommand(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (FORGET_RE.test(t)) return { action: 'forget_all' };
  if (RECALL_RE.test(t)) return { action: 'recall' };
  for (const re of REMEMBER_RES) {
    const m = re.exec(t);
    if (m) {
      const fact = m[1].trim().replace(/[.!]\s*$/, '');
      if (fact) return { action: 'remember', fact };
    }
  }
  return null;
}
