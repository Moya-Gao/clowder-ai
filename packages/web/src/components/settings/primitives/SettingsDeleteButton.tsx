import { HubIcon } from '../../hub-icons';

export function SettingsDeleteButton({
  onClick,
  disabled,
  'aria-label': ariaLabel = '删除',
}: {
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="rounded-full p-1.5 text-cafe-muted transition-colors hover:text-[#D08068] disabled:opacity-50"
      aria-label={ariaLabel}
    >
      <HubIcon name="trash" className="h-3.5 w-3.5" />
    </button>
  );
}
