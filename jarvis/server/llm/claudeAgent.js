import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import config from '../config.js';
import { createLogger } from '../util/logger.js';
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  buildToolSpecs,
  createAvailabilityState,
  fallbackEmptyAnswer,
} from './agentCore.js';

const log = createLogger('claude');

/**
 * Claude backend for agent mode, driven by the official Anthropic SDK's
 * tool runner. The model decides ON ITS OWN whether a question needs a web
 * search, a page read, weather data, a memory write — or no tool at all.
 */
export function createClaudeService() {
  const hasCredentials = Boolean(config.anthropicApiKey || config.anthropicAuthToken);
  const state = createAvailabilityState();
  let client = null;

  if (hasCredentials) {
    client = new Anthropic({
      apiKey: config.anthropicApiKey || undefined,
      authToken: config.anthropicAuthToken || undefined,
      timeout: 120_000,
      maxRetries: 1,
    });
  }

  async function probe() {
    if (!client) return false;
    try {
      await client.models.retrieve(config.claudeModel);
      state.up();
      log.info(`ready (model ${config.claudeModel}, effort ${config.claudeEffort})`);
      return true;
    } catch (err) {
      state.down(err);
      log.warn(`unavailable: ${state.reason}`);
      return false;
    }
  }

  /**
   * Run one voice command through the agent.
   * Streams text deltas through emit('delta', {text}) as they are generated.
   *
   * @returns {Promise<{ answer, sources, finalText }>}
   */
  async function ask({ history, message, ctx, emit }) {
    if (!client) throw new Error('Claude client not configured');

    const sources = [];
    const lang = ctx.lang || 'vi';
    const tools = buildToolSpecs({ emit, sources, lang }).map((s) =>
      betaTool({ name: s.name, description: s.description, inputSchema: s.parameters, run: s.run }),
    );

    const messages = [
      ...history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: `${buildContextBlock(ctx)}\n${message}` },
    ];

    const runner = client.beta.messages.toolRunner({
      model: config.claudeModel,
      max_tokens: config.claudeMaxTokens,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { effort: config.claudeEffort },
      tools,
      messages,
      max_iterations: config.maxAgentIterations,
      stream: true,
    });

    let lastMessage = null;
    let streamedText = '';

    try {
      for await (const messageStream of runner) {
        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            streamedText += event.delta.text;
            emit('delta', { text: event.delta.text });
          }
        }
        const msg = await messageStream.finalMessage();
        lastMessage = msg;
        // Server-side pause (defensive — only relevant if server tools are
        // ever added): resume by pushing the paused assistant turn back.
        if (msg.stop_reason === 'pause_turn') {
          runner.pushMessages({ role: 'assistant', content: msg.content });
        }
        // Visual separation between "let me check..." and the final answer.
        if (msg.stop_reason === 'tool_use' && streamedText && !streamedText.endsWith('\n')) {
          streamedText += '\n';
          emit('delta', { text: '\n' });
        }
      }
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError ||
        err instanceof Anthropic.APIConnectionError
      ) {
        state.down(err);
      }
      throw err;
    }

    const finalText = (lastMessage?.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (lastMessage?.stop_reason === 'refusal') log.warn('model refused the request');
    if (lastMessage?.stop_reason === 'max_tokens') log.warn('answer hit max_tokens cap');

    const answer = (streamedText.trim() || finalText) || fallbackEmptyAnswer(lang);
    return { answer, sources, finalText: finalText || answer };
  }

  return {
    provider: 'claude',
    get enabled() {
      return state.enabled;
    },
    get model() {
      return config.claudeModel;
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
