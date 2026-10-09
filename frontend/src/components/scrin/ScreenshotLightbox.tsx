'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '../ui';
import { to12h } from '../../lib/ui';
import { LightboxShot } from './types';
import { ActivityGauge } from './ActivityGauge';
import { topApp } from './utils';

// Full-size screenshot viewer that opens in place, the way scrin.io's own
// viewer does — not a new tab. Shows the time, task note, and top app/site at
// the top, with Esc/←/→ and on-screen arrows to step through the whole day's
// screenshots without closing it.
export function ScreenshotLightbox({
  shots, index, onIndex, onClose,
}: {
  shots: LightboxShot[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const shot = shots[index];
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === 'ArrowRight' && index < shots.length - 1) onIndex(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, shots.length, onIndex, onClose]);

  // The current image is never cached on first view, so the arrows felt slow —
  // warm the browser's cache for both neighbors as soon as we land on a shot,
  // so by the time the user clicks next/prev it's already loaded.
  useEffect(() => {
    [shots[index - 1], shots[index + 1]].forEach((s) => {
      if (!s) return;
      const img = new window.Image();
      img.src = s.url;
    });
  }, [index, shots]);

  useEffect(() => setLoaded(false), [index]);

  // The lightbox sits on top of the page as an overlay, but without this the
  // page underneath still scrolls with it — lock body scroll while it's open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!shot) return null;
  const app = topApp(shot.applications);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center px-16 sm:px-24 py-6">
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index - 1);
          }}
          className="absolute left-1 sm:left-4 inset-y-0 flex items-center px-2 sm:px-4 text-white/50 hover:text-white transition-colors text-5xl sm:text-6xl font-thin leading-none"
          aria-label="Previous screenshot"
        >
          ‹
        </button>
      )}

      {/* One bounded modal — the header bar and the image share the same
          frame width, instead of a full-page-width header sitting above a
          narrower, separately-windowed image. */}
      <div className="flex flex-col max-h-full max-w-[82vw]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 shrink-0 bg-black/50 rounded-t-lg border border-b-0 border-white/10">
          <span className="font-semibold">{to12h(shot.takenLocal)}</span>
          <span className="text-white/60 truncate">{shot.note || 'Untitled'}</span>
          {app && <span className="text-white/40 truncate ml-auto mr-3">{app}</span>}
          <ActivityGauge level={shot.activityLevel} size={16} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="relative z-10 ml-2 h-8 w-8 shrink-0 grid place-items-center rounded-full text-white/70 hover:text-white hover:bg-white/10 text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          <img
            key={`thumb-${shot.id}`}
            src={shot.thumbUrl}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-contain rounded-b-lg border border-t-0 border-white/10 blur-sm scale-105 transition-opacity ${loaded ? 'opacity-0' : 'opacity-70'}`}
          />
          <img
            key={`full-${shot.id}`}
            src={shot.url}
            alt={`Screenshot at ${shot.takenLocal}`}
            onLoad={() => setLoaded(true)}
            className={`max-h-[72vh] max-w-full h-full w-full object-contain rounded-b-lg border border-t-0 border-white/10 shadow-2xl transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Spinner size={28} />
            </div>
          )}
        </div>
      </div>

      {index < shots.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index + 1);
          }}
          className="absolute right-1 sm:right-4 inset-y-0 flex items-center px-2 sm:px-4 text-white/50 hover:text-white transition-colors text-5xl sm:text-6xl font-thin leading-none"
          aria-label="Next screenshot"
        >
          ›
        </button>
      )}
    </div>
  );
}
