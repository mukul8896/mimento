import { useEffect } from 'react';
import { useFx } from '../fx/fx';
import { accentButton } from '../theme';
import type { StepProps } from './types';

export function VoiceNoteStep({ step, media, busy, submit }: StepProps<'VOICE_NOTE'>) {
  const audio = media.find((m) => m.id === step.config.mediaId);
  const fx = useFx();
  // Background music steps back while the voice note plays.
  useEffect(() => () => fx.duck(false), [fx]);
  return (
    <div className="space-y-5 text-center">
      <p className="text-[2.5em]" aria-hidden="true">
        🎙️
      </p>
      {step.config.title ? <h2 className="text-[1.5em] font-bold">{step.config.title}</h2> : null}
      {audio ? (
        <audio
          controls
          preload="metadata"
          src={audio.url}
          className="w-full"
          data-testid="voice-note"
          onPlay={() => fx.duck(true)}
          onPause={() => fx.duck(false)}
          onEnded={() => fx.duck(false)}
        />
      ) : (
        <p className="opacity-70">This voice note is not available.</p>
      )}
      {step.config.transcript ? (
        <details className="rounded-2xl bg-black/5 p-3 text-left">
          <summary className="cursor-pointer font-medium">Read the transcript</summary>
          <p className="mt-2 whitespace-pre-line">{step.config.transcript}</p>
        </details>
      ) : null}
      <button
        type="button"
        className={`${accentButton} w-full sm:w-auto`}
        disabled={busy}
        onClick={() => void submit({ kind: 'ACK' })}
      >
        {step.config.buttonLabel}
      </button>
    </div>
  );
}
