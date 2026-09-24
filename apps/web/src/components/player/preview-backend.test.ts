import { describe, expect, it } from 'vitest';
import { defaultStepConfig, type DraftStep } from '@momentpath/contracts';
import { PreviewBackend } from './preview-backend';

const step = (n: number): DraftStep => ({
  key: `00000000-0000-4000-8000-00000000000${n}`,
  type: 'MESSAGE',
  config: defaultStepConfig('MESSAGE'),
});
const steps = [step(1), step(2), step(3)];
const experience = {
  title: 't',
  theme: {} as never,
  versionNumber: 0,
  responsesVisibleToCreator: false,
  steps,
  media: [],
};

describe('editor preview', () => {
  it('opens on the step being edited, counts earlier steps as done, and carries on from there', async () => {
    const backend = new PreviewBackend(experience, undefined, steps[1]!.key);
    const { progress } = await backend.load();
    expect(progress.nextStepKey).toBe(steps[1]!.key);
    expect(progress.completedStepKeys).toEqual([steps[0]!.key]);
    const next = await backend.answer(steps[1]!.key, { kind: 'ACK' });
    expect(next.progress.nextStepKey).toBe(steps[2]!.key);
  });

  it('starts at the beginning without a selected step', async () => {
    const { progress } = await new PreviewBackend(experience).load();
    expect(progress.nextStepKey).toBe(steps[0]!.key);
    expect(progress.completedStepKeys).toEqual([]);
  });
});
