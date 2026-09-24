'use client';

import Link from 'next/link';
import { WhatsAppShare } from '@/components/creator/whatsapp-share';
import { useState } from 'react';
import { Alert, Button, Dialog, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

interface Issue {
  stepKey: string | null;
  field: string | null;
  message: string;
}

export function PublishDialog({
  experienceId,
  open,
  onOpenChange,
  flush,
  onSelectStep,
  stepLabel,
}: {
  experienceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flush: () => Promise<boolean>;
  onSelectStep: (key: string) => void;
  stepLabel: (key: string) => string;
}) {
  const [phase, setPhase] = useState<'confirm' | 'working' | 'issues' | 'done' | 'error'>(
    'confirm',
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function publish() {
    setPhase('working');
    setError(null);
    const api = browserApi();
    const path = { id: experienceId };
    try {
      if (!(await flush())) throw new Error('Your latest changes could not be saved.');
      const check = unwrap(
        await api.POST('/api/v1/experiences/{id}/publish-check', { params: { path } }),
      );
      if (!check.ok) {
        setIssues(check.issues);
        setPhase('issues');
        return;
      }
      unwrap(
        await api.POST('/api/v1/experiences/{id}/publish', {
          params: { path, header: { 'Idempotency-Key': crypto.randomUUID() } },
        }),
      );
      const share = unwrap(
        await api.GET('/api/v1/experiences/{id}/share-link', { params: { path } }),
      );
      setLink(`${window.location.origin}/e/${share.shareToken}`);
      setPhase('done');
    } catch (err) {
      if (err instanceof ApiError && err.problem.issues?.length) {
        setIssues(err.problem.issues);
        setPhase('issues');
        return;
      }
      setError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : (err as Error).message,
      );
      setPhase('error');
    }
  }

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(() => setPhase('confirm'), 200);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={
        phase === 'done'
          ? 'Your surprise is live 🎉'
          : phase === 'issues'
            ? 'A few things to fix'
            : 'Publish'
      }
      description={
        phase === 'done'
          ? 'Share this private link with your recipient.'
          : phase === 'issues'
            ? 'Publishing is blocked until these are fixed.'
            : 'Recipients will see exactly this version. Later edits stay private until you publish again.'
      }
      footer={
        phase === 'done' ? (
          <>
            <Link
              href={`/experiences/${experienceId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium ring-1 ring-ink-200"
            >
              Manage & results
            </Link>
            <Button onClick={() => close(false)}>Keep editing</Button>
          </>
        ) : phase === 'issues' ? (
          <Button onClick={() => close(false)}>Back to editing</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button busy={phase === 'working'} onClick={publish} data-testid="confirm-publish">
              Publish now
            </Button>
          </>
        )
      }
    >
      {phase === 'done' && link ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={link}
              aria-label="Private link"
              data-testid="share-link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <WhatsAppShare link={link} className="w-full" />
          <p className="text-xs text-ink-500">
            Anyone with the link can open it, and recipients can take screenshots. The link is
            hidden from search engines.
          </p>
        </div>
      ) : null}
      {phase === 'issues' ? (
        <ul className="space-y-2" data-testid="publish-issues">
          {issues.map((issue, i) => (
            <li key={i} className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              {issue.stepKey ? (
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => {
                    onSelectStep(issue.stepKey!);
                    close(false);
                  }}
                >
                  {stepLabel(issue.stepKey)}
                </button>
              ) : (
                <span className="font-medium">Experience</span>
              )}
              : {issue.message}
              {issue.field === 'tier' ? (
                <>
                  {' '}
                  <Link
                    href={`/experiences/${experienceId}#unlock`}
                    className="font-medium underline"
                  >
                    See prices
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {phase === 'error' && error ? <Alert tone="danger">{error}</Alert> : null}
    </Dialog>
  );
}
