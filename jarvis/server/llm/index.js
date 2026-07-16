import config from '../config.js';
import { createLogger } from '../util/logger.js';
import { createClaudeService } from './claudeAgent.js';
import { createOpenAiService } from './openaiAgent.js';

const log = createLogger('llm');

/**
 * Provider order, driven by configuration:
 *  - LLM_PROVIDER=claude|openai forces one backend;
 *  - LLM_PROVIDER=none disables agent mode entirely;
 *  - auto (default): every backend with credentials, Claude first.
 *
 * Pure function — unit-tested separately from the singletons.
 */
export function pickProviderOrder(cfg = config) {
  switch (cfg.llmProvider) {
    case 'claude':
    case 'anthropic':
      return ['claude'];
    case 'openai':
      return ['openai'];
    case 'none':
      return [];
    default: {
      const order = [];
      if (cfg.anthropicApiKey || cfg.anthropicAuthToken) order.push('claude');
      if (cfg.openaiApiKey) order.push('openai');
      return order;
    }
  }
}

/**
 * Unified agent-mode service. The orchestrator talks to this and never
 * cares which vendor is behind it. If the active backend goes down
 * mid-flight, the other configured backend takes over automatically;
 * with none usable the orchestrator falls back to direct mode.
 */
export function createLlmService(cfg = config) {
  const factories = { claude: createClaudeService, openai: createOpenAiService };
  const services = pickProviderOrder(cfg)
    .map((name) => factories[name])
    .filter(Boolean)
    .map((make) => make());

  let active = services[0] || null;

  function currentlyUsable() {
    if (active?.isAvailable()) return active;
    const alternative = services.find((s) => s !== active && s.isAvailable());
    if (alternative) {
      log.warn(`switching agent backend ${active?.provider || 'none'} → ${alternative.provider}`);
      active = alternative;
      return active;
    }
    return null;
  }

  return {
    get hasCredentials() {
      return services.length > 0;
    },
    get enabled() {
      return Boolean(active?.enabled);
    },
    get provider() {
      return active?.provider || null;
    },
    get model() {
      return active?.model || null;
    },
    get lastFailureReason() {
      if (!services.length) return 'no LLM credentials configured';
      return active?.lastFailureReason || '';
    },
    async probe() {
      for (const service of services) {
        if (await service.probe()) {
          active = service;
          return true;
        }
      }
      active = services[0] || null;
      return false;
    },
    isAvailable() {
      return Boolean(currentlyUsable());
    },
    ask(args) {
      const service = currentlyUsable();
      if (!service) throw new Error('no agent backend available');
      return service.ask(args);
    },
  };
}
