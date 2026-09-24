'use client';

import { useRef, useState } from 'react';
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
} from '@momentpath/contracts';
import { Alert, Button } from '@momentpath/design-system';
import { ApiError, browserApi, unwrap } from '@/lib/api/browser';

export interface MediaItem {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

type UploadType = (typeof ALLOWED_IMAGE_TYPES)[number] | (typeof ALLOWED_AUDIO_TYPES)[number];

/** Browsers name some audio types differently; map them to the ones the API accepts. */
const AUDIO_ALIASES: Record<string, (typeof ALLOWED_AUDIO_TYPES)[number]> = {
  'audio/mp3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
};

const KINDS = {
  image: {
    types: ALLOWED_IMAGE_TYPES as readonly string[],
    maxBytes: MAX_IMAGE_BYTES,
    wrongType: 'Use a JPEG, PNG, WebP or GIF image.',
    tooBig: 'Images must be 5 MB or smaller.',
    help: 'JPEG, PNG, WebP or GIF up to 5 MB. Location data is removed and every image is checked for viruses.',
    noun: 'image',
  },
  audio: {
    types: ALLOWED_AUDIO_TYPES as readonly string[],
    maxBytes: MAX_AUDIO_BYTES,
    wrongType: 'Use an MP3, M4A, AAC, OGG or WebM audio file.',
    tooBig: 'Voice notes must be 10 MB or smaller.',
    help: 'MP3, M4A, AAC, OGG or WebM up to 10 MB (a few minutes of speech). Checked for viruses.',
    noun: 'voice note',
  },
  music: {
    types: ALLOWED_AUDIO_TYPES as readonly string[],
    maxBytes: MAX_AUDIO_BYTES,
    wrongType: 'Use an MP3, M4A, AAC, OGG or WebM audio file.',
    tooBig: 'Songs must be 10 MB or smaller (about 8 minutes of MP3).',
    help: 'MP3, M4A, AAC, OGG or WebM up to 10 MB. Only upload music you have the right to share — your own recording, or a royalty-free track.',
    noun: 'song',
  },
} as const;

/**
 * Uploads directly to storage with a short-lived signed URL, then asks the API to validate
 * the bytes (type, size, dimensions) before the file can be used.
 */
export function MediaUpload({
  experienceId,
  value,
  media,
  onUploaded,
  onClear,
  label,
  kind = 'image',
}: {
  experienceId: string;
  value: string | null;
  media: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  onClear: () => void;
  label: string;
  kind?: keyof typeof KINDS;
}) {
  const spec = KINDS[kind];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = media.find((m) => m.id === value);
  const isAudio = kind !== 'image';

  async function upload(file: File) {
    setError(null);
    const type = AUDIO_ALIASES[file.type] ?? file.type;
    if (!spec.types.includes(type)) {
      setError(spec.wrongType);
      return;
    }
    if (file.size > spec.maxBytes) {
      setError(spec.tooBig);
      return;
    }
    setBusy(true);
    try {
      const api = browserApi();
      const created = unwrap(
        await api.POST('/api/v1/experiences/{experienceId}/media/uploads', {
          params: { path: { experienceId } },
          body: {
            contentType: type as UploadType,
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
      {current && isAudio ? (
        <audio controls src={current.url} className="w-full" data-testid="audio-preview" />
      ) : current ? (
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
          accept={[...spec.types, ...(isAudio ? Object.keys(AUDIO_ALIASES) : [])].join(',')}
          className="sr-only"
          id={`upload-${label}`}
          data-testid={kind === 'music' ? 'music-input' : isAudio ? 'audio-input' : 'image-input'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button variant="secondary" busy={busy} onClick={() => input.current?.click()}>
          {current ? `Replace ${spec.noun}` : `Upload ${spec.noun}`}
        </Button>
        {current ? (
          <Button variant="ghost" onClick={onClear}>
            Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-500">{spec.help}</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
