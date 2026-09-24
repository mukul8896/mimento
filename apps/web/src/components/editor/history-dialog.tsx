'use client';

import { useEffect, useState } from 'react';
import type { Schemas } from '@momentpath/api-client';
import { Alert, Badge, Button, Dialog } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';
import { formatDateTime } from '@/lib/format';

type Version = Schemas['VersionListResponseDto_Output']['items'][number];

/**
 * Published versions of this surprise, each restorable into the draft. Restoring replaces the
 * draft (steps, branching, look and surprise details) and reloads the editor; what recipients
 * see changes only when the creator publishes again.
 */
export function HistoryDialog({
  experienceId,
  open,
  onOpenChange,
}: {
  experienceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = unwrap(
          await browserApi().GET('/api/v1/experiences/{id}/versions', {
            params: { path: { id: experienceId } },
          }),
        );
        if (!cancelled) {
          setError(null);
          setVersions(res.items);
        }
      } catch {
        if (!cancelled) setError('The history could not be loaded.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, experienceId]);

  async function restore(number: number) {
    setBusy(true);
    setError(null);
    try {
      unwrap(
        await browserApi().POST('/api/v1/experiences/{id}/versions/{number}/restore', {
          params: { path: { id: experienceId, number } },
        }),
      );
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Restore failed.',
      );
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setConfirming(null);
          setError(null);
        }
        onOpenChange(next);
      }}
      title="Version history"
      description="Every time you publish, a version is kept. Restore one to continue editing from it."
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {versions === null && !error ? <p className="text-sm text-ink-600">Loading…</p> : null}
      {versions?.length === 0 ? (
        <p className="text-sm text-ink-600">
          Nothing published yet. Versions appear here after you publish.
        </p>
      ) : null}
      <ul className="space-y-2" data-testid="version-list">
        {versions?.map((v) => (
          <li key={v.number} className="rounded-xl p-3 ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Version {v.number}</span>
              {v.isActive ? <Badge tone="success">Live</Badge> : null}
              <span className="text-xs text-ink-500">
                {formatDateTime(v.publishedAt)} · {v.stepCount} steps
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-ink-600">{v.title || 'Untitled'}</p>
            <div className="mt-2">
              {confirming === v.number ? (
                <div className="space-y-2">
                  <p className="text-sm text-ink-700">
                    Your current draft will be replaced by version {v.number}. Recipients keep
                    seeing the live version until you publish.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" busy={busy} onClick={() => restore(v.number)}>
                      Restore version {v.number}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirming(v.number)}>
                  Restore…
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
