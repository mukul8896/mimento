'use client';

import { useMemo } from 'react';
import type { Theme } from '@momentpath/contracts';
import { ApiBackend } from '@/components/player/api-backend';
import { Player } from '@/components/player/player';

export function RecipientPlayer({ token, theme }: { token: string; theme: Theme }) {
  const backend = useMemo(() => new ApiBackend(token), [token]);
  return <Player backend={backend} initialTheme={theme} />;
}
