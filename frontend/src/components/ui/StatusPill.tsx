import { pillClass } from '../../lib/ui';

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={pillClass(status)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status.replace('_', ' ')}
    </span>
  );
}
