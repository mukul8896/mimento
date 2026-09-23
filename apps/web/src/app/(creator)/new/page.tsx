import { serverApi } from '@/lib/api/server';
import { NewExperience } from '@/components/creator/new-experience';

export const metadata = { title: 'New experience' };

export default async function NewPage() {
  const api = await serverApi();
  const { data } = await api.GET('/api/v1/templates');
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold">Start a new surprise</h1>
      <p className="mt-1 text-ink-600">
        Pick a template to publish in minutes, or start from a blank page.
      </p>
      <NewExperience templates={data?.items ?? []} />
    </main>
  );
}
