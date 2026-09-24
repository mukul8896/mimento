import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverApi } from '@/lib/api/server';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const api = await serverApi();
  const { data: me, response } = await api.GET('/api/v1/me');
  // No sign-in to send anyone to: the proxy mints an owner before this renders. A saved key that
  // no longer works (expired after a year unused) is cleared, and a fresh one is minted.
  if (response.status === 401) redirect('/start-over');
  if (!me) redirect('/');

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="shrink-0 font-semibold text-brand-700">
            Wish Revealer
          </Link>
          <nav
            aria-label="Main"
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm"
          >
            <Link
              href="/dashboard"
              className="rounded-lg px-2.5 py-1.5 text-ink-700 hover:bg-ink-100"
            >
              Dashboard
            </Link>
            {me.isAdmin ? (
              <Link
                href="/admin"
                className="rounded-lg px-2.5 py-1.5 text-ink-700 hover:bg-ink-100"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/account"
              className="rounded-lg px-2.5 py-1.5 text-ink-700 hover:bg-ink-100"
            >
              Account
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
