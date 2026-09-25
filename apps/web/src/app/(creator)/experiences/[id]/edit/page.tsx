import { notFound, redirect } from 'next/navigation';
import type { DraftDocument } from '@momentpath/contracts';
import { Personalize } from '@/components/creator/personalize';
import { serverApi } from '@/lib/api/server';

export const metadata = { title: 'Build' };

/**
 * The PRO builder: the same live-preview screen as Personalize, with the building tools on.
 * A template still being personalised (PLUS) is sent back to its Personalize address.
 */
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const path = { params: { path: { id } } };
  const [draft, detail] = await Promise.all([
    api.GET('/api/v1/experiences/{id}/draft', path),
    api.GET('/api/v1/experiences/{id}', path),
  ]);
  if (!draft.data || !detail.data) notFound();
  if (draft.data.mode === 'TEMPLATE') redirect(`/experiences/${id}/personalize`);
  return <Personalize draft={draft.data as unknown as DraftDocument} detail={detail.data} />;
}
