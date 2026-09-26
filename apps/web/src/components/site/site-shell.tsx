import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteNav } from './site-nav';

const FOOTER_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/contact', label: 'Contact' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 py-8">
      <p className="mx-auto max-w-5xl px-4 font-semibold text-brand-700 sm:px-6">
        <span aria-hidden="true">🎁 </span>Wish Revealer
        <span className="ml-2 font-normal text-ink-500">Little surprises, made with love.</span>
      </p>
      <nav
        aria-label="Site"
        className="mx-auto mt-3 flex max-w-5xl flex-wrap gap-x-5 gap-y-2 px-4 text-sm text-ink-600 sm:px-6"
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
      <div className="wr-glow">
        <header className="relative z-10 mx-auto h-16 w-full max-w-5xl px-4 sm:px-6">
          <SiteNav cta />
        </header>
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pt-8 pb-6 sm:px-6 sm:pt-12">
          <h1 className="text-4xl font-semibold text-ink-900 sm:text-5xl">{title}</h1>
          {updated ? <p className="mt-2 text-sm text-ink-600">Last updated {updated}</p> : null}
        </div>
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6">
        <div className="space-y-4 rounded-3xl bg-white/80 p-5 leading-relaxed text-ink-700 shadow-sm ring-1 ring-ink-100 sm:p-8">
          {children}
        </div>
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
