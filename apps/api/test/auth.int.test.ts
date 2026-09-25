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

    // The private link says which surprise it opens (so /m/<token> can go straight there);
    // the creator's own browser key opens no single surprise.
    const me = await ctx.http.get(`${API}/me`).set(scoped);
    expect(me.body.managedExperienceId).toBe(kept.body.id);
    expect((await alice.get('/me')).body.managedExperienceId).toBeNull();
  });

  it('lets a browser with its own owner token and a manage link keep creating (same owner)', async () => {
    // The reported bug: both cookies for the same owner made every new surprise "not found".
    const alice = await creator(ctx);
    const first = await alice.post('/experiences', { title: 'First' });
    const link = await alice.get(`/experiences/${first.body.id}/manage-link`);
    const both = { 'x-owner-token': alice.token, 'x-manage-token': link.body.manageToken };

    const created = await ctx.http
      .post(`${API}/experiences`)
      .set(both)
      .send({ templateKey: 'birthday-surprise' });
    expect(created.status).toBe(201);
    expect((await ctx.http.get(`${API}/experiences/${created.body.id}`).set(both)).status).toBe(
      200,
    );
    expect((await ctx.http.get(`${API}/experiences/${first.body.id}`).set(both)).status).toBe(200);
  });

  it("uses a manage link for someone else's surprise only for that surprise", async () => {
    const alice = await creator(ctx);
    const bob = await creator(ctx);
    const bobs = await bob.post('/experiences', { title: "Bob's" });
    const link = await bob.get(`/experiences/${bobs.body.id}/manage-link`);
    const both = { 'x-owner-token': alice.token, 'x-manage-token': link.body.manageToken };

    expect((await ctx.http.get(`${API}/experiences/${bobs.body.id}`).set(both)).body.title).toBe(
      "Bob's",
    );
    const mine = await ctx.http.post(`${API}/experiences`).set(both).send({ title: 'Mine' });
    expect(mine.status).toBe(201);
    const row = await ctx.prisma.experience.findUniqueOrThrow({ where: { id: mine.body.id } });
    const aliceProfile = await ctx.prisma.userProfile.findFirstOrThrow({
      where: { experiences: { some: { id: mine.body.id } } },
    });
    expect(row.ownerId).toBe(aliceProfile.id);
    expect((await ctx.http.get(`${API}/experiences/${mine.body.id}`).set(both)).status).toBe(200);

    // The dashboard lists both: this browser's own surprises and the managed one.
    const listed = await ctx.http.get(`${API}/experiences`).set(both);
    expect(listed.body.items.map((i: { id: string }) => i.id).sort()).toEqual(
      [mine.body.id, bobs.body.id].sort(),
    );
    // Bob's other surprises stay invisible.
    const hidden = await bob.post('/experiences', { title: 'Bob private' });
    expect((await ctx.http.get(`${API}/experiences/${hidden.body.id}`).set(both)).status).toBe(404);
  });

  it('explains instead of creating when the browser only has a manage link', async () => {
    const alice = await creator(ctx);
    const kept = await alice.post('/experiences', { title: 'Kept' });
    const link = await alice.get(`/experiences/${kept.body.id}/manage-link`);
    const res = await ctx.http
      .post(`${API}/experiences`)
      .set('x-manage-token', link.body.manageToken)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MANAGE_LINK_ONLY');
  });

  it('rejects an unknown manage token', async () => {
    const res = await ctx.http.get(`${API}/experiences`).set('x-manage-token', 'z'.repeat(43));
    expect(res.status).toBe(401);
  });
});
