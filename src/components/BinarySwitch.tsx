export function BinarySwitch({
  checked,
  label,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange?(checked: boolean): void;
}) {
  return (
    <label className="binary-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="binary-switch__track" aria-hidden="true">
        <span />
      </span>
      <span>{label}</span>
    </label>
  );
}
