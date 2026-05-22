import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function SettingsIconButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-[26px] w-[26px] items-center justify-center rounded-lg text-cafe-accent transition-colors hover:bg-[var(--console-hover-bg)] hover:text-cafe${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}
