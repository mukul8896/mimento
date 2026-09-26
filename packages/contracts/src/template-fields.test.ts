import { describe, expect, it } from 'vitest';
import { richTextFromParagraphs } from './rich-text';
import {
  fieldIssues,
  fillTemplate,
  suggestedDate,
  TemplateFieldSchema,
  type TemplateField,
} from './template-fields';

const fields: TemplateField[] = [
  TemplateFieldSchema.parse({
    key: 'name',
    label: 'Their name',
    placeholder: 'Sophia',
    fallback: 'you',
    required: true,
  }),
  TemplateFieldSchema.parse({ key: 'from', label: 'From', placeholder: 'Ryan', fallback: 'me' }),
  TemplateFieldSchema.parse({
    key: 'when',
    label: 'When',
    placeholder: '',
    kind: 'datetime',
    suggest: 'NEXT_NEW_YEAR',
  }),
];

describe('fillTemplate', () => {
  const content = {
    title: 'Happy birthday, {{name}}!',
    body: richTextFromParagraphs('Dear {{name}},', 'Love, {{from}}'),
    targetAt: '{{when}}',
    untouched: 42,
  };

  it('fills text, rich text and dates from the creator’s values', () => {
    const out = fillTemplate(content, fields, {
      name: 'Jenny',
      from: 'Mark',
      when: '2027-01-01T00:00:00.000Z',
    });
    expect(out.title).toBe('Happy birthday, Jenny!');
    expect(JSON.stringify(out.body)).toContain('Dear Jenny,');
    expect(JSON.stringify(out.body)).toContain('Love, Mark');
    expect(out.targetAt).toBe('2027-01-01T00:00:00.000Z');
    expect(out.untouched).toBe(42);
  });

  it('uses fallbacks when creating and examples when previewing', () => {
    const created = fillTemplate(content, fields, {});
    expect(created.title).toBe('Happy birthday, you!');
    expect(created.targetAt).toBeNull();
    const preview = fillTemplate(content, fields, {}, 'preview');
    expect(preview.title).toBe('Happy birthday, Sophia!');
    expect(typeof preview.targetAt).toBe('string');
  });

  it('treats values as text, never structure', () => {
    const out = fillTemplate(content, fields, { name: '<b>{{from}}</b>"},{"x":1' });
    expect(out.title).toBe('Happy birthday, <b>{{from}}</b>"},{"x":1!');
    expect(Object.keys(out)).toEqual(['title', 'body', 'targetAt', 'untouched']);
  });
});

describe('fieldIssues', () => {
  it('requires required fields, bounds length, checks dates and unknown keys', () => {
    expect(fieldIssues(fields, { name: 'A' })).toEqual([]);
    expect(fieldIssues(fields, {}).map((i) => i.key)).toEqual(['name']);
    expect(fieldIssues(fields, { name: 'x'.repeat(61) })[0]!.message).toMatch(/too long/);
    expect(fieldIssues(fields, { name: 'A', when: 'tomorrow' })[0]!.key).toBe('when');
    expect(fieldIssues(fields, { name: 'A', evil: 'x' })[0]!.key).toBe('evil');
  });
});

describe('suggestedDate', () => {
  it('suggests the next New Year at local midnight', () => {
    const iso = suggestedDate('NEXT_NEW_YEAR', new Date(2026, 5, 15));
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 0, 1, 0]);
    expect(suggestedDate('NONE')).toBe('');
  });
});
