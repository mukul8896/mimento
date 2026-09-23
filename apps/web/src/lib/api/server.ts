import 'server-only';
import { cookies } from 'next/headers';
import { createApiClient, type ApiClient } from '@momentpath/api-client';
import { creatorHeaders } from '../auth/owner';
import { webEnv } from '../env';

/**
 * Server-component API client for the current creator. There is no sign-in: the request either
 * carries an owner/manage cookie or it does not, and the API answers accordingly.
 */
export async function serverApi(): Promise<ApiClient> {
  return createApiClient({
    baseUrl: webEnv().API_INTERNAL_URL,
    headers: creatorHeaders(await cookies()),
    fetch: (input) => fetch(input, { cache: 'no-store' }),
  });
}

/** Unauthenticated server-side client for public recipient metadata. */
export function publicServerApi(): ApiClient {
  return createApiClient({
    baseUrl: webEnv().API_INTERNAL_URL,
    fetch: (input) => fetch(input, { cache: 'no-store' }),
  });
}

export async function hasSession(): Promise<boolean> {
  return Object.keys(creatorHeaders(await cookies())).length > 0;
}
