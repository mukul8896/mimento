import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, startFresh, useTemplate } from './helpers';
import { authFile } from './users';

test.use({ storageState: authFile('alice') });

/** The Publish button that is on screen: the sticky bar on phones, the side panel on desktop. */
const publishButton = (page: Page) => page.getByRole('button', { name: 'Publish', exact: true });

const saved = (page: Page) =>
  expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });

test('creator personalises a template in its preview and publishes in minutes', async ({
  page,
}) => {
  const started = Date.now();
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Create' })
    .click();
  await expectAccessible(page);
  await useTemplate(page, /Date invitation/);
  await expect(page).toHaveURL(/\/personalize$/);

  // Tap the heading in the preview, change it, and watch the preview follow.
  const preview = page.getByTestId('preview');
  await preview.locator('[data-editable="Heading"]').click();
  const heading = page.getByRole('dialog').getByRole('textbox', { name: 'Heading' });
  await expect(heading).toBeFocused();
  await heading.fill('Hi Sam 👋');
  // The preview follows while typing (behind the sheet, so not in the accessibility tree yet).
  await expect(preview.locator('h2', { hasText: 'Hi Sam 👋' })).toBeVisible();
  await page.getByTestId('step-done').click();
  await expect(preview.getByRole('heading', { name: 'Hi Sam 👋' })).toBeVisible();
  await saved(page);
  await expectNoHorizontalScroll(page);

  // A template keeps its structure: no way to add, move or delete steps here.
  await expect(page.getByRole('button', { name: '+ Add step' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Move step/ })).toHaveCount(0);
  await expect(page.getByTestId('pro-card')).toContainText('Want to change the experience itself?');

  // Button labels are edited the same way, on any step.
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByTestId('step-position')).toContainText('Step 2');
  await preview.locator('[data-editable="Yes label"]').click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Yes label' }).fill('Absolutely!');
  await page.getByTestId('step-done').click();
  await expect(preview.getByRole('button', { name: 'Absolutely!' })).toBeVisible();
  await expectAccessible(page);

  // Play it as they will: from the start, with the real buttons working.
  await page.getByTestId('mode-play').click();
  await expect(preview.getByRole('heading', { name: 'Hi Sam 👋' })).toBeVisible();

  await saved(page);
  await publishButton(page).click();
  await expect(page.getByTestId('publish-summary')).toContainText('Opens right away');
  await page.getByTestId('confirm-publish').click();

  // Your Surprise Is Ready: the link to share, and the private link to keep.
  await expect(page).toHaveURL(/\/published$/);
  await expect(page.getByRole('heading', { name: 'Your Surprise Is Ready!' })).toBeVisible();
  const link = page.getByTestId('recipient-link');
  await expect(link).toHaveValue(/\/e\/[A-Za-z0-9_-]{43}$/);
  const url = await link.inputValue();
  const privateLink = page.getByTestId('private-link');
  await expect(privateLink).toHaveValue(/\/m\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId('private-link-warning')).toContainText(
    'We may not be able to restore access if you lose it.',
  );
  expect(Date.now() - started).toBeLessThan(5 * 60_000);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  // Download Details: a small text file with both links and the warning.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-details').click(),
  ]);
  expect(download.suggestedFilename()).toBe('wishrevealer-a-little-question-for-you.txt');
  const text = await (await download.createReadStream()).toArray();
  const details = Buffer.concat(text).toString('utf8');
  expect(details).toContain(url);
  expect(details).toContain(await privateLink.inputValue());
  expect(details).toContain('keep this one private');

  // Saving it ticks the box; Done goes to Manage Surprise for this one surprise.
  await expect(page.getByTestId('saved-confirm')).toBeChecked();
  await page.getByTestId('success-done').click();
  await expect(page).toHaveURL(/\/experiences\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Manage Surprise')).toBeVisible();

  const recipient = await page.context().browser()!.newPage();
  await recipient.goto(url);
  await expect(recipient.getByRole('heading', { name: 'Hi Sam 👋' })).toBeVisible();
  await expect(recipient.locator('[data-editable]')).toHaveCount(0);
  await recipient.close();
});

test('Customize with PRO opens the full builder with everything personalised', async ({ page }) => {
  await page.goto('/new');
  await useTemplate(page, /Date invitation/);
  await expect(page).toHaveURL(/\/personalize$/);
  await page.getByTestId('preview').locator('[data-editable="Heading"]').click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Heading' }).fill('Hi Sam 👋');
  await page.getByTestId('step-done').click();

  await page.getByTestId('customize-with-pro').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByTestId('plus-pro')).toBeVisible();
  await expect(sheet).toContainText('The original template stays exactly as it is');
  await sheet.getByTestId('confirm-customize').click();
  await expect(page).toHaveURL(/\/edit$/);

  // The same screen, with the building tools: add, move, duplicate, delete.
  await expect(page.getByTestId('builder')).toBeVisible();
  await expect(
    page.getByTestId('preview').getByRole('heading', { name: 'Hi Sam 👋' }),
  ).toBeVisible();
  const chips = page
    .getByRole('navigation', { name: 'Steps' })
    .getByRole('button', { name: /^Step \d/ });
  await expect(chips).toHaveCount(5);
  await chips.nth(1).click();
  await page.getByTestId('edit-step').click();
  const tools = page.getByTestId('step-tools');
  await tools.getByRole('button', { name: 'Move step later' }).click();
  await expect(page.getByRole('dialog')).toContainText('Step 3 ·');
  await tools.getByRole('button', { name: 'Move step earlier' }).click();
  await expect(page.getByRole('dialog')).toContainText('Step 2 ·');
  await tools.getByRole('button', { name: /Duplicate/ }).click();
  await page.getByTestId('step-done').click();
  await expect(chips).toHaveCount(6);
  await chips.nth(1).click();
  await page.getByTestId('edit-step').click();
  await tools.getByRole('button', { name: /Delete/ }).click();
  await page.getByTestId('confirm-delete-step').click();
  await expect(chips).toHaveCount(5);
  await page.getByTestId('add-step').click();
  await page
    .getByTestId('step-types')
    .getByRole('button', { name: /Photo gallery/ })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Photo gallery');
  await page.getByTestId('step-done').click();
  await expect(chips).toHaveCount(6);
  await expectNoHorizontalScroll(page);
  await saved(page);

  // The personalise page is gone for this surprise: it stays a PRO build.
  const id = page.url().split('/').at(-2);
  await page.goto(`/experiences/${id}/personalize`);
  await expect(page).toHaveURL(/\/edit$/);

  // The empty gallery blocks publishing; Fix opens that step, where it can be removed.
  await publishButton(page).click();
  const issues = page.getByTestId('publish-issues');
  await expect(issues).toContainText('Photo gallery');
  await issues
    .getByRole('button', { name: /Photo gallery/ })
    .first()
    .click();
  await page
    .getByTestId('step-tools')
    .getByRole('button', { name: /Delete/ })
    .click();
  await page.getByTestId('confirm-delete-step').click();
  await saved(page);

  await publishButton(page).click();
  await page.getByTestId('confirm-publish').click();
  await expect(page.getByTestId('recipient-link')).toHaveValue(/\/e\//);
});

test('Create from Scratch starts the builder, and publishing lists what is missing', async ({
  page,
}) => {
  await page.goto('/new');
  await startFresh(page, () => page.getByTestId('create-from-scratch').click());
  await expect(page).toHaveURL(/\/edit$/);
  await publishButton(page).click();
  await expect(page.getByTestId('publish-issues')).toContainText('Add at least one step');
});

test('a template opens in Personalize, and its builder address sends people back there', async ({
  page,
}) => {
  await page.goto('/new');
  await useTemplate(page, /Date invitation/);
  await expect(page).toHaveURL(/\/personalize$/);
  const id = page.url().split('/').at(-2);
  await page.goto(`/experiences/${id}/edit`);
  await expect(page).toHaveURL(/\/personalize$/);

  // Any step can be opened from the step strip; the preview starts there.
  await page.getByRole('button', { name: /Step 4 · Scratch card/ }).click();
  await page.getByTestId('edit-step').click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Instructions' }).fill('Scratch it');
  await page.getByTestId('step-done').click();
  await expect(
    page.getByTestId('preview').getByRole('heading', { name: 'Scratch it' }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('browsing templates is free; only changed ones are kept, one per template', async ({
  page,
}) => {
  const inProgress = async () =>
    (
      (await (await page.request.get('/bff/api/v1/experiences/in-progress')).json()) as {
        items: { id: string; templateKey: string | null }[];
      }
    ).items;
  await page.goto('/new');
  await useTemplate(page, /Date invitation/);
  await expect(page).toHaveURL(/\/personalize$/);
  const dateKeys = (await inProgress()).filter((i) => i.templateKey === 'date-invitation');

  // Looking without changing anything leaves nothing behind and asks nothing next time.
  await page.goto('/new');
  await page
    .getByRole('button', { name: /Anniversary/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/personalize$/);
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  expect((await inProgress()).filter((i) => i.templateKey === 'anniversary')).toEqual([]);

  // Change it: now it is kept and shown, and moving to another template still asks nothing.
  await page.getByTestId('preview').locator('[data-editable="Heading"]').click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Heading' }).fill('Our story');
  await page.getByTestId('step-done').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
    timeout: 10_000,
  });
  const edited = page.url();
  await page.goto('/new');
  // The template's own tile says so; there is no separate list.
  await expect(page.getByTestId('in-progress')).toHaveCount(0);
  await expect(
    page.getByTestId('template-anniversary').getByTestId('in-progress-badge'),
  ).toContainText('In progress · edited');
  await page
    .getByRole('button', { name: /Date invitation/ })
    .first()
    .click();
  if (dateKeys.length === 0) await expect(page).toHaveURL(/\/personalize$/);

  // Back to the one they changed: Continue, or Start over.
  await page.goto('/new');
  await page
    .getByRole('button', { name: /Anniversary/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'You’ve already started this one' });
  await sheet.getByTestId('continue-in-progress').click();
  await expect(page).toHaveURL(edited);

  await page.goto('/new');
  await page
    .getByRole('button', { name: /Anniversary/ })
    .first()
    .click();
  await page.getByTestId('start-over').click();
  await expect(page).toHaveURL(/\/personalize$/);
  expect(page.url()).not.toBe(edited);
  const oldId = edited.split('/').at(-2);
  expect((await page.request.get(`/bff/api/v1/experiences/${oldId}`)).status()).toBe(404);
  // The fresh one is unchanged, so it is not counted either.
  expect((await inProgress()).filter((i) => i.templateKey === 'anniversary')).toEqual([]);
});
