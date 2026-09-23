'use client';

import { useState } from 'react';
import { Button, Dialog, Field, Select, Textarea } from '@momentpath/design-system';

const CATEGORIES = [
  ['HARASSMENT', 'Harassment or bullying'],
  ['SEXUAL_CONTENT', 'Sexual content'],
  ['HATE', 'Hate speech'],
  ['SCAM_OR_FRAUD', 'Scam or fraud'],
  ['VIOLENCE', 'Violence or threats'],
  ['COPYRIGHT', 'Copyright'],
  ['OTHER', 'Something else'],
] as const;

export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (category: string, details: string) => Promise<void>;
}) {
  const [category, setCategory] = useState<string>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setState('idle');
      }}
      title="Report this page"
      description="Reports go to the MomentPath team, not to the person who sent this. You stay anonymous."
      footer={
        state === 'sent' ? (
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              busy={state === 'sending'}
              onClick={async () => {
                setState('sending');
                try {
                  await onSubmit(category, details);
                  setState('sent');
                } catch {
                  setState('error');
                }
              }}
            >
              Send report
            </Button>
          </>
        )
      }
    >
      {state === 'sent' ? (
        <p role="status" className="text-sm text-ink-700">
          Thank you. Our team will review this page.
        </p>
      ) : (
        <div className="space-y-4 text-ink-900">
          <Field label="Reason">
            {(p) => (
              <Select value={category} onChange={(e) => setCategory(e.target.value)} {...p}>
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Details (optional)" hint="Do not include personal information.">
            {(p) => (
              <Textarea
                value={details}
                maxLength={1000}
                onChange={(e) => setDetails(e.target.value)}
                {...p}
              />
            )}
          </Field>
          {state === 'error' ? (
            <p role="alert" className="text-sm text-danger-700">
              The report could not be sent. Please try again.
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
