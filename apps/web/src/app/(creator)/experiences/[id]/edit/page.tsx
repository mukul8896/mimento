import { notFound } from 'next/navigation';
import type { DraftDocument } from '@momentpath/contracts';
import { Editor } from '@/components/editor/editor';
import { serverApi } from '@/lib/api/server';

export const metadata = { title: 'Editor' };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await serverApi();
  const { data } = await api.GET('/api/v1/experiences/{id}/draft', { params: { path: { id } } });
  if (!data) notFound();
  return <Editor draft={data as unknown as DraftDocument} />;
}
