'use client';

import { useId } from 'react';

interface EditFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

export function EditField({ label, value, onChange, multiline }: EditFieldProps) {
  const inputId = useId();
  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-cafe-muted">{label}:</span>{' '}
      {multiline ? (
        <textarea
          id={inputId}
          className="mt-0.5 w-full rounded border border-[var(--console-border-soft)] bg-cafe-surface-canvas p-1 font-mono text-xs"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          className="mt-0.5 w-full rounded border border-[var(--console-border-soft)] bg-cafe-surface-canvas p-1 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function ProjectPathEdit({
  value,
  onChange,
  existingProjects,
  defaultParent,
}: {
  value: string;
  onChange: (v: string) => void;
  existingProjects: string[];
  defaultParent: boolean;
}) {
  const selectValue = existingProjects.includes(value) ? value : '';
  return (
    <div className="space-y-1">
      {defaultParent && (
        <div className="rounded border border-[var(--semantic-warning)] bg-[var(--semantic-warning-surface)] px-2 py-1 text-xs text-cafe-secondary">
          这个子 thread 会进入未分类。请选择项目，或留空表示明确保留未分类。
        </div>
      )}
      {existingProjects.length > 0 && (
        <label className="block">
          <span className="text-cafe-muted">从已有项目选择:</span>{' '}
          <select
            aria-label="从已有项目选择"
            className="mt-0.5 w-full rounded border border-[var(--console-border-soft)] bg-cafe-surface-canvas p-1 font-mono text-xs"
            value={selectValue}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">手动输入 / 保留未分类</option>
            {existingProjects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </label>
      )}
      <EditField
        label={defaultParent ? '项目归属 (绝对路径，留空=保留未分类)' : '项目归属 (绝对路径，留空=默认)'}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
