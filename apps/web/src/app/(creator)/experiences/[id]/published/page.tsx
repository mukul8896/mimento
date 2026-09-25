import { notFound, redirect } from 'next/navigation';
import { PublishedSuccess } from '@/components/creator/published-success';
import { serverApi } from '@/lib/api/server';

export const metadata = { title: 'Your surprise is ready' };

/**
 * "Your Surprise Is Ready!": where Publish ends, with or without a payment in between. The links
 * themselves are fetched by the page script, so the private link never sits in server HTML.
 */
export default async function PublishedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const { data } = await api.GET('/api/v1/experiences/{id}', { params: { path: { id } } });
  if (!data) notFound();
  if (!data.publishedAt) {
    redirect(`/experiences/${id}/${data.mode === 'TEMPLATE' ? 'personalize' : 'edit'}`);
  }
  return (
    <PublishedSuccess
      experienceId={id}
      title={data.title}
      createdAt={data.createdAt}
      publishedAt={data.publishedAt}
      hasPin={data.access.hasPin}
      shortPath={data.access.slug ? `/p/${data.access.slug}` : null}
    />
  );
}
