export const metadata = { title: 'Operator', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The one credential prompt in the product. Creators never see this: it exists so that abuse
 * reports can be actioned, which anonymous publishing makes more important, not less.
 */
export default async function OperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold">Operator access</h1>
      <p className="mt-2 text-sm text-ink-600">Moderation tools for abuse reports and takedowns.</p>
      {params.error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          That token was not accepted.
        </p>
      ) : null}
      <form action="/operator/session" method="post" className="mt-6 space-y-3">
        <label htmlFor="token" className="block text-sm font-medium">
          Operator token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="min-h-11 w-full rounded-xl px-3 ring-1 ring-ink-200"
        />
        <button
          type="submit"
          className="min-h-11 w-full rounded-xl bg-brand-600 px-4 font-medium text-white"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
