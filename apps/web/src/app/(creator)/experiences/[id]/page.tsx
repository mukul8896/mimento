import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api/server';
import { ManageExperience } from '@/components/creator/manage-experience';
import { Results } from '@/components/creator/results';

export const metadata = { title: 'Experience' };

export default async function ExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const [detail, results] = await Promise.all([
    api.GET('/api/v1/experiences/{id}', { params: { path: { id } } }),
    api.GET('/api/v1/experiences/{id}/results', { params: { path: { id } } }),
  ]);
  if (!detail.data) notFound();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <ManageExperience experience={detail.data} />
      {results.data ? <Results results={results.data} /> : null}
    </main>
  );
}
