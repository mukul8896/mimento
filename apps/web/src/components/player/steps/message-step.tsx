import { RichText } from '@/components/rich-text';
import { accentButton } from '../theme';
import type { StepProps } from './types';

export function MessageStep({ step, busy, submit }: StepProps<'MESSAGE'>) {
  return (
    <div className="space-y-6 text-center">
      {step.config.heading ? (
        <h2 className="text-[1.75em] font-bold leading-tight">{step.config.heading}</h2>
      ) : null}
      <RichText doc={step.config.body} className="space-y-3 text-[1em] leading-relaxed" />
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
