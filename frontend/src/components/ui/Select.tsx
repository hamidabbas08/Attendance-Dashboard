import { ReactNode, SelectHTMLAttributes } from 'react';
import { ui } from '../../lib/ui';

export interface SelectOption {
  value: string | number;
  label: ReactNode;
}

/**
 * A labeled single-select dropdown over the native `<select>` + `lib/ui.ts`'s
 * input styling — replaces the Year/Month/Employee/Status selects that used
 * to be hand-duplicated per page. `placeholder` renders a disabled first
 * option (e.g. "Select…"); `children` can be used instead of `options` for
 * callers that need custom `<option>` markup.
 */
export function Select({
  label,
  options,
  placeholder,
  className = '',
  id,
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: string;
  options?: SelectOption[];
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      {label && <label className={ui.label} htmlFor={id}>{label}</label>}
      <select id={id} className={`${ui.input} ${className}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {children}
      </select>
    </div>
  );
}
