import Link from 'next/link';

const ITEMS = [
  { href: '/#templates', label: 'Templates' },
  { href: '/new', label: 'Create' },
  { href: '/#how', label: 'How it works' },
];

/**
 * The product, not an account: templates, creating one, and how it works. There is nothing to
 * sign in to — every surprise has its own private management link.
 */
export function SiteNav({ admin = false, cta = false }: { admin?: boolean; cta?: boolean }) {
  return (
    <div className="flex h-full items-center gap-2">
      <Link
        href="/"
        className="mr-1 shrink-0 text-[15px] font-bold tracking-tight text-brand-700 sm:text-base"
      >
        <span aria-hidden="true">🎁 </span>Wish Revealer
      </Link>
      <nav
        aria-label="Main"
        className="-mr-2 flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto text-sm [scrollbar-width:none] sm:gap-1"
      >
        {/* With the Create button on show, the Create link would only repeat it. */}
        {ITEMS.filter((item) => !cta || item.href !== '/new').map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-2.5 py-2 font-medium text-ink-700 transition hover:bg-ink-100 hover:text-brand-700 ${
              item.href === '/#how' ? 'hidden sm:inline-block' : ''
            }`}
          >
            {item.label}
          </Link>
        ))}
        {admin ? (
          <Link
            href="/admin"
            className="shrink-0 rounded-lg px-2.5 py-2 font-medium text-ink-700 hover:bg-ink-100"
          >
            Admin
          </Link>
        ) : null}
        {cta ? (
          <Link
            href="/new"
            className="ml-1 shrink-0 rounded-xl bg-brand-600 px-3.5 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.97]"
          >
            Create
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
