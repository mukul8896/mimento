'use client';

import { useState } from 'react';
import { Alert, Button, Input } from '@momentpath/design-system';

/**
 * Without accounts this link is the only way back after clearing browser data. It is a master
 * key, so it stays hidden until asked for and says plainly what it can do.
 */
export function RecoveryLink({ url }: { url: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!shown) {
    return <Button onClick={() => setShown(true)}>Show my recovery link</Button>;
  }

  return (
    <div className="space-y-3">
      <Alert tone="warning">
        Anyone with this link can open, edit and delete every surprise you have made. Save it
        somewhere private — a password manager or a note to yourself. Do not send it to the person
        receiving the surprise; they get a different link.
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          aria-label="Your recovery link"
          onFocus={(e) => e.target.select()}
        />
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
  );
}
