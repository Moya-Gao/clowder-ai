/**
 * opencode Config Template Generator
 * Generates opencode.json configuration for Cat Cafe runtime.
 *
 * opencode reads its config from opencode.json (per-project or ~/.config/opencode/).
 * This generator produces a config with:
 * - Anthropic provider (via proxy)
 * - Optional OMOC plugin (oh-my-opencode)
 * - No Cat Cafe MCP tools (isolation by design)
 */

interface OpenCodeConfigOptions {
  /** Anthropic API key — validated but NOT written to config (stays in ANTHROPIC_API_KEY env var) */
  apiKey: string;
  /** Base URL for Anthropic API (auto-normalized: /v1 appended if missing) */
  baseUrl: string;
  /** Model name (e.g. 'claude-sonnet-4-6') */
  model: string;
  /** Enable Oh My OpenCode plugin (default: true) */
  enableOmoc?: boolean;
}

interface OpenCodeConfig {
  $schema: string;
  model: string;
  provider: {
    anthropic: {
      options: {
        baseURL: string;
      };
    };
  };
  plugin?: string[];
  mcp?: Record<string, unknown>;
}

export function generateOpenCodeConfig(options: OpenCodeConfigOptions): OpenCodeConfig {
  const { baseUrl, model, enableOmoc = true } = options;

  const modelStr = model.includes('/') ? model : `anthropic/${model}`;

  // Normalize baseUrl: opencode's SDK calls {baseURL}/messages (not /v1/messages),
  // so proxy URLs need /v1 appended. Same logic as OpenCodeAgentService.buildEnv().
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const needsV1 = !trimmed.endsWith('/v1');
  const normalizedBaseUrl = needsV1 ? `${trimmed}/v1` : baseUrl;

  const config: OpenCodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    model: modelStr,
    provider: {
      anthropic: {
        options: {
          baseURL: normalizedBaseUrl,
        },
      },
    },
  };

  if (enableOmoc) {
    config.plugin = ['oh-my-opencode'];
  }

  return config;
}
