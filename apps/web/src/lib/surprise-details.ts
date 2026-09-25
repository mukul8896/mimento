/**
 * What a creator keeps after publishing: the recipient link, the private management link, and a
 * small details file with both. Pure functions, shared by the success and manage pages.
 */
/** The one recovery warning, word for word, everywhere it appears (requirements §18). */
export const PRIVATE_LINK_WARNING =
  'Keep this link safe. WishRevealer does not require an account, so this private link is how you access and manage your surprise. We may not be able to restore access if you lose it.';

export interface SurpriseLinks {
  title: string;
  createdAt: string;
  publishedAt: string | null;
  recipientUrl: string;
  manageUrl: string;
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(iso));
}

/** A small, human-readable file to keep on a phone or computer: plain text opens anywhere. */
export function detailsText(links: SurpriseLinks): string {
  return [
    'WishRevealer',
    '============',
    '',
    links.title || 'Your surprise',
    `Created: ${longDate(links.createdAt)}`,
    ...(links.publishedAt ? [`Published: ${longDate(links.publishedAt)}`] : []),
    '',
    'RECIPIENT LINK — share this one',
    links.recipientUrl,
    'Send this link to the person receiving your surprise.',
    '',
    'PRIVATE MANAGEMENT LINK — keep this one private',
    links.manageUrl,
    'Use this private link to manage your surprise and see how they answered.',
    '',
    'IMPORTANT',
    'Keep your private management link safe.',
    'WishRevealer does not require an account, so this private link is how you access and manage your surprise.',
    'Anyone with this private link may be able to manage the experience.',
    'We may not be able to restore access if you lose it.',
    '',
  ].join('\n');
}

export function detailsFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `wishrevealer-${slug || 'surprise'}.txt`;
}
