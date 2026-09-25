'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Tap-to-edit inside the preview (Personalize page). `field` is the label of the matching
 * input in the step form, so the editor can focus it. Recipients never get this context, so
 * for them every <Editable> is just its children.
 */
export interface EditTarget {
  onEdit: (field: string) => void;
}

export const EditContext = createContext<EditTarget | null>(null);

/** A drawn pencil: crisp at any size, unlike the ✎ character, which is tiny in most fonts. */
export function PencilIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function Editable({
  field,
  children,
  block = false,
  className = '',
}: {
  field: string;
  children: ReactNode;
  /** Headings, messages and photos take the full width; buttons and labels shrink to fit. */
  block?: boolean;
  className?: string;
}) {
  const edit = useContext(EditContext);
  if (!edit) return <>{children}</>;
  const Tag = block ? 'div' : 'span';
  return (
    <Tag
      data-editable={field}
      className={`mp-editable group relative scroll-mt-24 ${block ? 'block' : 'inline-block max-w-full'} ${className}`}
      // Capture, so the underlying button (Continue, Yes, Reveal…) does not act while editing,
      // and a scratch card or a teasing No button does not react to the finger either.
      onPointerDownCapture={(e) => e.stopPropagation()}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Keep what is being edited in view above the edit sheet.
        e.currentTarget.scrollIntoView({ block: 'start', behavior: 'smooth' });
        edit.onEdit(field);
      }}
      onKeyDownCapture={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        edit.onEdit(field);
      }}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 -right-3 z-10 inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-[3px] ring-white"
      >
        <PencilIcon className="size-4" />
      </span>
    </Tag>
  );
}
