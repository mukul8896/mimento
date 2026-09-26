import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, startFresh } from './helpers';
import { authFile } from './users';

function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('landing: the hero plays a surprise, then browse and play a template', async ({ page }) => {
  const errors = consoleErrors(page);
  await page.goto('/');
  await expectNoHorizontalScroll(page);

  // The hook: one clear way in, and a real surprise playing beside it.
  const hero = page.getByTestId('hero');
  await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('hero-start')).toHaveAttribute('href', '/new');
  const demo = page.getByRole('region', { name: 'A surprise, playing' });
  await demo.scrollIntoViewIfNeeded();
  await expect(demo.getByRole('heading').first()).toBeVisible();
  await expect(demo.getByRole('button').first()).toBeEnabled();

  // Gallery: filter to festivals and play the Diwali template.
  const gallery = page.getByTestId('template-gallery');
  await page
    .getByRole('group', { name: 'Occasions' })
    .getByRole('button', { name: 'Festivals' })
    .click();
  await expect(gallery.getByTestId('template-diwali-wishes')).toBeVisible();
  await expect(gallery.getByTestId('template-proposal')).toHaveCount(0);
  await gallery.getByTestId('template-diwali-wishes').getByRole('button').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Happy Diwali, Anjali/ })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Use Template' })).toHaveAttribute(
    'href',
    '/new?template=diwali-wishes',
  );
  await page.keyboard.press('Escape');

  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test.describe('creator', () => {
  test.use({ storageState: authFile('alice') });

  test('personalises a template from a deep link and lands in its preview', async ({ page }) => {
    await startFresh(page, async () => {
      await page.goto('/new?template=diwali-wishes');
    });
    const form = page.getByTestId('personalise-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('personalise-create')).toBeDisabled(); // name is required
    await form.getByLabel('Their name').fill('Asha');
    await form.getByLabel('Your name (optional)').fill('Dev');
    await page.getByTestId('personalise-create').click();
    await expect(page).toHaveURL(/\/personalize$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Happy Diwali, Asha!');
    await expect(page.getByTestId('preview')).toContainText('Asha');
  });
});
