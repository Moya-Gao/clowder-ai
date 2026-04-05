'use client';

interface FocusModeButtonProps {
  label?: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Compact focus-mode trigger shown in the view-mode tab bar.
 * UX fix (intake #362): single consistent position for all panes.
 */
export function FocusModeButton({ label = '专注', disabled, onClick }: FocusModeButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="ml-auto px-2 py-1 rounded-md text-[10px] font-medium transition-colors bg-cocreator-primary/10 text-cocreator-primary border border-cocreator-primary/20 hover:bg-cocreator-primary/15 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
