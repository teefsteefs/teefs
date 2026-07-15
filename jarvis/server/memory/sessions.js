import config from '../config.js';

/**
 * In-memory conversation store, one entry per browser session.
 * History is a flat list of { role: 'user' | 'assistant', text } turns —
 * enough context for follow-up questions without replaying tool traffic.
 */
export class SessionStore {
  constructor({ ttlMs = config.sessionTtlMs, maxTurns = config.maxHistoryTurns, sweepMs = 10 * 60_000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxTurns = maxTurns;
    this.sessions = new Map();
    this.sweeper = setInterval(() => this.sweep(), sweepMs);
    if (this.sweeper.unref) this.sweeper.unref();
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
  }

  sweep(now = Date.now()) {
    for (const [key, s] of this.sessions) {
      if (now - s.updatedAt > this.ttlMs) this.sessions.delete(key);
    }
  }

  close() {
    clearInterval(this.sweeper);
  }
}

export const sessionStore = new SessionStore();
