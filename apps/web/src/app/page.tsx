import Link from 'next/link';
import { publicServerApi } from '@/lib/api/server';
import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-shell';
import { FloatingBackground } from '@/components/site/landing/floating-bg';
import { GiftHero } from '@/components/site/landing/gift-hero';
import { Reveal } from '@/components/site/landing/reveal';
import { TemplateGallery } from '@/components/site/landing/template-gallery';
import { TryIt } from '@/components/site/landing/try-it';

export const dynamic = 'force-dynamic';

const STEPS = [
  ['🎨', 'Pick a template', 'Birthdays, Diwali, proposals, apologies — 25+ ready to go.'],
  ['✍️', 'Make it personal', 'Tap any words, photos or music in the preview to change them.'],
  ['🔗', 'Share the moment', 'Send one link on WhatsApp. Keep your private link to manage it.'],
] as const;

const FEATURES = [
  ['🙈', 'A No button that runs away', 'They can say anything — except no.'],
  ['🪄', 'Scratch cards & reveals', 'Hide a message and let them uncover it.'],
  ['⏰', 'Countdowns', 'Unlock the gift at midnight on their birthday.'],
  ['🧩', 'Puzzles & quizzes', '“Where did we first meet?” — only they know.'],
  ['🎙️', 'Voice notes & videos', 'Say it in your own voice.'],
  ['🔒', 'Private by design', 'Unguessable link, optional PIN, hidden from search.'],
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ manage?: string }>;
}) {
  const [params, templates] = await Promise.all([
    searchParams,
    publicServerApi().GET('/api/v1/templates'),
  ]);
  return (
    <div className="min-h-dvh overflow-x-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <header className="relative z-10 mx-auto h-16 max-w-6xl px-4 sm:px-6">
        <SiteNav cta />
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {params.manage === 'invalid' ? (
          <p
            role="alert"
            className="relative z-10 mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200"
          >
            That private management link does not work. Check you copied the whole thing, including
            the end — it is in the details you saved when you published.
          </p>
        ) : null}

        <div className="relative">
          <FloatingBackground />
          <GiftHero />
        </div>

        <section id="try" aria-labelledby="try-heading" className="scroll-mt-4 py-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 id="try-heading" className="text-3xl font-bold tracking-tight text-ink-900">
                Go on — play one
              </h2>
              <p className="mt-3 text-lg text-ink-600">
                This is what they get: a little journey that ends in a reveal. Try pressing
                <strong> No</strong>.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {FEATURES.map(([emoji, title, text]) => (
                  <li
                    key={title}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100"
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {emoji}
                    </span>
                    <span className="mt-1 block font-semibold text-ink-900">{title}</span>
                    <span className="text-sm text-ink-600">{text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15} className="flex justify-center">
              <TryIt />
            </Reveal>
          </div>
        </section>

        <TemplateGallery templates={templates.data?.items ?? []} />

        <section id="how" aria-labelledby="how-heading" className="scroll-mt-4 py-12">
          <h2
            id="how-heading"
            className="text-center text-3xl font-bold tracking-tight text-ink-900"
          >
            Ready in two minutes
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map(([emoji, title, text], i) => (
              <li key={title}>
                <Reveal
                  delay={i * 0.1}
                  className="h-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-ink-100"
                >
                  <span className="text-4xl" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-brand-700">
                    Step {i + 1}
                  </span>
                  <span className="mt-1 block text-lg font-bold text-ink-900">{title}</span>
                  <span className="mt-1 block text-sm text-ink-600">{text}</span>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <Reveal className="mt-4 rounded-3xl bg-gradient-to-br from-brand-600 to-fuchsia-600 p-8 text-center text-white shadow-xl sm:p-12">
          <h2 className="text-3xl font-bold tracking-tight">Someone deserves a smile today</h2>
          <p className="mx-auto mt-2 max-w-md text-white/90">
            Make it in minutes. They will remember it for much longer.
          </p>
          <Link
            href="/new"
            className="mt-6 inline-block rounded-2xl bg-white px-8 py-3.5 font-semibold text-brand-700 shadow-lg transition active:scale-[0.98]"
          >
            Create a surprise
          </Link>
        </Reveal>

        <section className="mt-12 rounded-2xl bg-white p-5 text-sm text-ink-600 shadow-sm ring-1 ring-ink-100 sm:p-6">
          <h2 className="text-base font-semibold text-ink-900">
            Private by design, honest about limits
          </h2>
          <p className="mt-2">
            Every surprise gets an unguessable link that is hidden from search engines. Anyone you
            forward the link to can open it, and screenshots cannot be prevented — share it only
            with the person it is meant for. Recipients can close a surprise at any time without
            answering.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
