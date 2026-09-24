import Link from 'next/link';
import { Badge } from '@momentpath/design-system';
import { serverApi } from '@/lib/api/server';
import { deletedSoon, formatDate, STATUS_LABEL, STATUS_TONE } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

const FILTERS = [
  { key: undefined, label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PUBLISHED', label: 'Live' },
  { key: 'INACTIVE', label: 'Disabled & expired' },
] as const;

type Filter = (typeof FILTERS)[number]['key'];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const status = FILTERS.find((f) => f.key === params.status)?.key as Filter;
  const api = await serverApi();
  const { data } = await api.GET('/api/v1/experiences', {
    params: {
      query: {
        limit: 20,
        ...(status ? { status } : {}),
        ...(params.cursor ? { cursor: params.cursor } : {}),
      },
    },
  });
  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your experiences</h1>
        <Link
          href="/new"
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          New experience
        </Link>
      </div>

      <nav
        aria-label="Filter experiences"
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {FILTERS.map((f) => {
          const active = f.key === status;
          return (
            <Link
              key={f.label}
              href={f.key ? `/dashboard?status=${f.key}` : '/dashboard'}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${active ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 ring-1 ring-ink-200'}`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-ink-200 p-8 text-center">
          <p className="text-ink-600">Nothing here yet.</p>
          <Link href="/new" className="mt-3 inline-block font-medium text-brand-700 underline">
            Create your first surprise
          </Link>
          <p className="mt-4 text-sm text-ink-500">
            Made surprises on another device?{' '}
            <Link href="/signin" className="font-medium text-brand-700 underline">
              Sign in with a passkey
            </Link>
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => (
            <li key={e.id}>
              <Link
                href={`/experiences/${e.id}`}
                className="block h-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100 transition hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate font-semibold" title={e.title}>
                    {e.title || 'Untitled'}
                  </h2>
                  <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                </div>
                {e.moderationState === 'TAKEN_DOWN' ? (
                  <p className="mt-2 text-xs font-medium text-red-700">Disabled by moderation</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-ink-500">Opened</dt>
                    <dd className="font-medium">{e.stats.started}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Completed</dt>
                    <dd className="font-medium">{e.stats.completed}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-500">Updated {formatDate(e.updatedAt)}</p>
                {deletedSoon(e.keptUntil) ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Unused for almost a year — deleted on {formatDate(e.keptUntil)} unless it is
                    opened
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data?.nextCursor ? (
        <div className="mt-6 text-center">
          <Link
            href={`/dashboard?${new URLSearchParams({ ...(status ? { status } : {}), cursor: data.nextCursor }).toString()}`}
            className="font-medium text-brand-700 underline"
          >
            Show more
          </Link>
        </div>
      ) : null}
    </main>
  );
}
