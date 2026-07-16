import fs from 'node:fs';
import path from 'node:path';

/** Tiny JSON persistence helpers (atomic write, silent read). */

export function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function atomicWriteJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

/** Debounced saver — collapses bursts of writes into one disk write. */
export function createDebouncedSaver(fn, delayMs = 400) {
  let timer = null;
  const flush = () => {
    timer = null;
    try {
      fn();
    } catch {
      // persistence must never crash the assistant
    }
  };
  return {
    schedule() {
      if (timer) return;
      timer = setTimeout(flush, delayMs);
      if (timer.unref) timer.unref();
    },
    flushNow() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}
