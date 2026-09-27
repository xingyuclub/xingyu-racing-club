import { ArrowLeft } from 'lucide-react';

export function BackButton({
  label = '返回',
  onClick,
  tone = 'light',
  compact = false,
  disabled = false,
}) {
  const className = [
    'global-back-button',
    tone === 'dark' ? 'is-dark' : '',
    compact ? 'is-compact' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={className}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={compact ? label : undefined}
    >
      <span className="global-back-icon" aria-hidden="true">
        <ArrowLeft size={17} strokeWidth={2.2} />
      </span>
      {!compact && <span className="global-back-label">{label}</span>}
    </button>
  );
}
