import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--console-border-soft)] bg-[var(--console-card-bg)] p-[18px]">
      <h3 className="text-lg font-bold text-cafe">{title}</h3>
      {description && <p className="mt-1 text-sm leading-6 text-cafe-secondary">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
