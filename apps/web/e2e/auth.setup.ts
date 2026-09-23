import { expect, test as setup } from '@playwright/test';
import { authFile, OPERATOR_TOKEN, USERS, type UserName } from './users';

/**
 * No sign-in flow exists any more. Visiting a creator route mints an anonymous owner cookie,
 * which is the whole identity; the operator posts the ADMIN_TOKEN instead.
 */
for (const name of Object.keys(USERS) as UserName[]) {
  setup(`start a session as ${name}`, async ({ page }) => {
    if (USERS[name].operator) {
      await page.goto('/operator');
      await page.locator('#token').fill(OPERATOR_TOKEN);
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page).toHaveURL(/\/admin/);
    } else {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Your experiences' })).toBeVisible();
    }
    await page.context().storageState({ path: authFile(name) });
  });
}
