import { expect, test, type Page } from '@playwright/test';
import { createPublished, creatorApi, useTemplate } from './helpers';
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
  test('create, personalize, published and editor run without CSP violations or errors', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/new');
    await useTemplate(page, /Birthday surprise/);
    await expect(page.getByTestId('personalize')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
    // Sheets lock scrolling; that must not rely on injected inline <style> tags.
    await page.getByTestId('edit-music').click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByTestId('confirm-publish').click();
    await expect(page.getByTestId('private-link')).toHaveValue(/\/m\//);
    await page.goBack();
    // The PRO builder (React Flow and the rich-text editor) too.
    await page.getByTestId('customize-with-pro').click();
    await page.getByTestId('confirm-customize').click();
    await expect(page.getByTestId('builder')).toBeVisible();
    await page.getByTestId('build-flow').click();
    await expect(page.getByTestId('flow-view')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
