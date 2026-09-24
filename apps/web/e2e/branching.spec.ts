import { expect, test, type Page } from '@playwright/test';
import { continueStep, createPublished, creatorApi } from './helpers';
import { authFile } from './users';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.describe('creator', () => {
  test.use({ storageState: authFile('alice') });

  test('routes an answer, sees it in the flow, and restores an earlier version', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/new');
    await page.getByRole('button', { name: /Date invitation/ }).click();
    await expect(page).toHaveURL(/\/edit$/);

    // "No" on the date question ends the experience.
    await page
      .getByTestId('step-list')
      .getByRole('button', { name: /Yes \/ No/ })
      .click();
    const routes = page.getByTestId('route-editor');
    await expect(routes.getByRole('heading', { name: 'What happens next' })).toBeVisible();
    await routes
      .getByLabel('If they answer “No”')
      .selectOption({ label: 'End the experience here' });
    await expect(page.getByTestId('step-list').getByText('↳ branches')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });

    // The flow view draws the branch to the end (React Flow must not break the strict CSP).
    await page.getByTestId('toggle-flow').click();
    const flow = page.getByTestId('flow-view');
    await expect(flow.getByText('End', { exact: true })).toBeVisible();
    await expect(flow.getByText('No', { exact: true })).toBeVisible();

    // It survives a reload.
    await page.reload();
    await page
      .getByTestId('step-list')
      .getByRole('button', { name: /Yes \/ No/ })
      .click();
    await expect(page.getByTestId('route-editor').getByLabel('If they answer “No”')).toHaveValue(
      'END',
    );

    // Publish, remove the branch, then restore version 1 from history.
    await page.getByTestId('publish').click();
    await page.getByTestId('confirm-publish').click();
    await expect(page.getByTestId('share-link')).toBeVisible();
    await page.keyboard.press('Escape');
    await page
      .getByTestId('route-editor')
      .getByLabel('If they answer “No”')
      .selectOption({ label: 'Follow the rule below' });
    await expect(page.getByTestId('step-list').getByText('↳ branches')).toHaveCount(0);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });
    await page.getByTestId('open-history').click();
    await page.getByTestId('version-list').getByRole('button', { name: 'Restore…' }).click();
    await page.getByRole('button', { name: 'Restore version 1' }).click();
    await expect(page.getByTestId('step-list').getByText('↳ branches')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test('a recipient who says No reaches the end without the gift', async ({ page }) => {
  const { token } = await createPublished(await creatorApi('alice'), 'date-invitation', (draft) => {
    const ask = draft.steps.find((s) => s.type === 'YES_NO_CHOICE')!;
    ask.config = { ...ask.config, noButton: { mode: 'IMMEDIATE' } };
    (ask as { next?: object }).next = {
      rules: [{ when: { kind: 'ANSWER', equals: 'NO' }, goto: 'END' }],
      otherwise: null,
    };
  });

  await page.goto(`/e/${token}`);
  await continueStep(page);
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s everything' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reveal/ })).toHaveCount(0);

  // Someone else who says Yes carries on to the next step.
  const other = await page.context().browser()!.newPage();
  await other.goto(`/e/${token}`);
  await continueStep(other);
  await other.getByRole('button', { name: 'Yes!' }).click();
  await expect(other.getByRole('group', { name: 'Pick the vibe' })).toBeVisible();
  await other.close();
});
