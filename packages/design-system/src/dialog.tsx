'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /**
   * Focus the first control on open (default). Turn off for sheets whose first control is a
   * date or text input: on a phone that would pop up the keyboard before anything is read.
   */
  autoFocus?: boolean;
  /** A lighter backdrop, for sheets that edit something the person should still see. */
  lightOverlay?: boolean;
  /**
   * On wide screens, dock at the right edge with no backdrop instead of the middle, so a live
   * preview on the left stays in view while it is edited. Phones keep the bottom sheet.
   */
  side?: boolean;
}

/** Accessible modal (focus trap, Escape to close, labelled). Sheet-style on phones. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  autoFocus = true,
  lightOverlay = false,
  side = false,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cx(
            'fixed inset-0 z-50',
            lightOverlay ? 'bg-ink-950/15' : 'bg-ink-950/40',
            side && 'lg:bg-transparent',
          )}
        />
        <RadixDialog.Content
          onOpenAutoFocus={autoFocus ? undefined : (e) => e.preventDefault()}
          className={cx(
            'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            side &&
              'lg:top-20 lg:right-6 lg:bottom-6 lg:left-auto lg:max-h-none lg:w-[26rem] lg:max-w-none lg:translate-x-0 lg:translate-y-0 lg:shadow-2xl lg:ring-1 lg:ring-ink-100',
            className,
          )}
        >
          <RadixDialog.Close
            aria-label="Close"
            data-testid="dialog-close"
            className="float-right -mt-1 -mr-1 ml-3 inline-flex size-11 items-center justify-center rounded-full text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </RadixDialog.Close>
          <RadixDialog.Title className="text-lg font-semibold text-ink-900">
            {title}
          </RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-sm text-ink-600">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">Dialog</RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
          {footer ? (
            // Stays in view while the sheet scrolls, so the main action is never below the fold.
            <div className="sticky z-10 -bottom-[max(1.25rem,env(safe-area-inset-bottom))] -mx-5 mt-6 flex flex-col-reverse gap-2 border-t border-ink-100 bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-bottom-6 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
