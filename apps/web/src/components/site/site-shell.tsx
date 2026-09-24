import Link from 'next/link';
import type { ReactNode } from 'react';

const FOOTER_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/contact', label: 'Contact' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 py-6">
      <nav
        aria-label="Site"
        className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 text-sm text-ink-500 sm:px-6"
      >
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}

/** Public information pages: pricing and policies. */
export function SiteShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-brand-700">
          MomentPath
        </Link>
        <Link
          href="/new"
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
        >
          Create a surprise
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900">{title}</h1>
        {updated ? <p className="mt-1 text-sm text-ink-500">Last updated {updated}</p> : null}
        <div className="mt-6 space-y-4 text-ink-700">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="pt-2 text-lg font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

export function SupportEmail({ email }: { email: string | undefined }) {
  return email ? (
    <a href={`mailto:${email}`} className="font-medium text-brand-700 underline">
      {email}
    </a>
  ) : (
    <span>the address on our contact page</span>
  );
}
