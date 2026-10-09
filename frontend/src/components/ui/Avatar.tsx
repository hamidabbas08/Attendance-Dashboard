function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

/**
 * Round avatar. Initials on a gradient render instantly; when a Slack image is
 * present it loads on top (lazy, cached by the browser) so there is never a
 * blank circle while it downloads.
 */
export function Avatar({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#38bdf8,#a78bfa)' }}
      className="relative rounded-full flex items-center justify-center text-ink font-semibold shrink-0 overflow-hidden ring-1 ring-white/10"
    >
      <span style={{ fontSize: size * 0.4 }}>{initials(name)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full rounded-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </span>
  );
}
