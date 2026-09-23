import { expect, test } from '@playwright/test';
import { createPublished, creatorApi } from './helpers';
import { authFile } from './users';

/**
 * Without accounts the browser is the only thing that remembers a creator, so the recovery links
 * are the product's answer to "I cleared my browser data". These run in a completely fresh
 * context — no storageState — which is exactly the situation being tested.
 */
test('a manage link restores one surprise after browser data is cleared', async ({ browser }) => {
  const alice = await creatorApi('alice');
  const { id } = await createPublished(alice, 'date-invitation');
  const kept = await alice.get(`/bff/api/v1/experiences/${id}/manage-link`);
  expect(kept.status()).toBe(200);
  const { manageToken } = (await kept.json()) as { manageToken: string };

  // A brand-new browser: no cookies, no storage, nothing.
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(`/m/${manageToken}`);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Your experiences' })).toBeVisible();

  // The surprise is reachable, and its replies with it.
  const recovered = await fresh.request.get(`/bff/api/v1/experiences/${id}`);
  expect(recovered.status()).toBe(200);
  const results = await fresh.request.get(`/bff/api/v1/experiences/${id}/results`);
  expect(results.status()).toBe(200);
  await fresh.close();
});

test('a recovery link restores every surprise the creator made', async ({ browser }) => {
  const bob = await creatorApi('bob');
  const first = await createPublished(bob, 'date-invitation');
  const second = await createPublished(bob, 'anniversary');

  // Read the recovery link the account page shows, from the signed-in context.
  const signedIn = await browser.newContext({ storageState: authFile('bob') });
  const account = await signedIn.newPage();
  await account.goto('/account');
  await account.getByRole('button', { name: 'Show my recovery link' }).click();
  const url = await account.getByLabel('Your recovery link').inputValue();
  expect(url).toContain('/r/');
  await signedIn.close();

  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(url);
  await expect(page).toHaveURL(/\/dashboard/);

  for (const id of [first.id, second.id]) {
    expect((await fresh.request.get(`/bff/api/v1/experiences/${id}`)).status()).toBe(200);
  }
  await fresh.close();
});

test('an invalid recovery link is refused rather than silently ignored', async ({ browser }) => {
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto('/r/not-a-real-token');
  // Scoped to main: Next's route announcer is also role="alert".
  await expect(page.getByRole('main').getByRole('alert')).toContainText('not valid');
  await fresh.close();
});
