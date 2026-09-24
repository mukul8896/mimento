'use client';

import type {
  Answer,
  PublicExperience,
  RevealedGift,
  SessionProgress,
} from '@momentpath/contracts';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { PlayerError, type PlayerBackend, type PlayerState } from './backend';

type ReportCategory =
  'HARASSMENT' | 'SEXUAL_CONTENT' | 'HATE' | 'SCAM_OR_FRAUD' | 'VIOLENCE' | 'COPYRIGHT' | 'OTHER';

function storageKey(token: string): string {
  return `mp:rs:${token.slice(0, 12)}`;
}

function readStored(token: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(token));
  } catch {
    return null;
  }
}

/** Used by short links, which start the session themselves and then open the private link. */
export function rememberSession(token: string, session: string): void {
  store(token, session);
}

function store(token: string, session: string): void {
  try {
    window.localStorage.setItem(storageKey(token), session);
  } catch {
    // Private mode: progress lasts for this page view only.
  }
}

function toPlayerError(err: unknown): never {
  if (err instanceof ApiError) {
    throw new PlayerError(err.problem.code, err.problem.title, err.problem.detail ?? undefined);
  }
  throw new PlayerError('NETWORK', 'Check your connection and try again.');
}

/**
 * Talks to the public recipient API through the BFF. The anonymous session token lives in
 * localStorage (so a refresh resumes) and travels in a header, never in the URL.
 */
export class ApiBackend implements PlayerBackend {
  readonly mode = 'live' as const;
  private session: string | null = null;

  constructor(private readonly token: string) {}

  private headers() {
    return { 'x-recipient-session': this.session ?? '' };
  }

  async load(options: { pin?: string } = {}): Promise<PlayerState> {
    const api = browserApi();
    const path = { token: this.token };
    const stored = readStored(this.token);
    if (stored) {
      this.session = stored;
      const resumed = await api.GET('/api/v1/public/experiences/{token}/session', {
        params: { path, header: this.headers() },
      });
      if (resumed.data) return resumed.data as unknown as PlayerState;
      const code = (resumed.error as { code?: string } | undefined)?.code;
      if (code === 'EXPERIENCE_UNAVAILABLE') throw new PlayerError(code, 'Unavailable');
    }
    try {
      const started = unwrap(
        await api.POST('/api/v1/public/experiences/{token}/sessions', {
          params: { path },
          body: options.pin ? { pin: options.pin } : undefined,
        }),
      );
      this.session = started.sessionToken;
      store(this.token, started.sessionToken);
      return started as unknown as PlayerState;
    } catch (err) {
      return toPlayerError(err);
    }
  }

  async answer(stepKey: string, answer: Answer) {
    try {
      const res = unwrap(
        await browserApi().POST('/api/v1/public/experiences/{token}/session/answers', {
          params: { path: { token: this.token }, header: this.headers() },
          body: { stepKey, answer },
        }),
      );
      return res as unknown as { progress: SessionProgress; correct: boolean | null };
    } catch (err) {
      return toPlayerError(err);
    }
  }

  async reveal(stepKey: string) {
    try {
      const res = unwrap(
        await browserApi().POST('/api/v1/public/experiences/{token}/session/gift', {
          params: { path: { token: this.token }, header: this.headers() },
          body: { stepKey },
        }),
      );
      return res as unknown as { gift: RevealedGift; progress: SessionProgress };
    } catch (err) {
      return toPlayerError(err);
    }
  }

  async close() {
    if (!this.session) return;
    await browserApi()
      .POST('/api/v1/public/experiences/{token}/session/close', {
        params: { path: { token: this.token }, header: this.headers() },
      })
      .catch(() => undefined);
  }

  async report(category: string, details: string) {
    try {
      unwrap(
        await browserApi().POST('/api/v1/public/experiences/{token}/reports', {
          params: { path: { token: this.token } },
          body: { category: category as ReportCategory, details },
        }),
      );
    } catch (err) {
      toPlayerError(err);
    }
  }
}

export type { PublicExperience };
