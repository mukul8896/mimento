'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Textarea,
} from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/lib/format';

type Report = Schemas['AdminReportListResponseDto_Output']['items'][number];
type Experience = Schemas['AdminExperienceListResponseDto_Output']['items'][number];
type Audit = Schemas['AuditLogListResponseDto_Output']['items'][number];
type Content = Schemas['AdminContentDto_Output'];

export function AdminConsole({
  reports,
  experiences,
  audit,
}: {
  reports: Report[];
  experiences: Experience[];
  audit: Audit[];
}) {
  const router = useRouter();
  const api = browserApi();
  const [tab, setTab] = useState<'reports' | 'experiences' | 'audit'>('reports');
  const [error, setError] = useState<string | null>(null);
  const [takedown, setTakedown] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [content, setContent] = useState<Content | null>(null);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : 'Action failed');
    }
  }

  const tabs = [
    ['reports', `Reports (${reports.filter((r) => r.status === 'OPEN').length} open)`],
    ['experiences', 'Experiences'],
    ['audit', 'Audit log'],
  ] as const;

  return (
    <div className="mt-4 space-y-4">
      <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === id ? 'bg-ink-900 text-white' : 'bg-white ring-1 ring-ink-200'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {tab === 'reports' ? (
        <ul className="space-y-3">
          {reports.length === 0 ? <p className="text-sm text-ink-600">No reports.</p> : null}
          {reports.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.category.replace(/_/g, ' ').toLowerCase()}</span>
                  <Badge tone={r.status === 'OPEN' ? 'warning' : 'neutral'}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-600">
                  {r.experienceTitle ?? 'Deleted experience'} · {formatDateTime(r.createdAt)}
                </p>
                {r.details ? <p className="mt-2 whitespace-pre-line text-sm">{r.details}</p> : null}
                {r.status === 'OPEN' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.experienceId ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            act(async () =>
                              setContent(
                                unwrap(
                                  await api.GET('/api/v1/admin/experiences/{id}/content', {
                                    params: { path: { id: r.experienceId! } },
                                  }),
                                ),
                              ),
                            )
                          }
                        >
                          Review content
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setTakedown(r.experienceId)}
                        >
                          Take down
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        act(async () =>
                          unwrap(
                            await api.POST('/api/v1/admin/reports/{id}/resolve', {
                              params: { path: { id: r.id } },
                              body: { resolution: 'DISMISSED', note: '' },
                            }),
                          ),
                        )
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'experiences' ? (
        <ul className="space-y-3">
          {experiences.map((e) => (
            <li key={e.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{e.title || 'Untitled'}</span>
                  <div className="flex gap-2">
                    <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    {e.moderationState === 'TAKEN_DOWN' ? (
                      <Badge tone="danger">Taken down</Badge>
                    ) : null}
                    {e.openReports > 0 ? (
                      <Badge tone="warning">{e.openReports} reports</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.moderationState === 'TAKEN_DOWN' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        act(async () =>
                          unwrap(
                            await api.POST('/api/v1/admin/experiences/{id}/restore', {
                              params: { path: { id: e.id } },
                            }),
                          ),
                        )
                      }
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setTakedown(e.id)}>
                      Take down
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'audit' ? (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-ink-100">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-ink-50 text-ink-600">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="p-3">{a.actorType}</td>
                  <td className="p-3 font-mono text-xs">{a.action}</td>
                  <td className="p-3 font-mono text-xs">
                    {a.targetType}:{a.targetId?.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog
        open={takedown !== null}
        onOpenChange={(o) => !o && setTakedown(null)}
        title="Take down this experience?"
        description="The link stops working immediately and open reports are marked as actioned. The creator sees the reason."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTakedown(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim() === ''}
              onClick={() =>
                act(async () => {
                  unwrap(
                    await api.POST('/api/v1/admin/experiences/{id}/takedown', {
                      params: { path: { id: takedown! } },
                      body: { reason },
                    }),
                  );
                  setTakedown(null);
                  setReason('');
                })
              }
            >
              Take down
            </Button>
          </>
        }
      >
        <Field label="Reason shown to the creator">
          {(p) => (
            <Textarea
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              {...p}
            />
          )}
        </Field>
      </Dialog>

      <Dialog
        open={content !== null}
        onOpenChange={(o) => !o && setContent(null)}
        title="Published content"
        description="Gift details are never shown to moderators."
      >
        {content ? (
          <ol className="space-y-2 text-sm">
            <li className="font-medium">{content.title}</li>
            {content.steps.map((s, i) => (
              <li key={s.key} className="rounded-xl bg-ink-50 p-3">
                <span className="text-xs text-ink-500">
                  {i + 1}. {s.type}
                </span>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans">
                  {JSON.stringify(s.config, null, 1)}
                </pre>
              </li>
            ))}
          </ol>
        ) : null}
        <Input type="hidden" />
      </Dialog>
    </div>
  );
}
