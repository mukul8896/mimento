import type { z } from 'zod';
import { ProviderUnavailableError } from '../../providers/payments';

const TIMEOUT_MS = 10_000;

/**
 * JSON call to a payment provider. Any failure (network, timeout, non-2xx, unexpected shape)
 * becomes ProviderUnavailableError carrying only the provider name and status — response bodies
 * are never included, so nothing a provider echoes back can reach the logs.
 */
export async function providerJson<T extends z.ZodType>(
  provider: string,
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: unknown },
  schema: T,
): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        accept: 'application/json',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ProviderUnavailableError(`${provider}: request failed`);
  }
  if (!res.ok) throw new ProviderUnavailableError(`${provider}: HTTP ${res.status}`);
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ProviderUnavailableError(`${provider}: unexpected response`);
  return parsed.data;
}

/** Parses a signed webhook body; a malformed one is treated as an event we do not handle. */
export function parseJsonBody(rawBody: Buffer): unknown {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
}
