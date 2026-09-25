import { describe, expect, it } from 'vitest';
import { detailsFileName, detailsText, PRIVATE_LINK_WARNING } from './surprise-details';

const links = {
  title: 'Happy birthday, Pratikshya! 🎂',
  createdAt: '2026-09-25T10:00:00.000Z',
  publishedAt: '2026-09-25T11:00:00.000Z',
  recipientUrl: 'https://wishrevealer.com/e/abc',
  manageUrl: 'https://wishrevealer.com/m/xyz',
};

describe('download details', () => {
  it('has the name, dates, both links, which one to share and the warning', () => {
    const text = detailsText(links);
    expect(text).toMatch(/^WishRevealer\n/);
    expect(text).toContain('Happy birthday, Pratikshya! 🎂');
    expect(text).toContain('Created: 25 September 2026');
    expect(text).toContain('Published: 25 September 2026');
    expect(text).toMatch(/RECIPIENT LINK — share this one\nhttps:\/\/wishrevealer.com\/e\/abc/);
    expect(text).toMatch(
      /PRIVATE MANAGEMENT LINK — keep this one private\nhttps:\/\/wishrevealer.com\/m\/xyz/,
    );
    expect(text).toContain('Anyone with this private link may be able to manage the experience.');
    expect(text).toContain('We may not be able to restore access if you lose it.');
    // Never promises more than we can do.
    expect(text).not.toMatch(/gone forever/i);
  });

  it('names the file after the surprise', () => {
    expect(detailsFileName(links.title)).toBe('wishrevealer-happy-birthday-pratikshya.txt');
    expect(detailsFileName('🎉')).toBe('wishrevealer-surprise.txt');
  });

  it('keeps the standard warning wording', () => {
    expect(PRIVATE_LINK_WARNING).toBe(
      'Keep this link safe. WishRevealer does not require an account, so this private link is how you access and manage your surprise. We may not be able to restore access if you lose it.',
    );
  });
});
