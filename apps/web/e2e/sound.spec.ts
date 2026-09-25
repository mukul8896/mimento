import { expect, test, type Page } from '@playwright/test';
import { continueStep, createPublished, creatorApi, expectAccessible } from './helpers';
import { authFile } from './users';

function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('the recipient hears the music after their first tap and can mute it for good', async ({
  page,
}) => {
  const errors = consoleErrors(page);
  const api = await creatorApi('alice');
  const { token } = await createPublished(api, 'date-invitation');
  await page.goto(`/e/${token}`);

  const toggle = page.getByTestId('sound-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'Turn sound off');
  await continueStep(page);
  // Answering plays its reaction (sound and emoji burst) without getting in the way.
  await page.getByRole('button', { name: 'Yes!' }).click();
  await expect(page.getByLabel('Sunset picnic')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Turn sound on');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  // The choice is remembered on this device.
  await page.reload();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-label', 'Turn sound on');
  // Close still sits beside it, untouched.
  await expect(page.getByTestId('close-experience')).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test.describe('creator', () => {
  test.use({ storageState: authFile('alice') });

  test('picks background music, sounds and a celebration style', async ({ page }) => {
    const errors = consoleErrors(page);
    const api = await creatorApi('alice');
    const created = await api.post('/bff/api/v1/experiences', {
      data: { templateKey: 'date-invitation' },
    });
    const { id } = (await created.json()) as { id: string };
    // Tap sounds and celebrations are builder settings (PRO); templates keep their own.
    expect((await api.post(`/bff/api/v1/experiences/${id}/customize`)).status()).toBe(200);
    await page.goto(`/experiences/${id}/edit`);
    await page.getByTestId('build-look').click();

    const visible = (testId: string) => page.getByTestId(testId).filter({ visible: true });
    await expect(visible('music-LOVE_PIANO')).toHaveAttribute('aria-checked', 'true');
    await visible('music-JINGLE').click();
    await expect(visible('music-JINGLE')).toHaveAttribute('aria-checked', 'true');
    await page
      .getByRole('switch', { name: /Tap and answer sounds/ })
      .filter({ visible: true })
      .click();
    await page.getByRole('button', { name: 'Snow' }).filter({ visible: true }).click();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', {
      timeout: 10_000,
    });

    const draft = (await (await api.get(`/bff/api/v1/experiences/${id}/draft`)).json()) as {
      theme: { music: unknown; sounds: boolean; celebration: string };
    };
    expect(draft.theme).toMatchObject({
      music: { source: 'LIBRARY', track: 'JINGLE' },
      sounds: false,
      celebration: 'SNOW',
    });
    expect(errors).toEqual([]);
  });
});
