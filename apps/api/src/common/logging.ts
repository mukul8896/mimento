import type { Params } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../config/env';

/** Replace private tokens in paths: /public/experiences/<token>/... and signed media URLs. */
export function redactUrl(url: string | undefined): string {
  if (!url) return '';
  const [path] = url.split('?');
  return (path ?? '')
    .replace(/(\/public\/experiences\/)[^/]+/, '$1[redacted]')
    .replace(/(\/media\/blob\/)[^/]+/, '$1[redacted]');
}

/**
 * pino-pretty is a devDependency, so production images (`pnpm deploy --prod`) do not ship it.
 * Asking pino for a transport it cannot resolve throws at boot, which would crash the container
 * whenever APP_ENV=development is set against a production install; fall back to JSON logs instead.
 */
export function prettyTransportAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

export function loggerParams(env: AppEnv): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: (req: IncomingMessage) => {
        const header = req.headers['x-request-id'];
        const incoming = Array.isArray(header) ? header[0] : header;
        return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
      },
      // Headers and bodies are never logged: they carry access tokens, recipient session
      // tokens, voucher values and private messages.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: redactUrl(req.url),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      redact: {
        paths: ['req.headers', 'res.headers', '*.authorization', '*.cookie', '*.secret', '*.token'],
        remove: true,
      },
      customProps: () => ({ service: 'api' }),
      transport:
        env.APP_ENV === 'development' && prettyTransportAvailable()
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/v1/health' },
    },
  };
}
