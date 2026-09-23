import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubEnv() {
  for (const [key, value] of Object.entries({
    APP_ENV: 'development',
    WEB_ORIGIN: 'http://localhost:3000',
    API_INTERNAL_URL: 'http://api:4000',
  }))
    vi.stubEnv(key, value);
}

const VALID = 'a'.repeat(43);

function cookies(values: Record<string, string>) {
  return { get: (name: string) => (values[name] ? { value: values[name] } : undefined) };
}

beforeEach(() => {
  vi.resetModules();
  stubEnv();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('creator credentials', () => {
  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(44)],
    ['illegal characters', `${'a'.repeat(42)}!`],
    ['empty', ''],
  ])('ignores a %s cookie rather than forwarding it', async (_label, token) => {
    const { creatorHeaders } = await import('./owner');
    expect(creatorHeaders(cookies({ mp_owner: token }))).toEqual({});
  });

  it('forwards a well-formed owner token', async () => {
    const { creatorHeaders } = await import('./owner');
    expect(creatorHeaders(cookies({ mp_owner: VALID }))).toEqual({ 'x-owner-token': VALID });
  });

  it('prefers the manage token, which is scoped to one experience', async () => {
    const { creatorHeaders } = await import('./owner');
    const manage = 'b'.repeat(43);
    expect(creatorHeaders(cookies({ mp_owner: VALID, mp_manage: manage }))).toEqual({
      'x-manage-token': manage,
    });
  });

  it('sends no credential when there is no cookie', async () => {
    const { creatorHeaders } = await import('./owner');
    expect(creatorHeaders(cookies({}))).toEqual({});
  });
});

describe('minting an owner', () => {
  it('asks the API for a token and accepts a well-formed one', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      Response.json({ ownerToken: VALID }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { mintOwnerToken } = await import('./owner');

    expect(await mintOwnerToken()).toBe(VALID);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe('http://api:4000/api/v1/owners');
  });

  it.each([
    ['a malformed token', async () => Response.json({ ownerToken: 'nope' })],
    ['an error response', async () => new Response('no', { status: 503 })],
    ['an unreachable API', () => Promise.reject(new Error('ECONNREFUSED'))],
  ])('returns null for %s instead of throwing', async (_label, impl) => {
    vi.stubGlobal('fetch', vi.fn(impl));
    const { mintOwnerToken } = await import('./owner');
    expect(await mintOwnerToken()).toBeNull();
  });
});
