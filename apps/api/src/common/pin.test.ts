import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from './pin';

describe('PIN hashing', () => {
  it('verifies the right PIN only, with a fresh salt each time', async () => {
    const a = await hashPin('2468');
    const b = await hashPin('2468');
    expect(a).not.toBe(b);
    expect(a).not.toContain('2468');
    expect(await verifyPin('2468', a)).toBe(true);
    expect(await verifyPin('2469', a)).toBe(false);
    expect(await verifyPin('2468', 'garbage')).toBe(false);
  });
});
