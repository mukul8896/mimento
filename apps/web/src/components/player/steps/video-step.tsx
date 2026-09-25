import { parseVideoUrl, videoEmbedUrl } from '@momentpath/contracts';
import { accentButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

/**
 * YouTube (no-cookie domain) or Vimeo (do-not-track) in an iframe. These two origins are the
 * only frames the recipient page's CSP allows. The embed gets our origin as its referrer, never
 * the private link, because YouTube refuses to play without one.
 */
export function VideoStep({ step, busy, submit }: StepProps<'VIDEO'>) {
  const ref = parseVideoUrl(step.config.url);
  return (
    <div className="space-y-5 text-center">
      {step.config.title ? (
        <Editable field="Title" block>
          <h2 className="text-[1.5em] font-bold">{step.config.title}</h2>
        </Editable>
      ) : null}
      <Editable field="YouTube or Vimeo link" block>
        {ref ? (
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-md">
            <iframe
              src={videoEmbedUrl(ref)}
              title={step.config.title || 'Video'}
              className="size-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin"
              loading="lazy"
              data-testid="video-embed"
            />
          </div>
        ) : (
          <p className="opacity-70">This video is not available.</p>
        )}
      </Editable>
      {step.config.caption ? (
        <Editable field="Caption" block>
          <p>{step.config.caption}</p>
        </Editable>
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
