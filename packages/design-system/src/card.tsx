import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-100 sm:p-6', className)}
      {...rest}
    />
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
};

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function Alert({
  tone = 'info',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const styles = {
    info: 'bg-sky-50 text-sky-900 ring-sky-200',
    warning: 'bg-amber-50 text-amber-950 ring-amber-200',
    danger: 'bg-red-50 text-red-900 ring-red-200',
    success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  }[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('rounded-xl p-3 text-sm ring-1 ring-inset', styles, className)}
      {...rest}
    />
  );
}
