import { expect, test } from '@playwright/test';
import { createPublished, creatorApi } from './helpers';
import { authFile } from './users';

test.describe('creator', () => {
  test.use({ storageState: authFile('alice') });

  test('sets a PIN and short link on the manage page, and a recipient opens it', async ({
    page,
    browser,
  }) => {
    const { id, token } = await createPublished(await creatorApi('alice'), 'date-invitation');
    await page.goto(`/experiences/${id}`);
    const panel = page.getByTestId('access-panel');
    await panel.getByLabel('PIN').fill('2580');
    await panel.getByRole('button', { name: 'Set PIN' }).click();
    await expect(panel.getByRole('heading', { name: 'PIN (set)' })).toBeVisible();

    const slug = `e2e-${Date.now().toString(36)}`;
    await panel.getByLabel('Short link name').fill(slug);
    await panel.getByRole('button', { name: 'Save link' }).click();
    await expect(panel.getByTestId('short-link')).toHaveValue(`/p/${slug}`);

    // A recipient on a fresh device: short link, wrong PIN, right PIN, then the surprise.
    const context = await browser.newContext();
    const recipient = await context.newPage();
    await recipient.goto(`/p/${slug}`);
    await recipient.getByLabel('Enter the PIN you were given').fill('1111');
    await recipient.getByRole('button', { name: 'Open' }).click();
    await expect(recipient.getByText(/That PIN is not right/)).toBeVisible();
    await recipient.getByLabel('Enter the PIN you were given').fill('2580');
    await recipient.getByRole('button', { name: 'Open' }).click();
    await expect(recipient).toHaveURL(new RegExp(`/e/${token}$`));
    await expect(recipient.getByRole('heading', { name: 'Hey you 👋' })).toBeVisible();
    // The page title never names the surprise (the template's title is 'A little question for you').
    await expect(recipient).not.toHaveTitle(/little question/i);
    await context.close();

    // The private link also asks for the PIN on a device without a session.
    const other = await browser.newContext();
    const direct = await other.newPage();
    await direct.goto(`/e/${token}`);
    await expect(direct.getByTestId('pin-gate')).toBeVisible();
    await other.close();
  });
});

test('a surprise that opens later shows a countdown instead', async ({ page }) => {
  const api = await creatorApi('alice');
  const { id, token } = await createPublished(api, 'date-invitation');
  const opensAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const res = await api.put(`/bff/api/v1/experiences/${id}/access`, { data: { opensAt } });
  expect(res.status()).toBe(200);

  await page.goto(`/e/${token}`);
  await expect(page.getByTestId('opening-soon')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not yet!' })).toBeVisible();
  await expect(page.getByRole('timer')).toContainText(/\d+d/);
});
