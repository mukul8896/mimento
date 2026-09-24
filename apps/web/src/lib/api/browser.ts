'use client';

import {
  createApiClient,
  isProblem,
  type ApiClient,
  type ProblemDetails,
} from '@momentpath/api-client';

let client: ApiClient | undefined;

/**
 * Browser client: every call goes through the same-origin BFF (tokens stay server-side).
 * Client components also render once on the server, where there is no `window`; creating the
 * client there must not throw (it is never used to fetch until the browser runs effects).
 */
export function browserApi(): ApiClient {
  if (typeof window === 'undefined') return createApiClient({ baseUrl: '/bff' });
  client ??= createApiClient({ baseUrl: `${window.location.origin}/bff` });
  return client;
}

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }
}

/** Unwraps an openapi-fetch result, throwing ApiError with the problem details on failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    const err = result.error;
    throw new ApiError(
      isProblem(err)
        ? err
        : {
            type: 'about:blank',
            title: 'Something went wrong',
            status: result.response.status,
            code: 'UNKNOWN',
            requestId: '',
          },
    );
  }
  return result.data as T;
}
