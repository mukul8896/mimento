import { expect, test, type Page } from '@playwright/test';
import { createPublished, creatorApi } from './helpers';
import { authFile } from './users';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('recipient player runs without CSP violations or console errors', async ({ page }) => {
  const { token } = await createPublished(await creatorApi('alice'), 'date-invitation');
  const errors = collectErrors(page);
  await page.goto(`/e/${token}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Yes!' }).click();
  await expect(page.getByLabel('Sunset picnic')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('creator pages', () => {
  test.use({ storageState: authFile('alice') });
  test('dashboard and editor run without CSP violations or console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/dashboard');
    await page.goto('/new');
    await page.getByRole('button', { name: /Birthday surprise/ }).click();
    await expect(page.getByTestId('step-list')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
    // Dialogs lock scrolling; that must not rely on injected inline <style> tags.
    await page.getByTestId('publish').click();
    await page.getByTestId('confirm-publish').click();
    await expect(page.getByTestId('share-link')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});
