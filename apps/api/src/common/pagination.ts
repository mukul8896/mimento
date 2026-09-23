import { Problem } from './problem';

/** Opaque keyset cursor over (timestamp, id), newest first. */
export interface Cursor {
  at: Date;
  id: string;
}

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify([at.toISOString(), id])).toString('base64url');
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      /^[0-9a-f-]{36}$/.test(parsed[1])
    ) {
      const at = new Date(parsed[0]);
      if (!Number.isNaN(at.getTime())) return { at, id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw Problem.badRequest('INVALID_CURSOR', 'The pagination cursor is invalid');
}

/** Given limit+1 rows, returns the page and the next cursor. */
export function page<T>(rows: T[], limit: number, key: (row: T) => Cursor) {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = rows.length > limit && last ? encodeCursor(key(last).at, key(last).id) : null;
  return { items, nextCursor };
}
