'use client';

import { useEffect, useRef } from 'react';

export type IllustrationName = 'ring' | 'heart';

/**
 * A designed animation (public/lottie/<name>.json) played by lottie-web's light SVG player.
 * The player and the file are fetched only when an illustration is actually shown, so the
 * first scene never waits for them. With reduced motion the finished pose is shown still.
 * Files must be shapes only (no text layers), so nothing is injected into the page's styles.
 */
export function Illustration({
  name,
  loop = false,
  reducedMotion,
  className = 'size-40',
}: {
  name: IllustrationName;
  loop?: boolean;
  reducedMotion: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    void (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          fetch(`/lottie/${name}.json`).then((r) => r.json() as Promise<object>),
        ]);
        if (cancelled || !box.current) return;
        const anim = lottie.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop: loop && !reducedMotion,
          autoplay: !reducedMotion,
          animationData: data,
          rendererSettings: { progressiveLoad: true },
        });
        if (reducedMotion)
          anim.addEventListener('DOMLoaded', () => anim.goToAndStop(anim.totalFrames - 1, true));
        destroy = () => anim.destroy();
      } catch {
        // An illustration is decoration; the moment still works without it.
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [name, loop, reducedMotion]);
  return (
    <div ref={box} aria-hidden="true" className={className} data-testid={`illustration-${name}`} />
  );
}
