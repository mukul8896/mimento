import Link from 'next/link';
import type { PublicExperience } from '@momentpath/contracts';
import { publicServerApi } from '@/lib/api/server';
import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-shell';
import { DEMO_EXPERIENCE, DEMO_GIFT } from '@/components/site/landing/demo-experience';
import { Hero } from '@/components/site/landing/hero';
import { Reveal } from '@/components/site/landing/reveal';
import { TemplateGallery } from '@/components/site/landing/template-gallery';

export const dynamic = 'force-dynamic';

const JOURNEY = [
  [
    '🎨',
    'Pick a moment',
    'A birthday, a proposal, Diwali, a date — each one a ready-made little story.',
  ],
  [
    '✍️',
    'Make it theirs',
    'Tap any words, photos or music right in the preview to change them. What you see is what they get.',
  ],
  [
    '🔗',
    'Share one link',
    'Send it on WhatsApp. They open it on their phone — and you keep a private link to see how it went.',
  ],
] as const;

const MOMENTS = [
  ['💌', 'Words that land', 'Messages that arrive slowly, word by word.'],
  ['🧩', 'A memory only they know', 'A question or a puzzle about the two of you.'],
  ['🪄', 'Something to uncover', 'Scratch cards and reveals they open with a finger.'],
  ['🎁', 'One last reveal', 'A letter, a plan or a gift — saved for the very end.'],
] as const;

/** The Proposal template, playing in the hero; falls back to the built-in demo. */
async function heroDemo(): Promise<{ experience: PublicExperience; gift?: string }> {
  try {
    const { data } = await publicServerApi().GET('/api/v1/templates/{key}/preview', {
      params: { path: { key: 'proposal' } },
    });
    if (data) {
      return {
        experience: {
          ...(data as unknown as Omit<
            PublicExperience,
            'versionNumber' | 'responsesVisibleToCreator' | 'branded'
          >),
          versionNumber: 0,
          responsesVisibleToCreator: false,
          branded: false,
        },
        gift: 'You have made me the happiest person alive. Every day from now on, I choose you.\n\n— Rahul',
      };
    }
  } catch {
    /* the built-in demo below */
  }
  return { experience: DEMO_EXPERIENCE, gift: DEMO_GIFT };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ manage?: string }>;
}) {
  const [params, templates, demo] = await Promise.all([
    searchParams,
    publicServerApi().GET('/api/v1/templates'),
    heroDemo(),
  ]);
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <div className="wr-glow">
        <header className="relative z-10 mx-auto h-16 max-w-6xl px-4 sm:px-6">
          <SiteNav cta />
        </header>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {params.manage === 'invalid' ? (
            <p
              role="alert"
              data-testid="manage-invalid"
              className="relative z-10 mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200"
            >
              That private management link does not work. Check you copied the whole thing,
              including the end — it is in the details you saved when you published.
            </p>
          ) : null}
          <Hero demo={demo.experience} demoGift={demo.gift} />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section aria-labelledby="moments-heading" className="py-12">
          <Reveal>
            <p className="text-center text-sm font-semibold tracking-widest text-brand-700 uppercase">
              Not a card. A little journey.
            </p>
            <h2
              id="moments-heading"
              className="mt-2 text-center text-3xl font-semibold text-ink-900 sm:text-4xl"
            >
              Every surprise is a small story they play
            </h2>
          </Reveal>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MOMENTS.map(([emoji, title, text], i) => (
              <li key={title}>
                <Reveal delay={i * 0.08} className="h-full">
                  <div className="h-full rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-ink-100 backdrop-blur">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-2xl"
                    >
                      {emoji}
                    </span>
                    <p className="mt-3 font-semibold text-ink-900">{title}</p>
                    <p className="mt-1 text-sm text-ink-600">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <TemplateGallery templates={templates.data?.items ?? []} />

        <section id="how" aria-labelledby="how-heading" className="scroll-mt-4 py-12">
          <Reveal>
            <h2
              id="how-heading"
              className="text-center text-3xl font-semibold text-ink-900 sm:text-4xl"
            >
              Ready in two minutes
            </h2>
            <p className="mt-2 text-center text-ink-600">
              No sign-up, no app — just three moments.
            </p>
          </Reveal>
          <ol className="relative mx-auto mt-10 max-w-2xl space-y-6 before:absolute before:top-6 before:bottom-6 before:left-6 before:w-px before:bg-gradient-to-b before:from-rose-300 before:via-gold-300 before:to-rose-300 sm:before:left-7">
            {JOURNEY.map(([emoji, title, text], i) => (
              <li key={title} className="relative">
                <Reveal delay={i * 0.1} className="flex gap-4 sm:gap-5">
                  <span
                    aria-hidden="true"
                    className="relative z-10 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-md ring-4 ring-ink-50 sm:size-14"
                  >
                    {emoji}
                  </span>
                  <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-ink-100">
                    <p className="text-xs font-bold tracking-widest text-brand-700 uppercase">
                      Moment {i + 1}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-ink-900">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-600">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <Reveal className="relative mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-950 via-ink-900 to-[#4a1f3d] p-8 text-center text-white shadow-xl sm:p-14">
          <div
            aria-hidden="true"
            className="wr-halo wr-breathe absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full opacity-70"
          />
          <h2 className="relative text-3xl font-semibold sm:text-4xl">
            Someone deserves a smile today
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/80">
            Make it in minutes. They will remember it for much longer.
          </p>
          <Link
            href="/new"
            className="wr-press relative mt-7 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-white px-8 font-semibold text-brand-700 shadow-lg"
          >
            Create a surprise <span aria-hidden="true">→</span>
          </Link>
        </Reveal>

        <section className="mt-12 rounded-3xl bg-white/70 p-5 text-sm text-ink-600 ring-1 ring-ink-100 sm:p-6">
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
