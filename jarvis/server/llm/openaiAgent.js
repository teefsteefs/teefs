import OpenAI from 'openai';
import config from '../config.js';
import { createLogger } from '../util/logger.js';
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  buildToolSpecs,
  createAvailabilityState,
  fallbackEmptyAnswer,
} from './agentCore.js';

const log = createLogger('openai');

/**
 * OpenAI backend for agent mode — same brain (agentCore) as the Claude
 * backend, driven through the official openai SDK's Chat Completions API
 * with streaming function calling.
 *
 * Also works with OpenAI-compatible gateways via OPENAI_BASE_URL.
 */
export function createOpenAiService() {
  const hasCredentials = Boolean(config.openaiApiKey);
  const state = createAvailabilityState();
  let client = null;

  if (hasCredentials) {
    client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl || undefined,
      timeout: 120_000,
      maxRetries: 1,
    });
  }

  async function probe() {
    if (!client) return false;
    try {
      await client.models.retrieve(config.openaiModel);
      state.up();
      log.info(`ready (model ${config.openaiModel})`);
      return true;
    } catch (err) {
      // Compatible gateways often lack GET /models/{id}; trust them and let
      // the first real request decide.
      if (config.openaiBaseUrl) {
        state.up();
        log.warn(`custom base URL: model check skipped (${err.message}); assuming reachable`);
        return true;
      }
      state.down(err);
      log.warn(`unavailable: ${state.reason}`);
      return false;
    }
  }

  function noteFailure(err) {
    const status = err?.status;
    const connection = OpenAI.APIConnectionError ? err instanceof OpenAI.APIConnectionError : false;
    if (status === 401 || status === 403 || connection) state.down(err);
  }

  /**
   * One voice command through the agentic loop:
   * stream → (tool calls? run them, loop) → final text.
   *
   * @returns {Promise<{ answer, sources, finalText }>}
   */
  async function ask({ history, message, ctx, emit }) {
    if (!client) throw new Error('OpenAI client not configured');

    const sources = [];
    const lang = ctx.lang || 'vi';
    const specs = buildToolSpecs({ emit, sources, lang });
    const runByName = Object.fromEntries(specs.map((s) => [s.name, s.run]));
    const tools = specs.map((s) => ({
      type: 'function',
      function: { name: s.name, description: s.description, parameters: s.parameters },
    }));

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: `${buildContextBlock(ctx)}\n${message}` },
    ];

    let streamedText = '';
    let finalText = '';

    try {
      for (let iteration = 0; iteration < config.maxAgentIterations; iteration++) {
        const stream = await client.chat.completions.create({
          model: config.openaiModel,
          messages,
          tools,
          stream: true,
        });

        let text = '';
        const toolCalls = [];
        let finishReason = null;

        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta || {};
          if (delta.content) {
            text += delta.content;
            streamedText += delta.content;
            emit('delta', { text: delta.content });
          }
          for (const tc of delta.tool_calls || []) {
            const i = tc.index ?? 0;
            toolCalls[i] ??= { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) toolCalls[i].id = tc.id;
            if (tc.function?.name) toolCalls[i].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
          }
          if (choice.finish_reason) finishReason = choice.finish_reason;
        }

        const pendingCalls = toolCalls.filter((c) => c && c.function.name);
        if (finishReason !== 'tool_calls' || pendingCalls.length === 0) {
          finalText = text;
          break;
        }

        // Execute the requested tools, then loop with their results.
        messages.push({ role: 'assistant', content: text || null, tool_calls: pendingCalls });
        for (const call of pendingCalls) {
          let result;
          try {
            const args = JSON.parse(call.function.arguments || '{}');
            const run = runByName[call.function.name];
            result = run
              ? await run(args)
              : JSON.stringify({ error: `unknown tool ${call.function.name}` });
          } catch (err) {
            result = JSON.stringify({ error: err.message });
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: result });
        }

        // Visual separation between "let me check..." and the final answer.
        if (text && !streamedText.endsWith('\n')) {
          streamedText += '\n';
          emit('delta', { text: '\n' });
        }
      }
    } catch (err) {
      noteFailure(err);
      throw err;
    }

    const answer = (streamedText.trim() || finalText.trim()) || fallbackEmptyAnswer(lang);
    return { answer, sources, finalText: finalText.trim() || answer };
  }

  return {
    provider: 'openai',
    get enabled() {
      return state.enabled;
    },
    get model() {
      return config.openaiModel;
    },
    get lastFailureReason() {
      return state.reason;
    },
    hasCredentials,
    probe,
    isAvailable: () => state.usable(Boolean(client)),
    ask,
  };
}
