import { ButtonHTMLAttributes } from 'react';
import { ui } from '../../lib/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: ui.btn,
  secondary: ui.btnSecondary,
  ghost: ui.btnGhost,
  danger: ui.btnDanger,
};

/** The one button family used everywhere — four intents over `lib/ui.ts`'s shared classes. */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}
