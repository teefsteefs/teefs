import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal .env loader (no dependency). Values already present in the real
 * environment always win, so deployment platforms can override the file.
 */
function loadDotEnv(file = path.join(ROOT, '.env')) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadDotEnv();

function int(name, fallback) {
  const v = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function oneOf(name, allowed, fallback) {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

export const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),

  port: int('PORT', 3000),
  host: process.env.HOST || '0.0.0.0',
  logLevel: oneOf('LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info'),

  // LLM backends — all optional. Without credentials the assistant runs in
  // direct search mode instead of failing. With both keys set, Claude is
  // preferred and OpenAI is the automatic fallback (override: LLM_PROVIDER).
  llmProvider: oneOf('LLM_PROVIDER', ['auto', 'claude', 'anthropic', 'openai', 'none'], 'auto'),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicAuthToken: process.env.ANTHROPIC_AUTH_TOKEN || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
  claudeEffort: oneOf('CLAUDE_EFFORT', ['low', 'medium', 'high', 'xhigh', 'max'], 'medium'),
  claudeMaxTokens: int('CLAUDE_MAX_TOKENS', 8192),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
  maxAgentIterations: int('MAX_AGENT_ITERATIONS', 8),

  // Search providers — optional keys; the keyless chain always exists.
  braveApiKey: process.env.BRAVE_SEARCH_API_KEY || '',
  tavilyApiKey: process.env.TAVILY_API_KEY || '',

  searchTimeoutMs: int('SEARCH_TIMEOUT_MS', 9000),
  pageTimeoutMs: int('PAGE_TIMEOUT_MS', 10000),

  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Ho_Chi_Minh',
  defaultCity: process.env.DEFAULT_CITY || 'Hà Nội',

  sessionTtlMs: int('SESSION_TTL_MINUTES', 120) * 60_000,
  maxHistoryTurns: int('MAX_HISTORY_TURNS', 12),

  // Persistent state (session history + long-term memory) lives here.
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),

  maxRequestBodyBytes: 64 * 1024,
  maxMessageChars: 4000,
};

export default config;
