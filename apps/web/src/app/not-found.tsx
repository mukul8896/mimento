import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-600">The page you were looking for does not exist.</p>
      <Link href="/" className="font-medium text-brand-700 underline">
        Go to the home page
      </Link>
    </main>
  );
}
