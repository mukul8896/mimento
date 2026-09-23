import type { Metadata } from 'next';
import { DEFAULT_THEME, ThemeSchema } from '@momentpath/contracts';
import { publicServerApi } from '@/lib/api/server';
import { RecipientPlayer } from './recipient-player';
import { Unavailable } from '@/components/player/player';
import { themeClass, themeStyle } from '@/components/player/theme';

export const dynamic = 'force-dynamic';

// Titles of private experiences are not put in link previews or browser history metadata.
export const metadata: Metadata = {
  title: 'A surprise for you',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: 'no-referrer',
};

/**
 * Server render only checks availability and theme. Steps, answers and the gift are loaded by
 * the client through the session API, so nothing private is embedded in the HTML or RSC payload.
 */
export default async function RecipientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await publicServerApi().GET('/api/v1/public/experiences/{token}/meta', {
    params: { path: { token } },
  });
  if (!data) {
    return (
      <div
        className={`${themeClass(DEFAULT_THEME)} flex min-h-dvh items-center justify-center px-6`}
        style={themeStyle(DEFAULT_THEME)}
      >
        <Unavailable />
      </div>
    );
  }
  return <RecipientPlayer token={token} theme={ThemeSchema.parse(data.theme)} />;
}
