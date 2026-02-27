import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatTab, SystemTab, type ConfigData, type CatConfig, type ContextBudget } from '@/components/config-viewer-tabs';

const CAT: CatConfig = {
  displayName: '布偶猫',
  provider: 'anthropic',
  model: 'claude-opus-4-5-20250214',
  mcpSupport: true,
};

const BUDGET: ContextBudget = {
  maxPromptTokens: 150000,
  maxContextTokens: 200000,
  maxMessages: 50,
  maxContentLengthPerMsg: 64000,
};

const CONFIG: ConfigData = {
  cats: { opus: CAT },
  perCatBudgets: { opus: BUDGET },
  a2a: { enabled: true, maxDepth: 2 },
  memory: { enabled: true, maxKeysPerThread: 50 },
  hindsight: { enabled: true, baseUrl: 'http://localhost:8888', sharedBank: 'cat-cafe-shared' },
  governance: { degradationEnabled: true, doneTimeoutMs: 300000, heartbeatIntervalMs: 30000 },
};

describe('CatTab', () => {
  it('renders model info and budget', () => {
    const html = renderToStaticMarkup(React.createElement(CatTab, { cat: CAT, budget: BUDGET }));
    expect(html).toContain('anthropic');
    expect(html).toContain('claude-opus');
    expect(html).toContain('150k tokens');
    expect(html).toContain('原生 (--mcp-config)');
  });

  // F041: Skills/MCP display moved to dedicated 能力看板 tab

  it('shows HTTP callback for non-MCP cats', () => {
    const codexCat = { ...CAT, mcpSupport: false };
    const html = renderToStaticMarkup(React.createElement(CatTab, { cat: codexCat, budget: BUDGET }));
    expect(html).toContain('HTTP 回调注入');
  });
});

describe('SystemTab', () => {
  it('renders A2A config', () => {
    const html = renderToStaticMarkup(React.createElement(SystemTab, { config: CONFIG }));
    expect(html).toContain('A2A');
    expect(html).toContain('2');
  });

  it('renders memory config', () => {
    const html = renderToStaticMarkup(React.createElement(SystemTab, { config: CONFIG }));
    expect(html).toContain('记忆');
    expect(html).toContain('50');
  });

  it('renders Hindsight config', () => {
    const html = renderToStaticMarkup(React.createElement(SystemTab, { config: CONFIG }));
    expect(html).toContain('Hindsight');
    expect(html).toContain('localhost:8888');
    expect(html).toContain('cat-cafe-shared');
  });

  it('renders governance config', () => {
    const html = renderToStaticMarkup(React.createElement(SystemTab, { config: CONFIG }));
    expect(html).toContain('治理');
    expect(html).toContain('300s');
    expect(html).toContain('30s');
  });

  it('renders codex-first memory engine routing and runtime controls', () => {
    const nextConfig = {
      ...CONFIG,
      hindsight: {
        ...CONFIG.hindsight,
        engine: {
          reflect: 'codex_oauth',
          retainExtraction: 'codex_oauth',
          allowNativeFallback: false,
        },
        service: {
          mode: 'storage_retrieval_only',
          requireHealthcheck: true,
          writeTimeoutMs: 8000,
          recallTimeoutMs: 8000,
        },
      },
      codexExecution: {
        model: 'gpt-5.3-codex',
        authMode: 'oauth',
        passModelArg: true,
      },
    } as unknown as ConfigData;

    const html = renderToStaticMarkup(React.createElement(SystemTab, { config: nextConfig }));
    expect(html).toContain('引擎路由');
    expect(html).toContain('codex_oauth');
    expect(html).toContain('allowNativeFallback');
    expect(html).toContain('storage_retrieval_only');
    expect(html).toContain('gpt-5.3-codex');
    expect(html).toContain('oauth');
  });
});
