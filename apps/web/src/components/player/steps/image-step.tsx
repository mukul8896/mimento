import { accentButton } from '../theme';
import type { StepProps } from './types';

export function ImageStep({ step, media, busy, submit }: StepProps<'IMAGE'>) {
  const image = media.find((m) => m.id === step.config.mediaId);
  return (
    <figure className="space-y-4 text-center">
      {image ? (
        // Signed, short-lived URLs; next/image optimisation would proxy and cache private media.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={step.config.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          referrerPolicy="no-referrer"
          className="mx-auto max-h-[60dvh] w-auto max-w-full rounded-2xl object-contain shadow-md"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-black/5 text-sm opacity-70">
          Image not available
        </div>
      )}
      {step.config.caption ? (
        <figcaption className="text-[1.05em]">{step.config.caption}</figcaption>
      ) : null}
      <button
        type="button"
        className={`${accentButton} w-full sm:w-auto`}
        disabled={busy}
        onClick={() => void submit({ kind: 'ACK' })}
      >
        {step.config.buttonLabel}
      </button>
    </figure>
  );
}
