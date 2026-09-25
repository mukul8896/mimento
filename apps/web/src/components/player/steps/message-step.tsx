import { RichText } from '@/components/rich-text';
import { accentButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

export function MessageStep({ step, busy, submit }: StepProps<'MESSAGE'>) {
  return (
    <div className="space-y-6 text-center">
      {step.config.heading ? (
        <Editable field="Heading" block>
          <h2 className="text-[1.75em] font-bold leading-tight">{step.config.heading}</h2>
        </Editable>
      ) : null}
      <Editable field="Message" block>
        <RichText doc={step.config.body} className="space-y-3 text-[1em] leading-relaxed" />
      </Editable>
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
