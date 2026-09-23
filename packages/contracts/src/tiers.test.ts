import { describe, expect, it } from 'vitest';
import { highestTier, requiredTier, tierAtLeast } from './tiers';

const TEMPLATE = ['MESSAGE', 'IMAGE', 'YES_NO_CHOICE', 'GIFT_REVEAL'] as const;

describe('tier ordering', () => {
  it('ranks FREE below PLUS below PRO', () => {
    expect(tierAtLeast('PRO', 'PLUS')).toBe(true);
    expect(tierAtLeast('PLUS', 'PLUS')).toBe(true);
    expect(tierAtLeast('PLUS', 'PRO')).toBe(false);
    expect(tierAtLeast('FREE', 'PLUS')).toBe(false);
    expect(highestTier('FREE', 'PLUS')).toBe('PLUS');
    expect(highestTier('PRO', 'PLUS')).toBe('PRO');
  });
});

describe('requiredTier', () => {
  it('keeps a template at its own tier when only content changed', () => {
    // Personalising is the point of a template: same steps, different words and photos.
    expect(
      requiredTier({
        templateTier: 'FREE',
        templateStepTypes: TEMPLATE,
        stepTypes: [...TEMPLATE],
      }),
    ).toBe('FREE');
    expect(
      requiredTier({ templateTier: 'PLUS', templateStepTypes: TEMPLATE, stepTypes: [...TEMPLATE] }),
    ).toBe('PLUS');
  });

  it('charges PRO for a blank draft, which is a custom build by definition', () => {
    expect(
      requiredTier({ templateTier: null, templateStepTypes: null, stepTypes: ['MESSAGE'] }),
    ).toBe('PRO');
  });

  it.each([
    ['a step added', [...TEMPLATE, 'MESSAGE']],
    ['a step removed', TEMPLATE.slice(1)],
    ['steps reordered', ['IMAGE', 'MESSAGE', 'YES_NO_CHOICE', 'GIFT_REVEAL']],
    ['a step type swapped', ['MESSAGE', 'SCRATCH_REVEAL', 'YES_NO_CHOICE', 'GIFT_REVEAL']],
  ])('charges PRO when the structure changed: %s', (_label, stepTypes) => {
    expect(
      requiredTier({
        templateTier: 'FREE',
        templateStepTypes: TEMPLATE,
        stepTypes: [...stepTypes],
      }),
    ).toBe('PRO');
  });
});
