import { InputHTMLAttributes } from 'react';
import { ui } from '../../lib/ui';

/** A labeled date field over the native `<input type="date">` + shared input styling. */
export function DatePicker({
  label,
  className = '',
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }) {
  return (
    <div>
      {label && <label className={ui.label} htmlFor={id}>{label}</label>}
      <input id={id} type="date" className={`${ui.input} ${className}`} {...props} />
    </div>
  );
}
