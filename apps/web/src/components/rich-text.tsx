import type { ReactNode } from 'react';
import type { BlockNode, InlineNode, RichTextDoc } from '@momentpath/contracts';

function inline(nodes: InlineNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    if (node.type === 'hardBreak') return <br key={i} />;
    let out: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      out =
        mark.type === 'bold' ? <strong key={`${i}b`}>{out}</strong> : <em key={`${i}i`}>{out}</em>;
    }
    return <span key={i}>{out}</span>;
  });
}

function block(node: BlockNode, i: number): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={i}>{inline(node.content)}</p>;
    case 'heading':
      return node.attrs.level === 2 ? (
        <h3 key={i} className="text-[1.25em] font-semibold">
          {inline(node.content)}
        </h3>
      ) : (
        <h4 key={i} className="text-[1.1em] font-semibold">
          {inline(node.content)}
        </h4>
      );
    case 'bulletList':
      return (
        <ul key={i} className="list-disc space-y-1 pl-6 text-left">
          {node.content.map((item, j) => (
            <li key={j}>
              {item.content.map((p, k) => (
                <p key={k}>{inline(p.content)}</p>
              ))}
            </li>
          ))}
        </ul>
      );
  }
}

/**
 * Renders the validated rich-text document as React elements. There is no HTML string and no
 * dangerouslySetInnerHTML anywhere in this path, so creator text cannot inject markup.
 */
export function RichText({ doc, className }: { doc: RichTextDoc; className?: string }) {
  return <div className={className ?? 'space-y-3'}>{doc.content.map(block)}</div>;
}
