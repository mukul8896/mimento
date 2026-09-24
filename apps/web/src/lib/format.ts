import type { BadgeTone } from '@momentpath/design-system';

export type Status = 'DRAFT' | 'PUBLISHED' | 'DISABLED' | 'EXPIRED' | 'DELETED';

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
  DISABLED: 'Disabled',
  EXPIRED: 'Expired',
  DELETED: 'Deleted',
};

export const STATUS_TONE: Record<Status, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  DISABLED: 'warning',
  EXPIRED: 'warning',
  DELETED: 'danger',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** True when a surprise will be deleted for lack of use within the next 30 days. */
export function deletedSoon(keptUntil: string | null): boolean {
  return keptUntil !== null && new Date(keptUntil).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
}
