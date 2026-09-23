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
