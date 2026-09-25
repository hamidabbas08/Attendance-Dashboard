export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{status.replace('_', ' ')}</span>;
}
