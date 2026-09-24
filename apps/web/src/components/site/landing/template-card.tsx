'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { Schemas } from '@momentpath/api-client';

export type TemplateSummary = Schemas['TemplateListResponseDto_Output']['items'][number];

const TIER_TAG = { FREE: 'Free', PLUS: 'Plus', PRO: 'Custom' } as const;

/** A template drawn in its own colours, so the gallery feels like a wall of cards to open. */
export function TemplateCard({
  template,
  onSelect,
  hint,
  action,
  busy,
}: {
  template: TemplateSummary;
  /** What tapping the card does: play the demo (landing) or start using it (new page). */
  onSelect: () => void;
  hint: string;
  action: React.ReactNode;
  busy?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const p = template.theme.palette;
  return (
    <motion.article
      whileHover={reduced ? undefined : { y: -6 }}
      className="flex h-full flex-col overflow-hidden rounded-3xl shadow-md ring-1 ring-black/5"
      style={{ background: p.background, color: p.text }}
      data-testid={`template-${template.key}`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={busy}
        className="group flex flex-1 flex-col items-start gap-3 p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] disabled:opacity-70"
      >
        <span className="flex w-full items-start justify-between">
          <motion.span
            aria-hidden="true"
            className="inline-flex size-14 items-center justify-center rounded-2xl text-3xl shadow-sm"
            style={{ background: p.surface }}
            whileHover={reduced ? undefined : { rotate: [0, -12, 12, 0], scale: 1.1 }}
            transition={{ duration: 0.6 }}
          >
            {template.emoji}
          </motion.span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: p.accent, color: p.accentText }}
          >
            {TIER_TAG[template.tier]}
          </span>
        </span>
        <span className="text-lg font-bold leading-tight">{template.name}</span>
        <span className="text-sm opacity-80">{template.description}</span>
        <span className="mt-auto text-sm font-semibold underline decoration-2 underline-offset-4">
          {hint}
        </span>
      </button>
      <div className="px-5 pb-5">{action}</div>
    </motion.article>
  );
}
