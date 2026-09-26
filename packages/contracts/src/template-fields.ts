import { z } from 'zod';

/**
 * Quick personalisation for ready-made templates. A template declares a few fields ("Their
 * name", "From"); its text uses `{{fieldKey}}` placeholders, and creating an experience fills
 * them in once. After that the draft is ordinary text the creator can keep editing.
 *
 * Values are plain text inserted into plain-text and rich-text strings (never HTML), so a value
 * cannot change the structure of a step.
 */

const FIELD_KEY = /^[a-z][a-zA-Z0-9]{0,30}$/;
const PLACEHOLDER = /\{\{([a-z][a-zA-Z0-9]{0,30})\}\}/g;

/** Suggested value for a date field, computed when the form opens. */
export const DATE_SUGGESTIONS = ['NONE', 'NEXT_NEW_YEAR', 'IN_7_DAYS', 'TOMORROW_MORNING'] as const;

export const TemplateFieldSchema = z.strictObject({
  key: z.string().regex(FIELD_KEY),
  label: z.string().min(1).max(60),
  /** Example shown in the form and used in previews, e.g. "Sophia". */
  placeholder: z.string().max(80),
  /** Used when the creator leaves the field empty, e.g. "you". */
  fallback: z.string().max(80).default(''),
  kind: z.enum(['text', 'datetime']).default('text'),
  maxLength: z.number().int().min(1).max(200).default(60),
  required: z.boolean().default(false),
  suggest: z.enum(DATE_SUGGESTIONS).default('NONE'),
});
export type TemplateField = z.infer<typeof TemplateFieldSchema>;

export const TemplateFieldValuesSchema = z
  .record(z.string().regex(FIELD_KEY), z.string().max(200))
  .refine((v) => Object.keys(v).length <= 12, 'Too many fields');
export type TemplateFieldValues = z.infer<typeof TemplateFieldValuesSchema>;

/** The suggested date for a field, as an ISO string, or '' when there is none. */
export function suggestedDate(suggest: TemplateField['suggest'], now: Date = new Date()): string {
  const d = new Date(now);
  if (suggest === 'NEXT_NEW_YEAR')
    return new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0).toISOString();
  if (suggest === 'IN_7_DAYS') {
    d.setDate(d.getDate() + 7);
    d.setHours(19, 0, 0, 0);
    return d.toISOString();
  }
  if (suggest === 'TOMORROW_MORNING') {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  return '';
}

export type FieldIssue = { key: string; message: string };

/** Checks creator-supplied values against the template's fields. */
export function fieldIssues(
  fields: readonly TemplateField[],
  values: TemplateFieldValues,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const known = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) issues.push({ key, message: 'Unknown field' });
  }
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (field.required && value === '')
      issues.push({ key: field.key, message: `${field.label} is required` });
    if (value.length > field.maxLength) {
      issues.push({ key: field.key, message: `${field.label} is too long` });
    }
    if (
      field.kind === 'datetime' &&
      value !== '' &&
      !z.iso.datetime({ offset: true }).safeParse(value).success
    ) {
      issues.push({ key: field.key, message: `${field.label} is not a valid date` });
    }
  }
  return issues;
}

/**
 * Replaces `{{key}}` in every string inside `value` (steps, title, gift defaults). A string that
 * is exactly one date placeholder becomes that ISO date, or null when left empty, so it can fill
 * nullable date settings such as a countdown target. `mode: 'preview'` uses the examples.
 */
export function fillTemplate<T>(
  value: T,
  fields: readonly TemplateField[],
  values: TemplateFieldValues,
  mode: 'create' | 'preview' = 'create',
): T {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const valueOf = (key: string): string => {
    const field = byKey.get(key);
    if (!field) return '';
    const given = (values[key] ?? '').trim().slice(0, field.maxLength);
    if (given) return given;
    if (mode === 'preview') {
      return field.kind === 'datetime' ? suggestedDate(field.suggest) : field.placeholder;
    }
    return field.fallback;
  };
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const whole = /^\{\{([a-z][a-zA-Z0-9]{0,30})\}\}$/.exec(node);
      if (whole && byKey.get(whole[1]!)?.kind === 'datetime') return valueOf(whole[1]!) || null;
      return node.replace(PLACEHOLDER, (_, key: string) => valueOf(key));
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return walk(value) as T;
}
