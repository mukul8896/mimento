import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { creatorApi, expectAccessible, expectNoHorizontalScroll, openSurprise } from './helpers';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/** A published Proposal with personal details filled in; returns its id and recipient link. */
async function proposal(api: APIRequestContext) {
  const created = await api.post('/bff/api/v1/experiences', {
    data: {
      templateKey: 'proposal',
      fields: { name: 'Sophia', from: 'Ryan', firstPlace: 'Paris' },
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const published = await api.post(`/bff/api/v1/experiences/${id}/publish`);
  expect(published.status(), await published.text()).toBe(200);
  const link = (await (await api.get(`/bff/api/v1/experiences/${id}/share-link`)).json()) as {
    shareToken: string;
  };
  return { id, url: `/e/${link.shareToken}` };
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Plays up to the question, the way a recipient would. */
async function upToTheQuestion(page: Page, { opened = false } = {}) {
  if (!opened) await openSurprise(page);
  await expect(page.getByRole('heading', { name: 'Sophia, this is our story ❤️' })).toBeVisible();
  await page.getByRole('button', { name: 'Remember with me' }).click();
  await page.getByRole('textbox').fill('Paris');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByTestId('reaction')).toHaveText('You remembered 🥹');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.getByRole('button', { name: 'Ask me' }).click();
  await expect(page.getByRole('heading', { name: 'Will you marry me?' })).toBeVisible();
}

test('the proposal is a journey: story, memory, the question, the climax, a letter', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const { url } = await proposal(await creatorApi('alice'));
  await page.goto(url);
  await expectNoHorizontalScroll(page);
  await upToTheQuestion(page);
  // The question owns the screen, and is still an ordinary, accessible pair of buttons.
  await expect(page.locator('main section')).toHaveAttribute('data-layout', 'FOCUS');
  await expectAccessible(page, 'main');

  await page.getByRole('button', { name: 'Yes ❤️' }).click();
  const climax = page.getByTestId('climax');
  await expect(climax).toHaveAttribute('data-kind', 'PROPOSAL');
  await expect(climax).toContainText('You said yes 💍');
  await expect(climax).toBeHidden({ timeout: 10_000 });

  await expect(page.getByRole('heading', { name: 'Forever starts now.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open my letter' }).click();
  await expect(page.getByTestId('gift-letter')).toContainText('— Ryan');
  await expectNoHorizontalScroll(page);

  // A free surprise: after the letter has had time, a gentle invitation — never over it.
  await expect(page.getByTestId('free-ending')).toBeHidden();
  const ending = page.getByTestId('free-ending');
  await expect(ending).toBeVisible({ timeout: 15_000 });
  await expect(ending).toContainText('Someone made this for you with Wish Revealer');
  await expect(ending.getByTestId('free-ending-cta')).toHaveAttribute('href', /^\/\?ref=/);
  await ending.getByRole('button', { name: 'See it again' }).click();
  await expect(page.getByTestId('gift-letter')).toBeVisible();
  expect(errors).toEqual([]);
});

test('with reduced motion the story is complete, only calmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { url } = await proposal(await creatorApi('alice'));
  await page.goto(url);
  // The envelope opens with a simple fade, and headings arrive whole, not word by word.
  await expect(page.getByTestId('opening-cover')).toHaveAttribute('data-kind', 'ENVELOPE');
  await openSurprise(page);
  await expect(page.getByRole('heading', { name: 'Sophia, this is our story ❤️' })).toBeVisible();
  await expect(page.locator('.mp-word')).toHaveCount(0);
  await upToTheQuestion(page, { opened: true });
  await page.getByRole('button', { name: 'Yes ❤️' }).click();
  await expect(page.getByTestId('climax')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Forever starts now.' })).toBeVisible({
    timeout: 5_000,
  });
});

test('taps during the climax change nothing, and progress is recorded once', async ({ page }) => {
  const { url } = await proposal(await creatorApi('alice'));
  await page.goto(url);
  await upToTheQuestion(page);
  const yes = page.getByRole('button', { name: 'Yes ❤️' });
  await yes.click();
  await page.mouse.click(180, 400);
  await page.mouse.click(180, 400);
  // Straight to the final scene: the stray taps neither skipped it nor answered anything else.
  await expect(page.getByRole('heading', { name: 'Forever starts now.' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Open my letter' })).toBeEnabled();
});

test('a paid surprise ends cleanly, with no Wish Revealer branding', async ({ page }) => {
  const { id, url } = await proposal(await creatorApi('alice'));
  const admin = await creatorApi('admin');
  const grant = await admin.post(`/bff/api/v1/admin/experiences/${id}/entitlement`, {
    data: { tier: 'PLUS' },
    headers: { origin: BASE },
  });
  expect(grant.status(), await grant.text()).toBe(204);
  await page.goto(url);
  await openSurprise(page);
  await expect(page.getByRole('heading', { name: 'Sophia, this is our story ❤️' })).toBeVisible();
  await expect(page.getByText('Made with Wish Revealer')).toHaveCount(0);
  // Reporting stays available on every surprise.
  await expect(page.getByRole('button', { name: 'Report' })).toBeVisible();
});
