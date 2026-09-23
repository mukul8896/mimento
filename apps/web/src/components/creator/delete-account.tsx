'use client';

import { useState } from 'react';
import { Alert, Button, Card, Dialog, Field, Input } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      unwrap(await browserApi().DELETE('/api/v1/me'));
      // Nothing to sign out of; clear the credential this browser holds.
      const form = document.createElement('form');
      form.method = 'post';
      form.action = '/forget';
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof ApiError ? err.problem.title : 'Could not delete the account.');
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold text-red-800">Delete account</h2>
      <p className="mt-1 text-sm text-ink-600">
        Permanently deletes your account, every experience, all recipient answers and uploaded
        images. Shared links stop working immediately.
      </p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This cannot be undone. Type DELETE to confirm."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={text !== 'DELETE'} busy={busy} onClick={remove}>
              Delete account
            </Button>
          </>
        }
      >
        <Field label="Confirmation">
          {(p) => (
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              {...p}
            />
          )}
        </Field>
        {error ? (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        ) : null}
      </Dialog>
    </Card>
  );
}
