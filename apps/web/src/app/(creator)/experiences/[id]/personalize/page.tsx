import { notFound, redirect } from 'next/navigation';
import type { DraftDocument } from '@momentpath/contracts';
import { Personalize } from '@/components/creator/personalize';
import { serverApi } from '@/lib/api/server';

export const metadata = { title: 'Personalize' };

export default async function PersonalizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const path = { params: { path: { id } } };
  const [draft, detail] = await Promise.all([
    api.GET('/api/v1/experiences/{id}/draft', path),
    api.GET('/api/v1/experiences/{id}', path),
  ]);
  if (!draft.data || !detail.data) notFound();
  // A PRO build (from scratch, or a template the creator customised) uses the full builder.
  if (draft.data.mode === 'CUSTOM') redirect(`/experiences/${id}/edit`);
  return <Personalize draft={draft.data as unknown as DraftDocument} detail={detail.data} />;
}
