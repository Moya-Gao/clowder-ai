'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

interface RuleFile {
  path: string;
  content: string;
  exists: boolean;
}

interface ProviderGuide extends RuleFile {
  provider: string;
}

interface L0CompiledForCat {
  catId: string;
  displayName: string;
  compiled: string;
  error: string | null;
}

interface L0PromptsBlock {
  template: RuleFile;
  compiledByCat: L0CompiledForCat[];
  customization: { templatePath: string; compileScript: string; verifyCommand: string };
}

interface RulesData {
  sharedRules: RuleFile[];
  providerGuides: ProviderGuide[];
  l0Prompts?: L0PromptsBlock;
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: '布偶猫 (Claude)',
  codex: '缅因猫 (Codex)',
  gemini: '暹罗猫 (Gemini)',
};

const FILE_LABELS: Record<string, string> = {
  'cat-cafe-skills/refs/shared-rules.md': '家规（三猫共用协作规则）',
  'docs/SOP.md': '运维 SOP',
};

export function RulesPromptsContent() {
  const [data, setData] = useState<RulesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: RuleFile; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/rules');
        if (cancelled) return;
        if (!res.ok) {
          setError('规则加载失败');
          return;
        }
        setData((await res.json()) as RulesData);
      } catch {
        if (!cancelled) setError('网络错误');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="console-status-chip" data-status="error">
        {error}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-cafe-muted">加载中...</p>;

  return (
    <div className="space-y-6">
      <Section
        title="共享规则"
        description="全部成员遵循的协作规则和流程规范（shared-rules.md 摘要注入系统提示词，SOP.md 为参考文档）"
        badge={`${data.sharedRules.length} files`}
      >
        {data.sharedRules.map((file) => (
          <RuleFileCard
            key={file.path}
            file={file}
            onClick={() => setPreviewFile({ file, label: FILE_LABELS[file.path] ?? file.path })}
          />
        ))}
      </Section>

      <Section
        title="模型指南"
        description="每只猫的角色定义和模型特定约束"
        badge={`${data.providerGuides.length} guides`}
      >
        {data.providerGuides.map((guide) => (
          <RuleFileCard
            key={guide.path}
            file={guide}
            label={PROVIDER_LABELS[guide.provider]}
            onClick={() => setPreviewFile({ file: guide, label: PROVIDER_LABELS[guide.provider] ?? guide.path })}
          />
        ))}
      </Section>

      {data.l0Prompts && (
        <L0PromptsSection l0Prompts={data.l0Prompts} onPreview={(file, label) => setPreviewFile({ file, label })} />
      )}

      {previewFile && (
        <RulePreviewModal label={previewFile.label} file={previewFile.file} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

function Section({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section className="console-list-card rounded-2xl p-5 md:p-6 shadow-[0_12px_30px_rgba(43,33,26,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-cafe">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-cafe-secondary">{description}</p>
        </div>
        <span className="console-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-cafe-secondary">
          {badge}
        </span>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function RuleFileCard({
  file,
  label,
  onClick,
  errorMessage,
}: {
  file: RuleFile;
  label?: string;
  onClick: () => void;
  /** F203 Phase F: compile-failed compiled L0 — distinct UX from missing file. */
  errorMessage?: string;
}) {
  const displayLabel = label ?? FILE_LABELS[file.path] ?? file.path;

  // Cloud R3 P2: use explicit presence check, not truthy — `new Error('').message === ''`,
  // so a real compile failure with empty message would falsy-fallthrough to "文件不存在".
  if (errorMessage !== undefined) {
    return (
      <div className="console-list-card rounded-2xl px-4 py-4 shadow-[0_12px_30px_rgba(43,33,26,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-cafe">{displayLabel}</p>
          <span className="console-status-chip" data-status="warn">
            编译失败
          </span>
        </div>
        <p className="mt-2 text-xs text-cafe-muted">{errorMessage || '(无错误信息)'}</p>
      </div>
    );
  }

  if (!file.exists) {
    return (
      <div className="console-list-card rounded-2xl px-4 py-4 shadow-[0_12px_30px_rgba(43,33,26,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-cafe">{displayLabel}</p>
          <span className="console-status-chip" data-status="error">
            文件不存在
          </span>
        </div>
        <p className="mt-2 text-xs text-cafe-muted">{file.path}</p>
      </div>
    );
  }

  const lineCount = file.content.split('\n').length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="console-list-card flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left shadow-[0_12px_30px_rgba(43,33,26,0.08)] transition-colors hover:bg-[var(--console-hover-bg)]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-cafe">{displayLabel}</p>
          <span className="console-status-chip" data-status="info">
            可预览
          </span>
        </div>
        <p className="mt-1 text-xs text-cafe-muted">
          {file.path} · {lineCount} 行
        </p>
      </div>
      <span className="console-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-cafe-secondary">
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </button>
  );
}

/**
 * F203 Phase F — L0 system prompt section (read-only viewer).
 * Renders the L0 template card + per-cat compiled cards + customization paths.
 * Wired into RulesPromptsContent as 3rd Section. Props-driven for testability;
 * async fetch + modal interaction stay in RulesPromptsContent.
 */
export function L0PromptsSection({
  l0Prompts,
  onPreview,
}: {
  l0Prompts: L0PromptsBlock;
  onPreview: (file: RuleFile, label: string) => void;
}) {
  return (
    <Section
      title="L0 系统提示词"
      description="替换式注入到每只猫的 native system role（Phase C 起；客观性指令 carry-over 保留）。template 是真相源；per-cat 渲染是 compileL0 实际产出。"
      badge={`1 template + ${l0Prompts.compiledByCat.length} cats`}
    >
      <RuleFileCard
        file={l0Prompts.template}
        label="L0 Template（含占位）"
        onClick={() => onPreview(l0Prompts.template, 'L0 Template — system-prompt-l0.md')}
      />
      {l0Prompts.compiledByCat.map((c) => {
        const compiledFile: RuleFile = {
          path: `compiled://${c.catId}`,
          content: c.compiled,
          exists: c.error === null,
        };
        return (
          <RuleFileCard
            key={c.catId}
            file={compiledFile}
            label={c.displayName}
            onClick={() => onPreview(compiledFile, `${c.displayName} — compiled L0`)}
            errorMessage={c.error ?? undefined}
          />
        );
      })}
      <div className="rounded-xl bg-[var(--console-panel-bg)] p-3 text-xs leading-5 text-cafe-muted">
        <p className="font-medium text-cafe-secondary">如何修改 L0（read-only viewer，编辑入口在文件系统）</p>
        <p className="mt-1">
          Template 真相源: <code>{l0Prompts.customization.templatePath}</code>
        </p>
        <p>
          Per-cat 渲染逻辑: <code>{l0Prompts.customization.compileScript}</code>
        </p>
        <p>改完验证: {l0Prompts.customization.verifyCommand}</p>
      </div>
    </Section>
  );
}

function RulePreviewModal({ label, file, onClose }: { label: string; file: RuleFile; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const lineCount = file.content.split('\n').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--console-overlay-backdrop)] p-4 backdrop-blur-sm">
      <button type="button" aria-label="关闭预览" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[calc(100vh-32px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] bg-[var(--console-card-bg)] p-[26px] shadow-[0_20px_48px_rgba(43,33,26,0.14)]"
      >
        <div className="flex shrink-0 items-center gap-[14px]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--console-active-bg)] text-[18px] font-bold text-[var(--console-modal-title)]">
            📜
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-extrabold text-cafe">{label}</h2>
            <p className="text-xs text-cafe-muted">
              {file.path} · {lineCount} 行
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[16px] text-cafe-muted transition hover:bg-[var(--console-modal-close-bg)] hover:text-[var(--console-modal-close-fg)]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[16px] bg-[var(--console-panel-bg)] p-4">
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-cafe-secondary">
            {file.content}
          </pre>
        </div>
      </div>
    </div>
  );
}
