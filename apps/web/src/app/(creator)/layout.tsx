import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/api/server';
import { SiteNav } from '@/components/site/site-nav';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/api/v1/me');
  // No sign-in to send anyone to: the proxy gives this browser a private key before this
  // renders. A saved key that no longer works is cleared, and a fresh one is issued.
  if (response.status === 401) redirect('/start-over');
  if (!me) redirect('/');

  return (
    <div className="min-h-dvh">
      <header className="wr-stage-header sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto h-14 max-w-6xl px-4 sm:px-6">
          <SiteNav admin={me.isAdmin} />
        </div>
      </header>
      {children}
    </div>
  );
}
