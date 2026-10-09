import { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ui } from '../../lib/ui';

/** Thin wrappers over `lib/ui.ts`'s shared table classes. */
export function Table({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`${ui.table} ${className}`} {...props} />;
}

export function Th({
  className = '',
  align,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return <th className={`${ui.th} ${align === 'right' ? 'text-right' : ''} ${className}`} {...props} />;
}

export function Td({
  className = '',
  align,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return <td className={`${ui.td} ${align === 'right' ? 'text-right' : ''} ${className}`} {...props} />;
}

export function Tr({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`transition-colors duration-150 hover:bg-white/[0.025] ${className}`} {...props} />;
}
