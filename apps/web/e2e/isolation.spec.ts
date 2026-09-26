import { expect, test } from '@playwright/test';
import { createPublished, creatorApi, openSurprise } from './helpers';
import { authFile } from './users';

test('another creator cannot see or change an experience', async ({ browser }) => {
  const alice = await creatorApi('alice');
  const { id } = await createPublished(alice, 'anniversary');

  const bob = await creatorApi('bob');
  for (const res of [
    await bob.get(`/bff/api/v1/experiences/${id}`),
    await bob.get(`/bff/api/v1/experiences/${id}/draft`),
    await bob.get(`/bff/api/v1/experiences/${id}/results`),
    await bob.get(`/bff/api/v1/experiences/${id}/share-link`),
    await bob.delete(`/bff/api/v1/experiences/${id}`),
  ]) {
    expect(res.status()).toBe(404);
  }

  const context = await browser.newContext({ storageState: authFile('bob') });
  const page = await context.newPage();
  await page.goto(`/experiences/${id}`);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await context.close();
});

test('cross-site mutations through the BFF are rejected', async () => {
  const bob = await creatorApi('bob');
  const res = await bob.post('/bff/api/v1/experiences', {
    data: {},
    headers: { origin: 'https://evil.example' },
  });
  expect(res.status()).toBe(403);
});

test('admin reviews a report and takes the experience down', async ({ browser }) => {
  const alice = await creatorApi('alice');
  const { id, token } = await createPublished(alice, 'birthday-surprise');
  const anon = await browser.newContext();
  const recipient = await anon.newPage();
  const report = await recipient.request.post(`/bff/api/v1/public/experiences/${token}/reports`, {
    data: { category: 'HARASSMENT', details: 'e2e' },
    headers: {
      origin: new URL(recipient.url() === 'about:blank' ? 'http://localhost:3000' : recipient.url())
        .origin,
    },
  });
  expect(report.status()).toBe(202);

  const adminContext = await browser.newContext({ storageState: authFile('admin') });
  const admin = await adminContext.newPage();
  await admin.goto('/admin');
  await expect(admin.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  const card = admin.getByRole('listitem').filter({ hasText: 'e2e' }).first();
  await card.getByRole('button', { name: 'Take down' }).click();
  await admin.getByLabel('Reason shown to the creator').fill('Reported harassment');
  await admin.getByRole('dialog').getByRole('button', { name: 'Take down' }).click();
  await expect(admin.getByRole('dialog')).toBeHidden();

  await recipient.goto(`/e/${token}`);
  await expect(recipient.getByTestId('unavailable')).toBeVisible();
  const detail = await (await alice.get(`/bff/api/v1/experiences/${id}`)).json();
  expect(detail.moderationState).toBe('TAKEN_DOWN');
  await anon.close();
  await adminContext.close();
});

test('creator sees results for their experience', async ({ browser }) => {
  const alice = await creatorApi('alice');
  const { id, token } = await createPublished(alice, 'date-invitation');
  const anon = await browser.newContext();
  const page = await anon.newPage();
  await page.goto(`/e/${token}`);
  await openSurprise(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes!' }).click();
  await anon.close();

  const context = await browser.newContext({ storageState: authFile('alice') });
  const creator = await context.newPage();
  await creator.goto(`/experiences/${id}`);
  await expect(creator.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(creator.getByText('Recipient 1')).toBeVisible();
  await expect(creator.getByText('Yes!').first()).toBeVisible();
  await context.close();
});
