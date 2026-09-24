import Link from 'next/link';
import { hasSession } from '@/lib/api/server';
import { SiteFooter } from '@/components/site/site-shell';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  {
    title: 'Date invitation',
    text: 'A playful “Will you go out with me?” with a No button that plays hard to get.',
  },
  {
    title: 'Birthday surprise',
    text: 'A warm message, a memory quiz, a scratch card and the present at the end.',
  },
  {
    title: 'Anniversary',
    text: 'Relive the day you met and reveal your plans for the next adventure.',
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ manage?: string; recover?: string }>;
}) {
  const [signedIn, params] = await Promise.all([hasSession(), searchParams]);
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-lg font-semibold tracking-tight text-brand-700">MomentPath</span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/pricing" className="text-ink-600 hover:underline">
            Pricing
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white"
            >
              Dashboard
            </Link>
          ) : (
            <Link href="/new" className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white">
              Get started
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        {params.manage === 'invalid' || params.recover === 'invalid' ? (
          <p
            role="alert"
            className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200"
          >
            That link is not valid. Check you copied the whole thing, including the end.
          </p>
        ) : null}
        <section className="py-10 text-center sm:py-16">
          <h1 className="text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            Turn a message into a <span className="text-brand-600">moment</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-600">
            Build a private, interactive surprise — messages, photos, questions and a final reveal —
            and share it with one link. No app needed.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/new"
              className="w-full rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm sm:w-auto"
            >
              Create your surprise
            </Link>
            <span className="text-sm text-ink-500">
              No account needed. Takes about five minutes with a template.
            </span>
          </div>
        </section>
        <section aria-labelledby="examples" className="grid gap-4 sm:grid-cols-3">
          <h2 id="examples" className="sr-only">
            Templates
          </h2>
          {EXAMPLES.map((e) => (
            <article
              key={e.title}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-100"
            >
              <h3 className="font-semibold text-ink-900">{e.title}</h3>
              <p className="mt-2 text-sm text-ink-600">{e.text}</p>
            </article>
          ))}
        </section>
        <section className="mt-12 rounded-2xl bg-white p-5 text-sm text-ink-600 shadow-sm ring-1 ring-ink-100 sm:p-6">
          <h2 className="text-base font-semibold text-ink-900">
            Private by design, honest about limits
          </h2>
          <p className="mt-2">
            Every experience gets an unguessable link that is hidden from search engines. Anyone you
            forward the link to can open it, and screenshots cannot be prevented — share it only
            with the person it is meant for. Recipients can close an experience at any time without
            answering.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
