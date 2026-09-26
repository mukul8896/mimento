import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wr-glow flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <span
          aria-hidden="true"
          className="inline-flex size-20 items-center justify-center rounded-[1.75rem] bg-white text-4xl shadow-lg ring-1 ring-rose-200"
        >
          🎈
        </span>
        <h1 className="mt-6 text-4xl font-semibold text-ink-900">Page not found</h1>
        <p className="mt-3 text-ink-600">
          This surprise floated away — or the link is not quite complete. Check you copied all of
          it.
        </p>
        <Link
          href="/"
          className="wr-press mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-7 font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700"
        >
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
