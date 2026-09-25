'use client';

import { useId, useState } from 'react';
import { emojiOnly } from '@momentpath/contracts';
import { useFx } from '../fx/fx';
import { accentButton } from '../theme';
import type { StepProps } from './types';
import { Editable } from '../editable';

export function MultipleChoiceStep({ step, busy, submit }: StepProps<'MULTIPLE_CHOICE'>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const id = useId();
  const fx = useFx();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const correct = await submit({ kind: 'OPTION', optionId: selected });
    setWrong(correct === false && step.config.requireCorrect);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-4 w-full text-center text-[1.5em] font-bold leading-tight">
          <Editable field="Question" block>
            {step.config.question}
          </Editable>
        </legend>
        {step.config.options.map((option, i) => {
          const checked = selected === option.id;
          const emoji = emojiOnly(option.emoji);
          return (
            <Editable key={option.id} field={`Answer ${i + 1}`} block>
              <label
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-[var(--mp-surface)] px-4 py-3 ring-2 ring-inset transition ${
                  checked ? 'ring-[var(--mp-accent)]' : 'ring-black/10'
                } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--mp-accent)]`}
              >
                <input
                  type="radio"
                  name={id}
                  value={option.id}
                  checked={checked}
                  onChange={(e) => {
                    setSelected(option.id);
                    setWrong(false);
                    fx.effect('POP');
                    if (emoji) fx.burst({ emoji, at: e.currentTarget.parentElement });
                  }}
                  className="size-5 accent-[var(--mp-accent)]"
                />
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
                {/* Shown beside the answer unless the answer text already contains it. */}
                {emoji && !option.label.includes(emoji) ? (
                  <span
                    aria-hidden="true"
                    className={`shrink-0 transition ${checked ? 'scale-125' : ''}`}
                  >
                    {emoji}
                  </span>
                ) : null}
              </label>
            </Editable>
          );
        })}
      </fieldset>
      <p role="status" aria-live="polite" className="min-h-6 text-center font-medium">
        {wrong ? step.config.wrongAnswerMessage : ''}
      </p>
      <button type="submit" className={`${accentButton} w-full`} disabled={busy || !selected}>
        Continue
      </button>
    </form>
  );
}
