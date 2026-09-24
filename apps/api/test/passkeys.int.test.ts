import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestContext, creator, type TestContext } from './helpers';
import { SoftPasskey } from './webauthn';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => ctx.close());

async function addPasskey(owner: Awaited<ReturnType<typeof creator>>, key = new SoftPasskey()) {
  const opts = await owner.post('/passkeys/registration-options');
  expect(opts.status, JSON.stringify(opts.body)).toBe(201);
  expect(opts.body.options.authenticatorSelection.residentKey).toBe('required');
  const saved = await owner.post('/passkeys', {
    challengeId: opts.body.challengeId,
    response: key.register(opts.body.options.challenge),
    name: 'My iPhone',
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(201);
  return { key, passkey: saved.body };
}

async function signIn(key: SoftPasskey, currentOwnerToken?: string) {
  const opts = await ctx.http.post(`${API}/passkeys/login-options`).send();
  expect(opts.status).toBe(201);
  const req = ctx.http.post(`${API}/passkeys/login`);
  if (currentOwnerToken) req.set('x-owner-token', currentOwnerToken);
  return req.send({
    challengeId: opts.body.challengeId,
    response: key.authenticate(opts.body.options.challenge),
  });
}

describe('passkeys', () => {
  it('saves a passkey and signs back in on a new device without signing the old one out', async () => {
    const alice = await creator(ctx);
    const { body: exp } = await alice.post('/experiences', { templateKey: 'date-invitation' });
    const { key, passkey } = await addPasskey(alice);
    expect(passkey).toMatchObject({ name: 'My iPhone', backedUp: true, lastUsedAt: null });
    expect((await alice.get('/passkeys')).body.items).toHaveLength(1);

    const res = await signIn(key);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const newDevice = res.body.ownerToken as string;
    expect(newDevice).not.toBe(alice.token);
    const onNew = await ctx.http
      .get(`${API}/experiences/${exp.id}`)
      .set('x-owner-token', newDevice);
    expect(onNew.status).toBe(200);
    // The first device still works.
    expect((await alice.get(`/experiences/${exp.id}`)).status).toBe(200);
    expect((await alice.get('/passkeys')).body.items[0].lastUsedAt).not.toBeNull();
  });

  it('brings along what was made on the new device before signing in', async () => {
    const bob = await creator(ctx);
    const { key } = await addPasskey(bob);
    const fresh = await creator(ctx); // the throwaway identity a new browser gets
    const { body: draft } = await fresh.post('/experiences', { templateKey: 'anniversary' });
    const res = await signIn(key, fresh.token);
    expect(res.status).toBe(200);
    const mine = await ctx.http
      .get(`${API}/experiences/${draft.id}`)
      .set('x-owner-token', res.body.ownerToken);
    expect(mine.status).toBe(200);
    expect((await bob.get(`/experiences/${draft.id}`)).status).toBe(200);
    expect((await fresh.get('/experiences')).status).toBe(401);
  });

  it('refuses replayed challenges, unknown passkeys and forged signatures', async () => {
    const carol = await creator(ctx);
    const { key } = await addPasskey(carol);
    const opts = await ctx.http.post(`${API}/passkeys/login-options`).send();
    const body = {
      challengeId: opts.body.challengeId,
      response: key.authenticate(opts.body.options.challenge),
    };
    expect((await ctx.http.post(`${API}/passkeys/login`).send(body)).status).toBe(200);
    expect((await ctx.http.post(`${API}/passkeys/login`).send(body)).body.code).toBe(
      'PASSKEY_EXPIRED',
    );

    const stranger = new SoftPasskey();
    const o2 = await ctx.http.post(`${API}/passkeys/login-options`).send();
    const unknown = await ctx.http.post(`${API}/passkeys/login`).send({
      challengeId: o2.body.challengeId,
      response: stranger.authenticate(o2.body.options.challenge),
    });
    expect(unknown.status).toBe(401);

    // Signed for a different challenge.
    const o3 = await ctx.http.post(`${API}/passkeys/login-options`).send();
    const forged = await ctx.http
      .post(`${API}/passkeys/login`)
      .send({ challengeId: o3.body.challengeId, response: key.authenticate('not-the-challenge') });
    expect(forged.status).toBe(401);
  });

  it('only the owner can list or remove their passkeys, and removing one stops it working', async () => {
    const dave = await creator(ctx);
    const eve = await creator(ctx);
    const { key, passkey } = await addPasskey(dave);
    expect((await eve.get('/passkeys')).body.items).toHaveLength(0);
    expect((await eve.del(`/passkeys/${passkey.id}`)).status).toBe(404);
    expect((await ctx.http.get(`${API}/passkeys`)).status).toBe(401);
    expect((await dave.del(`/passkeys/${passkey.id}`)).status).toBe(204);
    expect((await signIn(key)).status).toBe(401);
  });

  it('deleting everything revokes passkeys and every signed-in device', async () => {
    const frank = await creator(ctx);
    const { key } = await addPasskey(frank);
    const other = (await signIn(key)).body.ownerToken as string;
    expect((await frank.del('/me')).status).toBe(204);
    expect((await ctx.http.get(`${API}/me`).set('x-owner-token', other)).status).toBe(401);
    expect((await signIn(key)).status).toBe(401);
  });
});
