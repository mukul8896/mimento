import { expect, test, type Page } from '@playwright/test';
import { creatorApi, expectAccessible, expectNoHorizontalScroll } from './helpers';
import { authFile } from './users';

test.use({ storageState: authFile('alice') });

async function personalizing(page: Page, templateKey = 'date-invitation') {
  const api = await creatorApi('alice');
  const created = await api.post('/bff/api/v1/experiences', { data: { templateKey } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  await page.goto(`/experiences/${id}/personalize`);
  await expect(page.getByTestId('player')).toBeVisible();
  return id;
}

test('Publish is on screen the whole time, however far down the page you are', async ({ page }) => {
  await personalizing(page);
  const publish = page.getByRole('button', { name: 'Publish', exact: true });
  await expect(publish).toBeInViewport();
  await page.mouse.wheel(0, 3000);
  await expect(page.getByTestId('pro-card')).toBeInViewport();
  await expect(publish).toBeInViewport();
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);
});

test('opening time, PIN and short link are set from the same page', async ({ page, browser }) => {
  await personalizing(page);
  await page.getByTestId('edit-pin').click();
  const sheet = page.getByRole('dialog', { name: 'Delivery & Privacy' });
  // Nothing grabs focus, so a phone does not pop up the keyboard or a date picker.
  await expect(sheet.getByLabel('Opening date and time (optional)')).not.toBeFocused();
  await expect(sheet).toContainText('Share the PIN separately from the link.');
  await expect(sheet).toContainText('Anyone could guess this address');
  await expect(sheet.getByLabel('Short link name')).toBeDisabled();
  await expectAccessible(page, '[role="dialog"]');

  await sheet.getByLabel('PIN', { exact: true }).fill('2412');
  await sheet.getByRole('button', { name: 'Set PIN' }).click();
  await expect(sheet.getByRole('heading', { name: /PIN · On/ })).toBeVisible();
  const slug = `p-${Date.now().toString(36)}`;
  await sheet.getByLabel('Short link name').fill(slug);
  await sheet.getByRole('button', { name: 'Save link' }).click();
  await expect(sheet.getByTestId('short-link')).toHaveValue(`/p/${slug}`);

  const opensAt = new Date(Date.now() + 3 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  await sheet
    .getByLabel('Opening date and time (optional)')
    .fill(
      `${opensAt.getFullYear()}-${pad(opensAt.getMonth() + 1)}-${pad(opensAt.getDate())}T09:00`,
    );
  await sheet.getByRole('button', { name: 'Save opening time' }).click();
  await expect(sheet.getByRole('button', { name: 'Open now' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();

  // The page summarises it, and Publish shows it again before anything is shared.
  await expect(page.getByTestId('edit-pin')).toContainText('On');
  await expect(page.getByTestId('edit-short-link')).toContainText(`/p/${slug}`);
  await expect(page.getByTestId('edit-opens-at')).not.toContainText('Right away');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('publish-summary')).toContainText('Protected with a PIN');
  await page.getByTestId('confirm-publish').click();
  const success = page.getByTestId('published-success');
  await expect(success).toContainText(`/p/${slug}`);
  await expect(success).toContainText('Send the PIN separately from the link.');

  // Before the opening time the recipient sees a countdown, even after the PIN.
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(`/p/${slug}`);
  await recipient.getByLabel('Enter the PIN you were given').fill('2412');
  await recipient.getByRole('button', { name: 'Open' }).click();
  await expect(recipient.getByText(/opens|not yet/i).first()).toBeVisible();
  await context.close();
});

test('a template keeps its answer choices while their words change', async ({ page }) => {
  await personalizing(page);
  await page.getByRole('button', { name: /Step 3 · Question/ }).click();
  await page.getByTestId('preview').locator('[data-editable="Answer 1"]').click();
  const sheet = page.getByRole('dialog');
  const answer = sheet.getByRole('textbox', { name: 'Answer 1', exact: true });
  await expect(answer).toBeFocused();
  await answer.fill('Street food crawl');
  // Only the tapped field is shown; the rest of the step is one tap away.
  await expect(sheet.getByRole('textbox', { name: 'Question' })).toBeHidden();
  await sheet.getByTestId('show-all-fields').click();
  await expect(sheet.getByRole('textbox', { name: 'Question' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add answer' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Remove answer/ })).toHaveCount(0);
  await sheet.getByTestId('step-done').click();
  await expect(page.getByTestId('preview')).toContainText('Street food crawl');
});

test('music is chosen and previewed from its own sheet', async ({ page }) => {
  await personalizing(page);
  await page.getByTestId('edit-music').click();
  const sheet = page.getByRole('dialog', { name: 'Music' });
  await sheet.getByTestId('music-JINGLE').click();
  await expect(sheet.getByTestId('music-JINGLE')).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('edit-music')).toContainText('Jingle');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });
});

test('Create Experience explains PLUS and PRO at a glance', async ({ page }) => {
  await page.goto('/new');
  await expect(page.getByRole('heading', { name: 'Create Experience' })).toBeVisible();
  await expect(page.getByTestId('create-from-scratch')).toContainText('PRO');
  await expect(page.getByTestId('plus-pro')).toContainText('Add or remove steps');
  await expectNoHorizontalScroll(page);
});
