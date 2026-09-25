import { expect, test } from '@playwright/test';
import { createPublished, creatorApi, expectAccessible, expectNoHorizontalScroll } from './helpers';
import { authFile } from './users';

// Payment providers review these pages before activating an account, so they must exist,
// link to each other and work on a phone.
const PAGES = [
  { path: '/pricing', heading: 'Pricing' },
  { path: '/terms', heading: 'Terms of service' },
  { path: '/privacy', heading: 'Privacy policy' },
  { path: '/refunds', heading: 'Refund and cancellation policy' },
  { path: '/contact', heading: 'Contact us' },
];

for (const { path, heading } of PAGES) {
  test(`${path} is reachable, accessible and fits a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const footer = page.getByRole('navigation', { name: 'Site' });
    for (const other of PAGES) {
      await expect(footer.locator(`a[href="${other.path}"]`)).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
}

test('the home page links to pricing and the policies', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Site' }).locator('a[href="/refunds"]'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Pricing' }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByTestId('price-FREE')).toHaveText('Free');
});

test.describe('checkout return page', () => {
  test.use({ storageState: authFile('alice') });

  test('explains itself instead of failing when the order is unknown', async ({ page }) => {
    const { id } = await createPublished(await creatorApi('alice'), 'date-invitation');
    await page.goto(
      `/experiences/${id}/checkout?order=00000000-0000-4000-8000-000000000000&email=someone%40example.com`,
    );
    await expect(page.getByTestId('checkout-return')).toHaveAttribute('data-state', 'error');
    await expect(page.getByRole('link', { name: 'Back to my surprise' })).toHaveAttribute(
      'href',
      `/experiences/${id}/personalize`,
    );
    await expect(page.getByTestId('checkout-return')).toContainText('Nothing is lost');
    // The provider-appended email does not stay in the address bar.
    expect(page.url()).not.toContain('email');
  });
});
