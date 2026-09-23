import { z } from 'zod';

/**
 * Creator-authored rich text is stored as a restricted Tiptap/ProseMirror JSON document,
 * never as HTML. Only the nodes and marks listed here are accepted; unknown node types,
 * unknown attributes and any HTML-bearing field are rejected by the strict schemas.
 * The renderer maps these nodes to React elements, so there is no HTML to sanitise.
 */

export const RICH_TEXT_MAX_CHARS = 5000;
export const RICH_TEXT_MAX_BLOCKS = 60;

const MarkSchema = z.strictObject({
  type: z.enum(['bold', 'italic']),
});

const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1).max(RICH_TEXT_MAX_CHARS),
  marks: z.array(MarkSchema).max(2).optional(),
});

const HardBreakSchema = z.strictObject({
  type: z.literal('hardBreak'),
});

export const InlineNodeSchema = z.discriminatedUnion('type', [TextNodeSchema, HardBreakSchema]);
export type InlineNode = z.infer<typeof InlineNodeSchema>;

const inlineContent = z.array(InlineNodeSchema).max(500).optional();

const ParagraphSchema = z.strictObject({
  type: z.literal('paragraph'),
  content: inlineContent,
});

const HeadingSchema = z.strictObject({
  type: z.literal('heading'),
  attrs: z.strictObject({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: inlineContent,
});

const ListItemSchema = z.strictObject({
  type: z.literal('listItem'),
  content: z.array(ParagraphSchema).min(1).max(5),
});

const BulletListSchema = z.strictObject({
  type: z.literal('bulletList'),
  content: z.array(ListItemSchema).min(1).max(30),
});

export const BlockNodeSchema = z.discriminatedUnion('type', [
  ParagraphSchema,
  HeadingSchema,
  BulletListSchema,
]);
export type BlockNode = z.infer<typeof BlockNodeSchema>;

export const RichTextDocSchema = z
  .strictObject({
    type: z.literal('doc'),
    content: z.array(BlockNodeSchema).max(RICH_TEXT_MAX_BLOCKS),
  })
  .refine((doc) => richTextPlainText(doc).length <= RICH_TEXT_MAX_CHARS, {
    message: `Text must be at most ${RICH_TEXT_MAX_CHARS} characters`,
  })
  .meta({ id: 'RichTextDoc' });
export type RichTextDoc = z.infer<typeof RichTextDocSchema>;

function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('');
}

export function richTextPlainText(doc: { content: BlockNode[] }): string {
  return doc.content
    .map((block) => {
      if (block.type === 'bulletList') {
        return block.content
          .map((item) => item.content.map((p) => inlineText(p.content)).join('\n'))
          .join('\n');
      }
      return inlineText(block.content);
    })
    .join('\n');
}

export function richTextIsEmpty(doc: { content: BlockNode[] }): boolean {
  return richTextPlainText(doc).trim().length === 0;
}

/** Convenience for templates and tests: plain paragraphs to a document. */
export function richTextFromParagraphs(...paragraphs: string[]): RichTextDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph' as const,
      content: text.length > 0 ? [{ type: 'text' as const, text }] : undefined,
    })),
  };
}

export const EMPTY_RICH_TEXT: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
