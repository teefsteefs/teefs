import path from 'node:path';
import config from '../config.js';
import { createLogger } from '../util/logger.js';
import { readJsonSafe, atomicWriteJson, createDebouncedSaver } from '../util/persist.js';

const log = createLogger('sessions');

/**
 * Conversation store, one entry per browser session.
 * History is a flat list of { role: 'user' | 'assistant', text } turns —
 * enough context for follow-up questions without replaying tool traffic.
 *
 * When `persistPath` is set, sessions survive server restarts: they are
 * loaded on boot and saved (debounced, atomically) on every change.
 */
export class SessionStore {
  constructor({
    ttlMs = config.sessionTtlMs,
    maxTurns = config.maxHistoryTurns,
    sweepMs = 10 * 60_000,
    persistPath = null,
  } = {}) {
    this.ttlMs = ttlMs;
    this.maxTurns = maxTurns;
    this.persistPath = persistPath;
    this.sessions = new Map();
    this.saver = createDebouncedSaver(() => this.#save());
    this.#load();
    this.sweeper = setInterval(() => this.sweep(), sweepMs);
    if (this.sweeper.unref) this.sweeper.unref();
  }

  #load() {
    if (!this.persistPath) return;
    const raw = readJsonSafe(this.persistPath);
    if (!raw?.sessions) return;
    const now = Date.now();
    let restored = 0;
    for (const [id, s] of Object.entries(raw.sessions)) {
      if (!Array.isArray(s?.history)) continue;
      if (now - (s.updatedAt || 0) > this.ttlMs) continue; // expired while offline
      this.sessions.set(id, {
        id,
        history: s.history
          .filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.text === 'string')
          .slice(-this.maxTurns * 2),
        updatedAt: s.updatedAt || now,
      });
      restored++;
    }
    if (restored) log.info(`restored ${restored} session(s) from disk`);
  }

  #save() {
    if (!this.persistPath) return;
    const out = {};
    for (const [id, s] of this.sessions) out[id] = { history: s.history, updatedAt: s.updatedAt };
    atomicWriteJson(this.persistPath, { sessions: out });
  }

  get(id) {
    const key = String(id || 'default').slice(0, 128);
    let s = this.sessions.get(key);
    if (!s) {
      s = { id: key, history: [], updatedAt: Date.now() };
      this.sessions.set(key, s);
    }
    return s;
  }

  append(id, role, text) {
    const s = this.get(id);
    s.history.push({ role, text: String(text).slice(0, 8000) });
    // Keep the last N user+assistant pairs.
    const maxEntries = this.maxTurns * 2;
    if (s.history.length > maxEntries) s.history = s.history.slice(-maxEntries);
    s.updatedAt = Date.now();
    this.saver.schedule();
  }

  sweep(now = Date.now()) {
    let removed = 0;
    for (const [key, s] of this.sessions) {
      if (now - s.updatedAt > this.ttlMs) {
        this.sessions.delete(key);
        removed++;
      }
    }
    if (removed) this.saver.schedule();
  }

  close() {
    clearInterval(this.sweeper);
    this.saver.flushNow();
  }
}

export const sessionStore = new SessionStore({
  persistPath: path.join(config.dataDir, 'sessions.json'),
});
