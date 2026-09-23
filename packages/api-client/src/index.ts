import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { components, paths };
export type Schemas = components['schemas'];
export type ApiClient = ReturnType<typeof createClient<paths>>;

/** RFC 9457 problem details returned by every API error. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  detail?: string;
  issues?: { stepKey: string | null; field: string | null; message: string }[];
}

export function isProblem(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { status?: unknown }).status === 'number'
  );
}

export interface ClientOptions {
  /** Base URL that the `/api/v1/...` paths are appended to, without the `/api` prefix mapping. */
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  middleware?: Middleware[];
}

export function createApiClient(options: ClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    headers: options.headers,
    fetch: options.fetch,
  });
  for (const m of options.middleware ?? []) client.use(m);
  return client;
}
