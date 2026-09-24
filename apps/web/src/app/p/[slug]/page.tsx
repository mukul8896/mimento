import { ShortLinkGate } from '@/components/player/short-link-gate';

export const metadata = { title: 'A private surprise', robots: { index: false, follow: false } };

/**
 * Short link entry point. Nothing about the surprise is looked up or shown here: the PIN is
 * checked by the API, which then hands the browser the private link to continue on.
 */
export default async function ShortLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <ShortLinkGate slug={slug.toLowerCase().slice(0, 40)} />
    </main>
  );
}
