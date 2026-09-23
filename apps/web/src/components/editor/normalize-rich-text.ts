import {
  RichTextDocSchema,
  type BlockNode,
  type InlineNode,
  type RichTextDoc,
} from '@momentpath/contracts';

type Json = { type?: unknown; text?: unknown; marks?: unknown; attrs?: unknown; content?: unknown };

function inline(nodes: unknown): InlineNode[] | undefined {
  if (!Array.isArray(nodes)) return undefined;
  const out: InlineNode[] = [];
  for (const raw of nodes as Json[]) {
    if (raw.type === 'hardBreak') out.push({ type: 'hardBreak' });
    if (raw.type === 'text' && typeof raw.text === 'string' && raw.text.length > 0) {
      const marks = Array.isArray(raw.marks)
        ? (raw.marks as Json[])
            .map((m) => m.type)
            .filter((t): t is 'bold' | 'italic' => t === 'bold' || t === 'italic')
            .map((type) => ({ type }))
        : [];
      out.push(
        marks.length ? { type: 'text', text: raw.text, marks } : { type: 'text', text: raw.text },
      );
    }
  }
  return out.length ? out : undefined;
}

function paragraph(raw: Json): BlockNode {
  const content = inline(raw.content);
  return content ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/**
 * Converts editor JSON into the allowed rich-text subset, dropping anything else (pasted
 * links, code, images, unknown attributes). The API validates again on save.
 */
export function normalizeRichText(json: unknown): RichTextDoc {
  const doc = json as Json;
  const blocks: BlockNode[] = [];
  for (const raw of Array.isArray(doc?.content) ? (doc.content as Json[]) : []) {
    if (raw.type === 'heading') {
      const level = (raw.attrs as { level?: unknown } | undefined)?.level === 3 ? 3 : 2;
      const content = inline(raw.content);
      blocks.push(
        content
          ? { type: 'heading', attrs: { level }, content }
          : { type: 'heading', attrs: { level } },
      );
    } else if (raw.type === 'bulletList' && Array.isArray(raw.content)) {
      const items = (raw.content as Json[])
        .filter((i) => i.type === 'listItem')
        .map((i) => ({
          type: 'listItem' as const,
          content: (Array.isArray(i.content) ? (i.content as Json[]) : [])
            .filter((p) => p.type === 'paragraph')
            .slice(0, 5)
            .map((p) => paragraph(p) as Extract<BlockNode, { type: 'paragraph' }>),
        }))
        .filter((i) => i.content.length > 0)
        .slice(0, 30);
      if (items.length) blocks.push({ type: 'bulletList', content: items });
    } else {
      blocks.push(paragraph(raw));
    }
  }
  const candidate: RichTextDoc = { type: 'doc', content: blocks.slice(0, 60) };
  return RichTextDocSchema.safeParse(candidate).success
    ? candidate
    : { type: 'doc', content: [{ type: 'paragraph' }] };
}
