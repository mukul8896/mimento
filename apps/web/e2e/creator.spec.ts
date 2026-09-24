import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll } from './helpers';
import { authFile } from './users';

test.use({ storageState: authFile('alice') });

test('creator builds from a template, edits, previews and publishes in minutes', async ({
  page,
  isMobile,
}) => {
  const started = Date.now();
  await page.goto('/dashboard');
  await expectAccessible(page);
  await page.getByRole('link', { name: 'New experience' }).click();
  await page.getByRole('button', { name: /Date invitation/ }).click();
  await expect(page).toHaveURL(/\/edit$/);

  // Edit the first step's heading and wait for autosave.
  if (isMobile) await page.getByRole('button', { name: 'Steps', exact: true }).click();
  await page
    .getByTestId('step-list')
    .getByRole('button', { name: /1\. Message/ })
    .click();
  const heading = page.getByRole('textbox', { name: 'Heading' });
  await heading.fill('Hi Sam 👋');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });
  await expectNoHorizontalScroll(page);

  // Reorder and duplicate work from the step list.
  if (isMobile) await page.getByRole('button', { name: 'Steps', exact: true }).click();
  await page.getByRole('button', { name: 'Move step 2 down' }).click();
  await page.getByRole('button', { name: 'Move step 3 up' }).click();
  await page
    .getByTestId('step-list')
    .getByRole('listitem')
    .first()
    .getByRole('button', { name: 'Duplicate' })
    .click();
  await expect(page.getByTestId('step-list').getByRole('listitem')).toHaveCount(6);
  if (isMobile) await page.getByRole('button', { name: 'Steps', exact: true }).click();
  await page
    .getByTestId('step-list')
    .getByRole('listitem')
    .nth(1)
    .getByRole('button', { name: 'Delete' })
    .click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(page.getByTestId('step-list').getByRole('listitem')).toHaveCount(5);

  // Preview renders the edited heading without contacting the recipient API.
  if (isMobile) await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(
    page.getByTestId('preview').getByRole('heading', { name: 'Hi Sam 👋' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'desktop' }).click();
  await expect(page.getByTestId('preview').getByTestId('player')).toBeVisible();

  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });
  await page.getByTestId('publish').click();
  await page.getByTestId('confirm-publish').click();
  const link = page.getByTestId('share-link');
  await expect(link).toHaveValue(/\/e\/[A-Za-z0-9_-]{43}$/);
  expect(Date.now() - started).toBeLessThan(5 * 60_000);

  const url = await link.inputValue();
  const recipient = await page.context().browser()!.newPage();
  await recipient.goto(url);
  await expect(recipient.getByRole('heading', { name: 'Hi Sam 👋' })).toBeVisible();
  await recipient.close();
});

test('publishing is blocked with actionable issues for an incomplete blank draft', async ({
  page,
}) => {
  await page.goto('/new');
  await page.getByRole('button', { name: /Blank/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByTestId('publish').click();
  await page.getByTestId('confirm-publish').click();
  await expect(page.getByTestId('publish-issues')).toContainText('Add at least one step');
});

test('the preview opens on the step being edited and shows edits at once', async ({
  page,
  isMobile,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'New experience' }).click();
  await page.getByRole('button', { name: /Date invitation/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  if (isMobile) await page.getByRole('button', { name: 'Steps', exact: true }).click();
  await page.getByTestId('step-list').getByRole('button', { name: /4\. / }).click();
  await page.getByRole('textbox', { name: 'Instructions' }).fill('Scratch for our date');
  if (isMobile) await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = page.getByTestId('preview');
  await expect(preview.getByRole('heading', { name: 'Scratch for our date' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  // "Play from the start" still plays it all the way through.
  await page.getByRole('button', { name: 'Play from the start' }).click();
  await expect(preview.getByRole('heading', { name: 'Hey you 👋' })).toBeVisible();
});
