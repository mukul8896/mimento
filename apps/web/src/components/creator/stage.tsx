'use client';

import { useEffect } from 'react';
import type { ThemePalette } from '@momentpath/contracts';
import { clearStage, setStage } from '@/lib/stage';

/** Puts the page on the surprise's stage while mounted; leaving fades back to the site. */
export function Stage({ palette }: { palette: ThemePalette }) {
  const { background, surface, text, accent } = palette;
  useEffect(() => {
    setStage({ background, surface, text, accent });
  }, [background, surface, text, accent]);
  useEffect(() => clearStage, []);
  return null;
}
