import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { authFile, type UserName } from './users';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

type Json = Record<string, unknown>;
interface Step {
  key: string;
  type: string;
  config: Json;
  next?: unknown;
}
interface Draft {
  revision: number;
  title: string;
  theme: Json;
  settings: Json;
  steps: Step[];
}

/** An authenticated BFF client for a signed-in test user (same cookies as the browser). */
export async function creatorApi(user: UserName): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BASE,
    storageState: authFile(user),
    extraHTTPHeaders: { origin: BASE },
  });
}

export async function createPublished(
  api: APIRequestContext,
  templateKey: string,
  mutate?: (draft: Draft) => void,
): Promise<{ id: string; token: string; draft: Draft }> {
  const created = await api.post('/bff/api/v1/experiences', { data: { templateKey } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  let draft = (await (await api.get(`/bff/api/v1/experiences/${id}/draft`)).json()) as Draft;
  if (mutate) {
    const shape = (d: Draft) => d.steps.map((s) => `${s.key}:${s.type}`).join(',');
    const before = shape(draft);
    mutate(draft);
    // Changing which steps exist, their order or the flow is PRO: "Customize with PRO" first,
    // exactly as a creator would. Rewording a template needs nothing.
    if (shape(draft) !== before || draft.steps.some((s) => 'next' in s && s.next)) {
      const customized = await api.post(`/bff/api/v1/experiences/${id}/customize`);
      expect(customized.status(), await customized.text()).toBe(200);
    }
    const saved = await api.put(`/bff/api/v1/experiences/${id}/draft`, {
      data: {
        revision: draft.revision,
        title: draft.title,
        theme: draft.theme,
        settings: draft.settings,
        steps: draft.steps,
      },
    });
    expect(saved.status(), await saved.text()).toBe(200);
    draft = (await (await api.get(`/bff/api/v1/experiences/${id}/draft`)).json()) as Draft;
  }
  const published = await api.post(`/bff/api/v1/experiences/${id}/publish`);
  expect(published.status(), await published.text()).toBe(200);
  const link = (await (await api.get(`/bff/api/v1/experiences/${id}/share-link`)).json()) as {
    shareToken: string;
  };
  return { id, token: link.shareToken, draft };
}

/** A minimal published experience: one Yes/No step with the given No configuration, then a gift. */
export async function publishedYesNo(api: APIRequestContext, yesNo: Json) {
  return createPublished(api, 'date-invitation', (draft) => {
    const choice = draft.steps.find((s) => s.type === 'YES_NO_CHOICE')!;
    const gift = draft.steps.find((s) => s.type === 'GIFT_REVEAL')!;
    choice.config = { ...choice.config, ...yesNo };
    draft.steps = [choice, gift];
  });
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(0);
}

/**
 * Waits for entrance animations (fades, rises) to finish, so contrast is measured on what people
 * actually read rather than a half-faded frame. Looping animations (a glowing button) are ignored.
 */
export async function settleAnimations(page: Page) {
  await page.waitForFunction(
    () =>
      // Frame-by-frame (Motion) animations leave an inline opacity until they finish.
      // Only a half-faded element is misleading: fully hidden ones (waiting to be scrolled
      // into view) are skipped by axe, and decorative layers (aria-hidden) are faint on purpose.
      Array.from(document.querySelectorAll<HTMLElement>('[style*="opacity"]'))
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .every((el) => {
          const o = el.style.opacity === '' ? 1 : Number(el.style.opacity);
          return o === 0 || o >= 1;
        }) &&
      document
        .getAnimations()
        .every(
          (a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity,
        ),
    undefined,
    { timeout: 5000 },
  );
}

export async function expectAccessible(page: Page, include?: string) {
  await settleAnimations(page);
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

/** Clicks through a message-type step. */
export async function continueStep(page: Page, label: RegExp | string = /continue|let’s go/i) {
  await page.getByRole('button', { name: label }).click();
}

/**
 * Starts something on /new the way a creator does. A template this browser already changed asks
 * "Continue, or start over?" first; tests want a fresh one, so they start over.
 */
export async function startFresh(page: Page, start: () => Promise<void>) {
  await start();
  const discard = page.getByTestId('start-over');
  await Promise.race([
    page.waitForURL(/\/(personalize|edit)$/),
    discard.waitFor({ state: 'visible' }),
    page.getByTestId('personalise-form').waitFor({ state: 'visible' }),
  ]);
  if (await discard.isVisible()) await discard.click();
}

export function useTemplate(page: Page, name: RegExp) {
  return startFresh(page, () => page.getByRole('button', { name }).first().click());
}
