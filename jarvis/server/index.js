import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { createLogger } from './util/logger.js';
import { sessionStore } from './memory/sessions.js';
import { userMemory } from './memory/userMemory.js';
import { createLlmService } from './llm/index.js';
import { createOrchestrator } from './orchestrator/index.js';
import { availableProviders } from './tools/webSearch.js';

const log = createLogger('server');
const llm = createLlmService();
const orchestrator = createOrchestrator({ llm, sessions: sessionStore });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return sendPlain(res, 400, 'Bad request');
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(config.publicDir, pathname));
  if (!filePath.startsWith(config.publicDir + path.sep) && filePath !== config.publicDir) {
    return sendPlain(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return sendPlain(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    res.end(data);
  });
}

function sendPlain(res, code, text) {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Server-Sent Events writer over a plain HTTP response. */
function createSse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(':ok\n\n');

  let open = true;
  res.on('close', () => {
    open = false;
  });
  const heartbeat = setInterval(() => {
    if (open) res.write(':hb\n\n');
  }, 15_000);

  return {
    get open() {
      return open;
    },
    send(event, data) {
      if (!open) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      clearInterval(heartbeat);
      if (open) res.end();
    },
  };
}

async function handleChat(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req, config.maxRequestBodyBytes));
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { error: 'invalid JSON body' });
  }

  const sse = createSse(res);
  const emit = (event, data) => sse.send(event, data);

  try {
    const result = await orchestrator.handleChat({
      sessionId: body.sessionId,
      message: body.message,
      context: body.context,
      emit,
    });
    sse.send('done', result);
  } catch (err) {
    log.error(`chat error: ${err.stack || err.message}`);
    sse.send('error', {
      message:
        err.statusCode === 400
          ? 'Câu lệnh trống hoặc không hợp lệ.'
          : 'Có lỗi phía máy chủ. Bạn thử lại giúp tôi nhé.',
    });
  } finally {
    sse.end();
  }
}

function handleHealth(res) {
  sendJson(res, 200, {
    ok: true,
    name: 'JARVIS Voice Assistant',
    mode: llm.enabled ? 'agent' : 'direct',
    llm: {
      configured: llm.hasCredentials,
      enabled: llm.enabled,
      provider: llm.enabled ? llm.provider : null,
      model: llm.hasCredentials ? llm.model : null,
      reason: llm.enabled ? null : llm.lastFailureReason || null,
    },
    memory: { facts: userMemory.count, sessions: sessionStore.sessions.size },
    search: { providers: availableProviders() },
    uptimeSec: Math.round(process.uptime()),
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'POST' && url.pathname === '/api/chat') return void handleChat(req, res);
  if (req.method === 'GET' && url.pathname === '/api/health') return void handleHealth(res);
  if (req.method === 'GET' || req.method === 'HEAD') return void serveStatic(req, res);

  sendPlain(res, 405, 'Method not allowed');
});

server.listen(config.port, config.host, async () => {
  log.info(`JARVIS listening on http://${config.host}:${config.port}`);
  log.info(`search chain: ${availableProviders().join(' → ')}`);
  if (llm.hasCredentials) {
    await llm.probe();
    if (llm.enabled) {
      log.info(`AGENT mode: ${llm.provider} (${llm.model}) decides when to search the web`);
    } else {
      log.warn(`running in DIRECT mode until an LLM becomes reachable — ${llm.lastFailureReason}`);
    }
  } else {
    log.info(
      'no ANTHROPIC_API_KEY / OPENAI_API_KEY — DIRECT mode: the assistant searches the web itself and answers extractively',
    );
  }
});

function shutdown(signal) {
  log.info(`${signal} received, shutting down`);
  sessionStore.close();
  userMemory.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
