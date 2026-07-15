import config from '../config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function line(level, scope, args) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`${ts} ${level.toUpperCase().padEnd(5)} [${scope}]`, ...args);
}

export function createLogger(scope) {
  return {
    debug: (...args) => line('debug', scope, args),
    info: (...args) => line('info', scope, args),
    warn: (...args) => line('warn', scope, args),
    error: (...args) => line('error', scope, args),
  };
}

export default createLogger;
