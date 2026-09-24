import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/** Chrome's virtual authenticator stands in for Touch ID / Face ID. */
async function authenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

async function newSurprise(context: BrowserContext, page: Page, title: string) {
  await page.goto('/dashboard'); // mints an owner for this browser
  const res = await context.request.post('/bff/api/v1/experiences', {
    data: { templateKey: 'date-invitation', title },
    headers: { origin: BASE },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

test('save a passkey, then sign in from a fresh browser and keep what was started there', async ({
  browser,
}) => {
  // Device 1: make a surprise and save a passkey.
  const first = await browser.newContext();
  const page = await first.newPage();
  const id = await newSurprise(first, page, 'Made on my phone');
  const { cdp, authenticatorId } = await authenticator(page);
  await page.goto('/account');
  await page.getByTestId('add-passkey').click();
  await expect(page.getByText('Saved. On a new phone')).toBeVisible();
  await expect(page.getByTestId('passkeys').getByRole('listitem')).toHaveCount(1);
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials).toHaveLength(1);

  // Device 2: a new browser (the same passkey, as if synced), which already started a draft.
  const second = await browser.newContext();
  const page2 = await second.newPage();
  const draftId = await newSurprise(second, page2, 'Started before signing in');
  const device2 = await authenticator(page2);
  await device2.cdp.send('WebAuthn.addCredential', {
    authenticatorId: device2.authenticatorId,
    credential: credentials[0]!,
  });
  await page2.goto('/signin');
  await page2.getByTestId('passkey-sign-in').click();
  await expect(page2).toHaveURL(/\/dashboard/);
  await expect(page2.getByText('Made on my phone')).toBeVisible();
  await expect(page2.getByText('Started before signing in')).toBeVisible();

  // Device 1 is still signed in and now sees the draft too.
  expect((await first.request.get(`/bff/api/v1/experiences/${draftId}`)).status()).toBe(200);
  expect((await second.request.get(`/bff/api/v1/experiences/${id}`)).status()).toBe(200);
  // The owner token never reaches page scripts through the BFF.
  expect(
    (
      await second.request.post('/bff/api/v1/passkeys/login', {
        headers: { origin: BASE },
        data: {},
      })
    ).status(),
  ).toBe(404);
  await first.close();
  await second.close();
});
