'use client';

import {
  createApiClient,
  isProblem,
  type ApiClient,
  type ProblemDetails,
} from '@momentpath/api-client';

let client: ApiClient | undefined;

/** Browser client: every call goes through the same-origin BFF (tokens stay server-side). */
export function browserApi(): ApiClient {
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
