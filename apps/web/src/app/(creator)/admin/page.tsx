import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api/server';
import { AdminConsole } from '@/components/creator/admin-console';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const api = await serverApi();
  const { data: me } = await api.GET('/api/v1/me');
  if (!me?.isAdmin) notFound();
  const [reports, experiences, audit] = await Promise.all([
    api.GET('/api/v1/admin/reports', { params: { query: { limit: 50 } } }),
    api.GET('/api/v1/admin/experiences', { params: { query: { limit: 50 } } }),
    api.GET('/api/v1/admin/audit-logs', { params: { query: { limit: 50 } } }),
  ]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold">Moderation</h1>
      <AdminConsole
        reports={reports.data?.items ?? []}
        experiences={experiences.data?.items ?? []}
        audit={audit.data?.items ?? []}
      />
    </main>
  );
}
