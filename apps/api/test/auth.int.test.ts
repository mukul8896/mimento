import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestContext, creator, TEST_ADMIN_TOKEN, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => ctx.close());

describe('authentication', () => {
  it('rejects requests without a token with problem details', async () => {
    const res = await ctx.http.get(`${API}/me`);
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(res.body.requestId).toEqual(expect.any(String));
  });

  it.each([
    ['malformed', 'not-a-token'],
    ['well-formed but unknown', 'a'.repeat(43)],
    ['empty', ''],
  ])('rejects a %s owner token', async (_label, token) => {
    const res = await ctx.http.get(`${API}/me`).set('x-owner-token', token);
    expect(res.status).toBe(401);
  });

  it('mints an anonymous owner without any registration', async () => {
    const res = await ctx.http.post(`${API}/owners`).send({});
    expect(res.status).toBe(201);
    expect(res.body.ownerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const me = await ctx.http.get(`${API}/me`).set('x-owner-token', res.body.ownerToken);
    expect(me.status).toBe(200);
    expect(me.body.isAdmin).toBe(false);
  });

  it('separates owners: one owner cannot see another owner’s experiences', async () => {
    const alice = await creator(ctx);
    const bob = await creator(ctx);
    const created = await alice.post('/experiences', { title: 'Alice only' });
    expect(created.status).toBe(201);

    expect((await bob.get(`/experiences/${created.body.id}`)).status).toBe(404);
    expect((await bob.get('/experiences')).body.items).toHaveLength(0);
  });

  it('grants admin routes only to the operator credential', async () => {
    const user = await creator(ctx);
    expect((await user.get('/admin/reports')).status).toBe(403);

    const admin = await creator(ctx, { admin: true });
    expect((await admin.get('/me')).body.isAdmin).toBe(true);
    expect((await admin.get('/admin/reports')).status).toBe(200);
  });

  it('rejects a wrong admin token rather than falling back to a creator', async () => {
    const res = await ctx.http.get(`${API}/admin/reports`).set('x-admin-token', 'b'.repeat(40));
    expect(res.status).toBe(401);
    expect(TEST_ADMIN_TOKEN).not.toBe('b'.repeat(40));
  });

  it('echoes a safe incoming request id', async () => {
    const res = await ctx.http.get(`${API}/me`).set('x-request-id', 'test-request-0001');
    expect(res.body.requestId).toBe('test-request-0001');
  });

  it('serves health and readiness without auth', async () => {
    expect((await ctx.http.get(`${API}/health`)).body).toEqual({ status: 'ok' });
    expect((await ctx.http.get(`${API}/ready`)).body).toEqual({ status: 'ready' });
  });
});

describe('manage links', () => {
  it('recovers one experience without the owner token, and only that one', async () => {
    const alice = await creator(ctx);
    const kept = await alice.post('/experiences', { title: 'Recovered' });
    const other = await alice.post('/experiences', { title: 'Not shared' });

    const link = await alice.get(`/experiences/${kept.body.id}/manage-link`);
    expect(link.status).toBe(200);
    expect(link.body.manageToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const scoped = { 'x-manage-token': link.body.manageToken as string };

    // Reaches the experience it was issued for...
    const recovered = await ctx.http.get(`${API}/experiences/${kept.body.id}`).set(scoped);
    expect(recovered.status).toBe(200);
    expect(recovered.body.title).toBe('Recovered');

    // ...but not the owner's other experiences, even though it is the same owner.
    expect((await ctx.http.get(`${API}/experiences/${other.body.id}`).set(scoped)).status).toBe(
      404,
    );
    const listed = await ctx.http.get(`${API}/experiences`).set(scoped);
    expect(listed.body.items.map((i: { id: string }) => i.id)).toEqual([kept.body.id]);
  });

  it('rejects an unknown manage token', async () => {
    const res = await ctx.http.get(`${API}/experiences`).set('x-manage-token', 'z'.repeat(43));
    expect(res.status).toBe(401);
  });
});
