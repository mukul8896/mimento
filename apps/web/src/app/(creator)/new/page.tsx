import { serverApi } from '@/lib/api/server';
import { NewExperience } from '@/components/creator/new-experience';

export const metadata = { title: 'New surprise' };

export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const [api, params] = await Promise.all([serverApi(), searchParams]);
  const [{ data }, progress] = await Promise.all([
    api.GET('/api/v1/templates'),
    // What this browser started and changed but has not published.
    api.GET('/api/v1/experiences/in-progress'),
  ]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="text-sm font-semibold tracking-widest text-brand-700 uppercase">
        Who is it for?
      </p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Create Experience</h1>
      <p className="mt-2 text-ink-600">
        Pick a moment and make it theirs — or build your own from scratch.
      </p>
      <NewExperience
        templates={data?.items ?? []}
        inProgress={progress.data?.items ?? []}
        initialTemplate={
          typeof params.template === 'string' ? params.template.slice(0, 60) : undefined
        }
      />
    </main>
  );
}
