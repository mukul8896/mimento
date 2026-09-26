import { useContext } from 'react';
import { richTextIsEmpty } from '@momentpath/contracts';
import { RichText } from '@/components/rich-text';
import { SceneHeading } from '../motion/scene';
import { accentButton } from '../theme';
import type { StepProps } from './types';
import { EditContext, Editable } from '../editable';

export function MessageStep({ step, busy, submit }: StepProps<'MESSAGE'>) {
  // A scene can be a single line ("There is one more thing…"): no empty space below it —
  // unless the creator is editing, when the message is there to be filled in.
  const editing = useContext(EditContext) !== null;
  const showBody = editing || !richTextIsEmpty(step.config.body);
  return (
    <div className="space-y-6 text-center">
      {step.config.heading ? (
        <Editable field="Heading" block>
          <SceneHeading className="text-[1.75em] font-bold leading-tight">
            {step.config.heading}
          </SceneHeading>
        </Editable>
      ) : null}
      {showBody ? (
        <Editable field="Message" block>
          <RichText doc={step.config.body} className="space-y-3 text-[1em] leading-relaxed" />
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
