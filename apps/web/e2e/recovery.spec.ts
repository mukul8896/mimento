import { expect, test } from '@playwright/test';
import { createPublished, creatorApi } from './helpers';
import { authFile } from './users';

/**
 * No accounts: each published surprise has its own private management link, and that link is
 * the way back to it. These run in a completely fresh context — no storageState — which is the
 * situation being tested (a new device, or cleared browser data).
 */
test('a private management link opens Manage Surprise for that surprise, on any device', async ({
  browser,
}) => {
  const alice = await creatorApi('alice');
  const { id } = await createPublished(alice, 'date-invitation');
  const kept = await alice.get(`/bff/api/v1/experiences/${id}/manage-link`);
  expect(kept.status()).toBe(200);
  const { manageToken } = (await kept.json()) as { manageToken: string };

  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(`/m/${manageToken}`);
  // Straight to the surprise: no dashboard or list in between, and the token left the URL.
  await expect(page).toHaveURL(new RegExp(`/experiences/${id}$`));
  await expect(page.getByText('Manage Surprise')).toBeVisible();
  await expect(page.getByTestId('private-link-card')).toContainText('Keep this link safe');

  // Its results come with it, but nothing else of the creator's.
  expect((await fresh.request.get(`/bff/api/v1/experiences/${id}/results`)).status()).toBe(200);
  const other = await createPublished(alice, 'anniversary');
  expect((await fresh.request.get(`/bff/api/v1/experiences/${other.id}`)).status()).toBe(404);
  await fresh.close();
});

test('a browser that opened a private link can still create a new surprise', async ({
  browser,
}) => {
  // Regression: with a manage-link cookie, new surprises were created but then "not found".
  const alice = await creatorApi('alice');
  const { id } = await createPublished(alice, 'date-invitation');
  const { manageToken } = (await (
    await alice.get(`/bff/api/v1/experiences/${id}/manage-link`)
  ).json()) as { manageToken: string };

  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(`/m/${manageToken}`);
  await expect(page).toHaveURL(new RegExp(`/experiences/${id}$`));
  await page.goto('/new');
  await page.getByRole('button', { name: /Birthday surprise/ }).click();
  await expect(page).toHaveURL(/\/personalize$/);
  await expect(page.getByTestId('personalize')).toBeVisible();
  await fresh.close();
});

test('an invalid private link is refused rather than silently ignored', async ({ browser }) => {
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(`/m/${'z'.repeat(43)}`);
  await expect(page).toHaveURL(/\?manage=invalid/);
  // Scoped to main: Next's route announcer is also role="alert".
  await expect(page.getByRole('main').getByRole('alert')).toContainText('does not work');
  expect((await fresh.cookies()).find((c) => c.name === 'mp_manage')).toBeUndefined();
  await fresh.close();
});

test('old creator-wide recovery links open the home page and grant nothing', async ({
  browser,
}) => {
  const bob = await creatorApi('bob');
  const { id } = await createPublished(bob, 'date-invitation');
  const fresh = await browser.newContext();
  const page = await fresh.newPage();
  await page.goto(`/r/${'a'.repeat(43)}`);
  await expect(page.getByTestId('gift-hero')).toBeVisible();
  expect((await fresh.request.get(`/bff/api/v1/experiences/${id}`)).status()).not.toBe(200);
  await fresh.close();
});

test('the account pages are gone', async ({ page }) => {
  for (const path of ['/dashboard', '/account', '/signin']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});

test('a saved key that no longer works is replaced instead of locking the creator out', async ({
  browser,
}) => {
  const context = await browser.newContext();
  // Well-formed, but unknown to the API — like a key that expired after a year unused.
  await context.addCookies([
    {
      name: 'mp_owner',
      value: 'x'.repeat(43),
      url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    },
  ]);
  const page = await context.newPage();
  await page.goto('/new');
  await expect(page).toHaveURL(/\/new/);
  await expect(page.getByRole('heading', { name: 'Create Experience' })).toBeVisible();
  const owner = (await context.cookies()).find((c) => c.name === 'mp_owner');
  expect(owner?.value).not.toBe('x'.repeat(43));
  await context.close();
});

test('the manage page says how long a surprise is kept', async ({ browser }) => {
  const api = await creatorApi('bob');
  const { id } = await createPublished(api, 'date-invitation');
  const context = await browser.newContext({ storageState: authFile('bob') });
  const page = await context.newPage();
  await page.goto(`/experiences/${id}`);
  const year = String(new Date().getFullYear() + 1);
  await expect(page.getByTestId('kept-until')).toContainText(year);
  await context.close();
});
