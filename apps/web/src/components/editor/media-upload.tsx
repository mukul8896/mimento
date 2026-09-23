'use client';

import { useRef, useState } from 'react';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@momentpath/contracts';
import { Alert, Button } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

export interface MediaItem {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

/**
 * Uploads directly to storage with a short-lived signed URL, then asks the API to validate
 * the bytes (type, size, dimensions) before the image can be used.
 */
export function MediaUpload({
  experienceId,
  value,
  media,
  onUploaded,
  onClear,
  label,
}: {
  experienceId: string;
  value: string | null;
  media: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  onClear: () => void;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = media.find((m) => m.id === value);

  async function upload(file: File) {
    setError(null);
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError('Use a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Images must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const api = browserApi();
      const created = unwrap(
        await api.POST('/api/v1/experiences/{experienceId}/media/uploads', {
          params: { path: { experienceId } },
          body: {
            contentType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
            sizeBytes: file.size,
          },
        }),
      );
      const put = await fetch(created.upload.url, {
        method: 'PUT',
        headers: created.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      const done = unwrap(
        await api.POST('/api/v1/experiences/{experienceId}/media/{mediaId}/complete', {
          params: { path: { experienceId, mediaId: created.mediaId } },
        }),
      );
      if (!done.url) throw new Error('Upload not ready');
      onUploaded({ id: done.id, url: done.url, width: done.width, height: done.height });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.problem.detail ?? err.problem.title)
          : 'The upload failed. Please try again.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-ink-800">{label}</span>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current.url}
          alt=""
          className="max-h-48 rounded-xl object-contain ring-1 ring-ink-100"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="sr-only"
          id={`upload-${label}`}
          data-testid="image-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button variant="secondary" busy={busy} onClick={() => input.current?.click()}>
          {current ? 'Replace image' : 'Upload image'}
        </Button>
        {current ? (
          <Button variant="ghost" onClick={onClear}>
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-500">
        JPEG, PNG, WebP or GIF up to 5 MB. Location data is removed from JPEG and PNG files.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
