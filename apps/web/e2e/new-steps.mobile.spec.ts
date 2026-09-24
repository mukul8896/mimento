import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createPublished, creatorApi, expectNoHorizontalScroll } from './helpers';

function cspViolations(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text()))
      errors.push(m.text());
  });
  return errors;
}

/** The file name ends in mobile.spec.ts so it also runs on the 360px touch project. */
test('recipient plays a puzzle, countdown, video and place reveal', async ({ page }) => {
  const { token } = await createPublished(await creatorApi('alice'), 'date-invitation', (draft) => {
    const gift = draft.steps.at(-1)!;
    draft.steps = [
      {
        key: randomUUID(),
        type: 'PUZZLE',
        config: { prompt: 'Where did we first meet?', answer: 'Goa', hint: 'Beaches!' },
      },
      {
        key: randomUUID(),
        type: 'COUNTDOWN',
        config: { title: 'Our anniversary', targetAt: '2020-01-01T00:00:00.000Z' },
      },
      {
        key: randomUUID(),
        type: 'VIDEO',
        config: { title: 'Our song', url: 'https://youtu.be/dQw4w9WgXcQ' },
      },
      {
        key: randomUUID(),
        type: 'PLACE_REVEAL',
        config: { placeName: 'Marine Drive', address: 'Mumbai' },
      },
      gift,
    ];
  });
  const csp = cspViolations(page);
  await page.goto(`/e/${token}`);

  // Puzzle: the answer is checked by the server; a wrong guess keeps us here.
  await page.getByLabel('Where did we first meet?').fill('Delhi');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Not quite — try again!')).toBeVisible();
  await page.getByRole('button', { name: 'Show a hint' }).click();
  await expect(page.getByText('Beaches!')).toBeVisible();
  await page.getByLabel('Where did we first meet?').fill('  goa ');
  await page.getByRole('button', { name: 'Check' }).click();

  // A countdown in the past can be passed straight away.
  await expect(page.getByRole('timer', { name: 'Time is up' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // The video embeds from YouTube's no-cookie domain without a CSP violation.
  await expect(page.getByTestId('video-embed')).toHaveAttribute(
    'src',
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  );
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  // The place stays hidden until revealed; Continue waits for it.
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByTestId('place-revealed')).toContainText('Marine Drive');
  await expect(page.getByRole('link', { name: 'Open in Maps' })).toHaveAttribute(
    'href',
    /google\.com\/maps\/search/,
  );
  await page.getByRole('button', { name: 'Continue' }).click();

  // The template's final surprise comes next.
  await expect(page.getByRole('heading', { name: 'The plan' })).toBeVisible();
  expect(csp).toEqual([]);
});
