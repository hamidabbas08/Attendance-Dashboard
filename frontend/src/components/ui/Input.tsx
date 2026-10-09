import { InputHTMLAttributes } from 'react';
import { ui } from '../../lib/ui';

/** A labeled text input over `lib/ui.ts`'s shared input styling. */
export function Input({
  label,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className={ui.label} htmlFor={id}>{label}</label>}
      <input id={id} className={`${ui.input} ${className}`} {...props} />
    </div>
  );
}
