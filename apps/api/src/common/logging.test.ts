import { describe, expect, it } from 'vitest';
import { loggerParams, prettyTransportAvailable, redactUrl } from './logging';
import type { AppEnv } from '../config/env';

describe('redactUrl', () => {
  it('removes share tokens, signed media keys and query strings from logged URLs', () => {
    expect(redactUrl('/api/v1/public/experiences/SECRET_TOKEN/session/gift')).toBe(
      '/api/v1/public/experiences/[redacted]/session/gift',
    );
    expect(redactUrl('/api/v1/media/blob/a2V5?sig=abc&exp=1')).toBe(
      '/api/v1/media/blob/[redacted]',
    );
    expect(redactUrl('/api/v1/experiences?cursor=x')).toBe('/api/v1/experiences');
  });
});

describe('loggerParams transport', () => {
  const env = { APP_ENV: 'development', LOG_LEVEL: 'info' } as AppEnv;

  it('only asks pino for pino-pretty when the package is installed', () => {
    const { transport } = loggerParams(env).pinoHttp as { transport?: { target: string } };
    expect(transport?.target).toBe(prettyTransportAvailable() ? 'pino-pretty' : undefined);
  });

  it('logs JSON outside development', () => {
    const production = { ...env, APP_ENV: 'production' } as AppEnv;
    const { transport } = loggerParams(production).pinoHttp as { transport?: unknown };
    expect(transport).toBeUndefined();
  });
});
