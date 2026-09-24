import { serverApi } from '@/lib/api/server';
import { NewExperience } from '@/components/creator/new-experience';

export const metadata = { title: 'New surprise' };

export default async function NewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const [api, params] = await Promise.all([serverApi(), searchParams]);
  const { data } = await api.GET('/api/v1/templates');
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Start a new surprise</h1>
      <p className="mt-1 text-ink-600">
        Pick a ready-made template, add their name and publish — or start from a blank page.
      </p>
      <NewExperience
        templates={data?.items ?? []}
        initialTemplate={
          typeof params.template === 'string' ? params.template.slice(0, 60) : undefined
        }
      />
    </main>
  );
}
