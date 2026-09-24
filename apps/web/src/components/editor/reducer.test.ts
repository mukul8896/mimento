import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, DraftStepSchema, MAX_STEPS } from '@momentpath/contracts';
import { editorReducer, type EditorState } from './reducer';
import { normalizeRichText } from './normalize-rich-text';

const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const empty: EditorState = {
  title: 't',
  theme: DEFAULT_THEME,
  settings: { responseVisibility: 'FULL' },
  steps: [],
  selectedKey: null,
};

describe('editorReducer', () => {
  it('adds valid default steps and keeps the final surprise last', () => {
    let s = editorReducer(empty, { type: 'add', stepType: 'GIFT_REVEAL', key: key(1) });
    s = editorReducer(s, { type: 'add', stepType: 'MESSAGE', key: key(2) });
    s = editorReducer(s, { type: 'add', stepType: 'YES_NO_CHOICE', key: key(3) });
    expect(s.steps.map((x) => x.type)).toEqual(['MESSAGE', 'YES_NO_CHOICE', 'GIFT_REVEAL']);
    expect(s.selectedKey).toBe(key(3));
    for (const step of s.steps) expect(DraftStepSchema.safeParse(step).success).toBe(true);
  });

  it('allows only one final surprise and caps the number of steps', () => {
    let s = editorReducer(empty, { type: 'add', stepType: 'GIFT_REVEAL', key: key(1) });
    s = editorReducer(s, { type: 'add', stepType: 'GIFT_REVEAL', key: key(2) });
    expect(s.steps).toHaveLength(1);
    for (let i = 0; i < MAX_STEPS + 5; i++)
      s = editorReducer(s, { type: 'add', stepType: 'MESSAGE', key: key(100 + i) });
    expect(s.steps).toHaveLength(MAX_STEPS);
  });

  it('duplicates with a new key right after the original, but never the gift', () => {
    let s = editorReducer(empty, { type: 'add', stepType: 'MESSAGE', key: key(1) });
    s = editorReducer(s, { type: 'add', stepType: 'GIFT_REVEAL', key: key(2) });
    s = editorReducer(s, { type: 'duplicate', key: key(1), newKey: key(3) });
    expect(s.steps.map((x) => x.key)).toEqual([key(1), key(3), key(2)]);
    expect(s.steps[1]!.config).not.toBe(s.steps[0]!.config);
    expect(editorReducer(s, { type: 'duplicate', key: key(2), newKey: key(4) }).steps).toHaveLength(
      3,
    );
  });

  it('reorders within bounds and removes with sensible selection', () => {
    let s = editorReducer(empty, { type: 'add', stepType: 'MESSAGE', key: key(1) });
    s = editorReducer(s, { type: 'add', stepType: 'IMAGE', key: key(2) });
    s = editorReducer(s, { type: 'move', key: key(2), direction: -1 });
    expect(s.steps.map((x) => x.key)).toEqual([key(2), key(1)]);
    expect(editorReducer(s, { type: 'move', key: key(2), direction: -1 })).toBe(s);
    s = editorReducer({ ...s, selectedKey: key(2) }, { type: 'remove', key: key(2) });
    expect(s.steps.map((x) => x.key)).toEqual([key(1)]);
    expect(s.selectedKey).toBe(key(1));
  });
});

describe('normalizeRichText', () => {
  it('keeps the allowed subset and drops links, code and attributes', () => {
    const doc = normalizeRichText({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1, id: 'x' }, content: [{ type: 'text', text: 'Hi' }] },
        {
          type: 'paragraph',
          attrs: { style: 'color:red' },
          content: [
            {
              type: 'text',
              text: 'bold',
              marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            { type: 'image', attrs: { src: 'x' } },
          ],
        },
        { type: 'codeBlock', content: [{ type: 'text', text: 'code' }] },
      ],
    });
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'code' }] },
      ],
    });
  });

  it('sets and clears routing, and drops routes to a deleted step', () => {
    let s = editorReducer(empty, { type: 'add', stepType: 'YES_NO_CHOICE', key: key(1) });
    s = editorReducer(s, { type: 'add', stepType: 'MESSAGE', key: key(2) });
    s = editorReducer(s, { type: 'add', stepType: 'MESSAGE', key: key(3) });
    s = editorReducer(s, {
      type: 'route',
      key: key(1),
      next: {
        rules: [
          { when: { kind: 'ANSWER', equals: 'NO' }, goto: key(3) },
          { when: { kind: 'COMPLETED', stepKey: key(2) }, goto: 'END' },
        ],
        otherwise: key(2),
      },
    });
    expect(s.steps[0]!.next?.rules).toHaveLength(2);
    expect(DraftStepSchema.safeParse(s.steps[0]).success).toBe(true);

    // Deleting step 2 removes the rule about it and the fallback that pointed at it.
    s = editorReducer(s, { type: 'remove', key: key(2) });
    expect(s.steps[0]!.next).toEqual({
      rules: [{ when: { kind: 'ANSWER', equals: 'NO' }, goto: key(3) }],
      otherwise: null,
    });
    // Deleting the last target leaves no routing at all.
    s = editorReducer(s, { type: 'remove', key: key(3) });
    expect('next' in s.steps[0]!).toBe(false);

    // An empty routing is stored as none.
    s = editorReducer(s, { type: 'route', key: key(1), next: { rules: [], otherwise: null } });
    expect('next' in s.steps[0]!).toBe(false);
  });
});
