import { expect, test, type Page } from '@playwright/test';
import {
  continueStep,
  createPublished,
  creatorApi,
  expectAccessible,
  expectNoHorizontalScroll,
  openSurprise,
  publishedYesNo,
} from './helpers';

async function openFresh(page: Page, token: string, { open = true } = {}) {
  await page.goto(`/e/${token}`);
  await expect(page.getByTestId('player')).toBeVisible();
  if (open) await openSurprise(page);
}

test('recipient completes the date invitation without horizontal scrolling', async ({ page }) => {
  const api = await creatorApi('alice');
  const { token } = await createPublished(api, 'date-invitation');
  await openFresh(page, token, { open: false });
  // The opening cover: who sees the answers is said before anything is answered.
  await expect(page.getByTestId('opening-cover')).toHaveAttribute('data-kind', 'ENVELOPE');
  await expect(page.getByText('Your answers will be shared')).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await openSurprise(page);
  await expectNoHorizontalScroll(page);
  await continueStep(page);

  // Yes/No step (AFTER_ATTEMPTS in this template) — answer Yes.
  await expect(page.getByRole('heading', { name: 'Will you go on a date with me?' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Yes!' }).click();

  await page.getByLabel('Sunset picnic').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Scratch card: the accessible alternative reveals the content without a pointer.
  await page.getByRole('button', { name: 'Reveal without scratching' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('scratch-content')).toContainText('Saturday at 7pm');
  await continueStep(page);

  await page.getByRole('button', { name: 'Show me the plan' }).click();
  await expect(page.getByTestId('gift-revealed')).toContainText('I will pick you up at 7');
  await expectNoHorizontalScroll(page);
  await expectAccessible(page);

  // Refreshing resumes the same session and the gift can be viewed again.
  await page.reload();
  // Coming back part-way, the cover welcomes them back (and the tap brings the sound back).
  await expect(page.getByRole('button', { name: 'Continue your surprise' })).toBeVisible();
  await openSurprise(page);
  await expect(page.getByRole('button', { name: 'Show me the plan' })).toBeVisible();
});

test.describe('configurable No button', () => {
  test('IMMEDIATE: No submits straight away (keyboard)', async ({ page }) => {
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'IMMEDIATE' },
    });
    await openFresh(page, token);
    await page.getByTestId('no-button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Show me the plan' })).toBeVisible();
  });

  test('AFTER_ATTEMPTS: No dodges the configured number of times, then works', async ({ page }) => {
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'AFTER_ATTEMPTS', attempts: 2 },
    });
    await openFresh(page, token);
    const no = page.getByTestId('no-button');
    await expect(no).toHaveAttribute('aria-disabled', 'true');
    for (let i = 0; i < 2; i++) {
      await no.focus();
      await page.keyboard.press('Enter');
    }
    await expect(no).toHaveAttribute('data-clickable', 'true');
    await no.click();
    await expect(page.getByRole('button', { name: 'Show me the plan' })).toBeVisible();
  });

  test('AFTER_DELAY: No becomes clickable after the delay', async ({ page }) => {
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'AFTER_DELAY', delaySeconds: 2 },
    });
    await openFresh(page, token);
    const no = page.getByTestId('no-button');
    await expect(no).toHaveAttribute('data-clickable', 'false');
    await expect(no).toHaveAttribute('data-clickable', 'true', { timeout: 5_000 });
    await no.click();
    await expect(page.getByRole('button', { name: 'Show me the plan' })).toBeVisible();
  });

  test('EVASIVE: No can never be chosen, but Close always works', async ({ page }) => {
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'EVASIVE' },
    });
    await openFresh(page, token);
    const no = page.getByTestId('no-button');
    for (let i = 0; i < 5; i++) {
      await no.focus();
      await page.keyboard.press('Enter');
    }
    await expect(no).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByRole('heading', { name: 'Will you go on a date with me?' }),
    ).toBeVisible();

    // The Close control is never covered by the evasive button.
    const close = page.getByTestId('close-experience');
    await close.click();
    await expect(page.getByTestId('closed-screen')).toBeVisible();
  });

  test('touch: an evasive No dodges taps instead of submitting', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch semantics are exercised on the mobile project');
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'EVASIVE' },
    });
    await openFresh(page, token);
    const no = page.getByTestId('no-button');
    // Each tap sends it clearly away — a real dodge, not a dead button that barely moves.
    for (let i = 0; i < 2; i++) {
      const before = (await no.boundingBox())!;
      await no.tap({ force: true });
      await page.waitForTimeout(450);
      const after = (await no.boundingBox())!;
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(60);
      await expect(no).toHaveCSS('opacity', '1');
    }
    await expect(
      page.getByRole('heading', { name: 'Will you go on a date with me?' }),
    ).toBeVisible();
    await page.getByTestId('close-experience').tap();
    await expect(page.getByTestId('closed-screen')).toBeVisible();
  });

  test('Maybe is offered when enabled and records MAYBE', async ({ page }) => {
    const api = await creatorApi('alice');
    const { id, token } = await publishedYesNo(api, {
      maybeEnabled: true,
      noButton: { mode: 'IMMEDIATE' },
    });
    await openFresh(page, token);
    await page.getByRole('button', { name: 'Maybe' }).click();
    await expect(page.getByRole('button', { name: 'Show me the plan' })).toBeVisible();
    const results = await (await api.get(`/bff/api/v1/experiences/${id}/results`)).json();
    const choice = results.steps.find((s: { type: string }) => s.type === 'YES_NO_CHOICE');
    expect(choice.tallies).toEqual([{ value: 'MAYBE', label: 'Maybe', count: 1 }]);
  });

  test('with reduced motion the evasive No does not move', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const { token } = await publishedYesNo(await creatorApi('alice'), {
      noButton: { mode: 'EVASIVE' },
    });
    await openFresh(page, token);
    const no = page.getByTestId('no-button');
    // Position relative to its container (viewport boxes change when the page scrolls).
    const offset = () =>
      no.evaluate((el: HTMLElement) => ({
        left: el.offsetLeft,
        top: el.offsetTop,
        position: getComputedStyle(el).position,
      }));
    const before = await offset();
    await no.hover();
    await no.click({ force: true });
    const after = await offset();
    expect(after).toEqual(before);
    expect(after.position).not.toBe('absolute');
    await expect(page.getByRole('status').filter({ hasText: 'Are you sure?' })).toBeVisible();
    await context.close();
  });
});

test('closing records no answer at all', async ({ page }) => {
  const api = await creatorApi('alice');
  const { id, token } = await publishedYesNo(api, { noButton: { mode: 'IMMEDIATE' } });
  await openFresh(page, token);
  await page.getByTestId('close-experience').click();
  await expect(page.getByTestId('closed-screen')).toContainText('Nothing was answered');
  const results = await (await api.get(`/bff/api/v1/experiences/${id}/results`)).json();
  expect(results.closedEarly).toBe(1);
  expect(results.steps.every((s: { tallies: unknown[] }) => s.tallies.length === 0)).toBe(true);
});

test('the gift cannot be fetched directly before the steps are complete', async ({ page }) => {
  const { token, draft } = await createPublished(await creatorApi('alice'), 'date-invitation');
  await openFresh(page, token);
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  const giftKey = draft.steps.at(-1)!.key;
  const status = await page.evaluate(
    async ({ token: t, giftKey: g }) => {
      const session = Object.entries(localStorage).find(([k]) => k.startsWith('mp:rs:'))?.[1] ?? '';
      const res = await fetch(`/bff/api/v1/public/experiences/${t}/session/gift`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-recipient-session': session },
        body: JSON.stringify({ stepKey: g }),
      });
      return { status: res.status, body: await res.text() };
    },
    { token, giftKey },
  );
  expect(status.status).toBe(403);
  expect(status.body).not.toContain('pick you up');
  expect(await page.content()).not.toContain('pick you up');
});

test('disabled and expired links show the same neutral page', async ({ page }) => {
  const api = await creatorApi('alice');
  const disabled = await createPublished(api, 'birthday-surprise');
  await api.post(`/bff/api/v1/experiences/${disabled.id}/disable`);
  const expired = await createPublished(api, 'birthday-surprise');
  await api.post(`/bff/api/v1/experiences/${expired.id}/expire`);

  for (const token of [disabled.token, expired.token, 'A'.repeat(43)]) {
    const response = await page.goto(`/e/${token}`);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    await expect(page.getByTestId('unavailable')).toBeVisible();
    await expect(page.getByTestId('unavailable')).toHaveText(/isn’t available/);
  }
});

test('recipient can report the page', async ({ page }) => {
  const { token } = await createPublished(await creatorApi('alice'), 'anniversary');
  await openFresh(page, token);
  await page.getByRole('button', { name: 'Report' }).click();
  await page.getByLabel('Reason').selectOption('SCAM_OR_FRAUD');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Thank you. Our team will review this page.')).toBeVisible();
});
