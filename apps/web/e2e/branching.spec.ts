import { expect, test, type Page } from '@playwright/test';
import { continueStep, createPublished, creatorApi, openSurprise, useTemplate } from './helpers';
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
    await useTemplate(page, /Date invitation/);
    await expect(page).toHaveURL(/\/personalize$/);
    // Branching changes the flow, so it is PRO.
    await page.getByTestId('customize-with-pro').click();
    await page.getByTestId('confirm-customize').click();
    await expect(page).toHaveURL(/\/edit$/);

    // "No" on the date question ends the experience: routing lives in the step's sheet.
    const chip = () =>
      page.getByRole('navigation', { name: 'Steps' }).getByRole('button', {
        name: /Step 2 · Yes \/ No/,
      });
    const openStep = async () => {
      await chip().click();
      await page.getByTestId('edit-step').click();
    };
    await openStep();
    const routes = page.getByRole('dialog').getByTestId('route-editor');
    await expect(routes.getByRole('heading', { name: 'What happens next' })).toBeVisible();
    await routes
      .getByLabel('If they answer “No”')
      .selectOption({ label: 'End the experience here' });
    await page.getByTestId('step-done').click();
    await expect(chip()).toHaveAccessibleName(/branches/);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });

    // The flow map draws the branch to the end (React Flow must not break the strict CSP).
    await page.getByTestId('build-flow').click();
    const flow = page.getByRole('dialog').getByTestId('flow-view');
    await expect(flow.getByText('End', { exact: true })).toBeVisible();
    await expect(flow.getByText('No', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // It survives a reload.
    await page.reload();
    await openStep();
    await expect(
      page.getByRole('dialog').getByTestId('route-editor').getByLabel('If they answer “No”'),
    ).toHaveValue('END');
    await page.getByTestId('step-done').click();

    // Publish, remove the branch, then restore version 1 from history.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByTestId('confirm-publish').click();
    await expect(page.getByTestId('recipient-link')).toHaveValue(/\/e\//);
    await page.goBack();
    await openStep();
    await page
      .getByRole('dialog')
      .getByTestId('route-editor')
      .getByLabel('If they answer “No”')
      .selectOption({ label: 'Follow the rule below' });
    await page.getByTestId('step-done').click();
    await expect(chip()).not.toHaveAccessibleName(/branches/);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });
    await page.getByTestId('build-history').click();
    await page.getByTestId('version-list').getByRole('button', { name: 'Restore…' }).click();
    await page.getByRole('button', { name: 'Restore version 1' }).click();
    await expect(chip()).toHaveAccessibleName(/branches/);

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
  await openSurprise(page);
  await continueStep(page);
  await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'That’s everything' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reveal/ })).toHaveCount(0);

  // Someone else who says Yes carries on to the next step.
  const other = await page.context().browser()!.newPage();
  await other.goto(`/e/${token}`);
  await openSurprise(other);
  await continueStep(other);
  await other.getByRole('button', { name: 'Yes!' }).click();
  await expect(other.getByRole('group', { name: 'Pick the vibe' })).toBeVisible();
  await other.close();
});
