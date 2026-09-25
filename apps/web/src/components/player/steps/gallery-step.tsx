import { accentButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

/** Swipe sideways on a phone; each photo keeps its alt text and caption. */
export function GalleryStep({ step, media, busy, submit }: StepProps<'PHOTO_GALLERY'>) {
  const items = step.config.items.flatMap((item) => {
    const m = media.find((x) => x.id === item.mediaId);
    return m ? [{ ...item, url: m.url, width: m.width, height: m.height }] : [];
  });
  return (
    <div className="space-y-5 text-center">
      {step.config.title ? (
        <Editable field="Title" block>
          <h2 className="text-[1.5em] font-bold">{step.config.title}</h2>
        </Editable>
      ) : null}
      <Editable field="Add another photo" block>
        <ul
          className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7"
          aria-label={`${items.length} photos`}
          tabIndex={0}
        >
          {items.map((item, i) => (
            <li key={item.mediaId} className="w-[85%] shrink-0 snap-center">
              <figure className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  referrerPolicy="no-referrer"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="mx-auto max-h-[50dvh] w-full rounded-2xl object-contain shadow-md"
                />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      </Editable>
      {items.length > 1 ? (
        <p className="text-xs opacity-70">Swipe to see all {items.length}</p>
      ) : null}
      <Editable field="Button label" block>
        <button
          type="button"
          className={`${accentButton} w-full sm:w-auto`}
          disabled={busy}
          onClick={() => void submit({ kind: 'ACK' })}
        >
          {step.config.buttonLabel}
        </button>
      </Editable>
    </div>
  );
}
