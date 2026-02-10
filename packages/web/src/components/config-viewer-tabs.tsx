import React, { type ReactNode } from 'react';
import type { Capabilities, CatConfig, ConfigData, ContextBudget } from './config-viewer-types';

export type { Capabilities, CatConfig, ConfigData, ContextBudget } from './config-viewer-types';

const MCP_TOOLS = [
  { name: 'cat_speak', group: '回传' },
  { name: 'get_context', group: '回传' },
  { name: 'get_thread_messages', group: '回传' },
  { name: 'read_file', group: '文件' },
  { name: 'write_file', group: '文件' },
  { name: 'search_code', group: '文件' },
  { name: 'remember', group: '知识' },
  { name: 'recall', group: '知识' },
  { name: 'evidence', group: '知识' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
      <h3 className="text-xs font-semibold text-gray-700 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string | number | boolean }) {
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return (
    <div className="flex justify-between text-xs text-gray-700">
      <span>{label}</span>
      <span className="font-medium text-right">{display}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full mr-1.5 mb-1 ${color}`}>{text}</span>;
}

export function CatTab({ cat, budget, caps }: { cat: CatConfig; budget: ContextBudget; caps?: Capabilities }) {
  return (
    <>
      <Section title="模型 & 预算">
        <div className="space-y-1.5">
          <KV label="Provider" value={cat.provider} />
          <KV label="Model" value={cat.model} />
          <KV label="MCP 交付" value={cat.mcpSupport ? '原生 (--mcp-config)' : 'HTTP 回调注入'} />
          <KV label="Prompt 上限" value={`${(budget.maxPromptChars / 1000).toFixed(0)}k chars`} />
          <KV label="上下文上限" value={`${(budget.maxContextChars / 1000).toFixed(0)}k chars`} />
          <KV label="消息数上限" value={budget.maxMessages} />
          <KV label="单消息上限" value={`${(budget.maxContentLengthPerMsg / 1000).toFixed(0)}k chars`} />
        </div>
      </Section>
      <Section title="Skills">
        {caps && caps.skills.length > 0 ? (
          <div className="flex flex-wrap">{caps.skills.map((s) => <Badge key={s} text={s} color="bg-blue-100 text-blue-700" />)}</div>
        ) : (
          <p className="text-xs text-gray-400">未发现 skills</p>
        )}
        <p className="text-[10px] text-gray-400 mt-2">Skills 从 ~/.{'{cli}'}/skills/ 和项目 .claude/skills/ 发现</p>
      </Section>
      <Section title="MCP 工具">
        <div className="space-y-1">
          {MCP_TOOLS.map((t) => (
            <div key={t.name} className="flex items-center gap-2 text-xs">
              <Badge text={t.group} color="bg-gray-200 text-gray-600" />
              <span className="font-mono text-gray-700">{t.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <p className="text-[11px] text-gray-500 font-medium mb-1">外部 MCP 服务器</p>
          {caps && caps.externalMcpServers.length > 0 ? (
            <div className="flex flex-wrap">{caps.externalMcpServers.map((s) => <Badge key={s} text={s} color="bg-purple-100 text-purple-700" />)}</div>
          ) : (
            <p className="text-xs text-gray-400">无外部 MCP</p>
          )}
        </div>
      </Section>
    </>
  );
}

export function SystemTab({ config }: { config: ConfigData }) {
  return (
    <>
      <Section title="A2A 猫猫互调">
        <div className="space-y-1.5">
          <KV label="启用" value={config.a2a.enabled} />
          <KV label="最大深度" value={config.a2a.maxDepth} />
        </div>
      </Section>
      <Section title="记忆 (F3-lite)">
        <div className="space-y-1.5">
          <KV label="启用" value={config.memory.enabled} />
          <KV label="每线程最大 key 数" value={config.memory.maxKeysPerThread} />
        </div>
      </Section>
      <Section title="Hindsight 长期记忆">
        <div className="space-y-1.5">
          <KV label="启用" value={config.hindsight.enabled} />
          <KV label="Base URL" value={config.hindsight.baseUrl} />
          <KV label="共享 Bank" value={config.hindsight.sharedBank} />
          {config.hindsight.recallDefaults ? (
            <>
              <KV label="Recall Budget" value={config.hindsight.recallDefaults.budget} />
              <KV label="Recall TagsMatch" value={config.hindsight.recallDefaults.tagsMatch} />
              <KV label="Recall Limit" value={config.hindsight.recallDefaults.limit} />
            </>
          ) : null}
          {config.hindsight.retainPolicy ? (
            <>
              <KV label="Narrative Fact Required" value={config.hindsight.retainPolicy.narrativeFactRequired} />
              <KV label="Min Useful Horizon Days" value={config.hindsight.retainPolicy.minUsefulHorizonDays} />
              {typeof config.hindsight.retainPolicy.anchorRequired === 'boolean' ? (
                <KV label="Anchor Required" value={config.hindsight.retainPolicy.anchorRequired} />
              ) : null}
            </>
          ) : null}
          {config.hindsight.reflect ? (
            <KV label="Reflect Disposition" value={config.hindsight.reflect.dispositionMode} />
          ) : null}
        </div>
      </Section>
      {config.hindsight.engine ? (
        <Section title="引擎路由">
          <div className="space-y-1.5">
            <KV label="Reflect Engine" value={config.hindsight.engine.reflect} />
            <KV label="Retain Extraction Engine" value={config.hindsight.engine.retainExtraction} />
            <KV label="allowNativeFallback" value={config.hindsight.engine.allowNativeFallback} />
          </div>
        </Section>
      ) : null}
      {config.hindsight.service ? (
        <Section title="Hindsight 独立服务">
          <div className="space-y-1.5">
            <KV label="服务模式" value={config.hindsight.service.mode} />
            <KV label="requireHealthcheck" value={config.hindsight.service.requireHealthcheck} />
            <KV label="写入超时(ms)" value={config.hindsight.service.writeTimeoutMs} />
            <KV label="检索超时(ms)" value={config.hindsight.service.recallTimeoutMs} />
          </div>
        </Section>
      ) : null}
      {config.codexExecution ? (
        <Section title="Codex 推理执行">
          <div className="space-y-1.5">
            <KV label="Model" value={config.codexExecution.model} />
            <KV label="Auth Mode" value={config.codexExecution.authMode} />
            <KV label="Pass --model Arg" value={config.codexExecution.passModelArg} />
          </div>
        </Section>
      ) : null}
      <Section title="治理 & 降级">
        <div className="space-y-1.5">
          <KV label="降级策略启用" value={config.governance.degradationEnabled} />
          <KV label="Done 超时" value={`${config.governance.doneTimeoutMs / 1000}s`} />
          <KV label="Heartbeat 间隔" value={`${config.governance.heartbeatIntervalMs / 1000}s`} />
        </div>
      </Section>
    </>
  );
}
