'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useId } from 'react';
import type { RichTextDoc } from '@momentpath/contracts';
import { cx } from '@momentpath/design-system';
import { normalizeRichText } from './normalize-rich-text';

/**
 * Tiptap restricted to paragraphs, two heading levels, bullet lists, bold and italic. Output
 * is normalised to the allowed JSON subset; HTML is never produced or stored.
 */
export function RichTextEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
}) {
  const labelId = useId();
  const editor = useEditor({
    immediatelyRender: false,
    // Tiptap would inject a <style> tag, which the strict CSP blocks; the rules live in globals.css.
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        link: false,
        underline: false,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          'min-h-28 px-3 py-2.5 text-base sm:text-sm focus:outline-none [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 space-y-2',
        'aria-labelledby': labelId,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: e }) => onChange(normalizeRichText(e.getJSON())),
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(normalizeRichText(editor.getJSON()));
    if (current !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const tool = (active: boolean) =>
    cx(
      'min-h-9 min-w-9 rounded-lg px-2 text-sm font-medium',
      active ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-100',
    );

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-sm font-medium text-ink-800">
        {label}
      </span>
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-inset ring-ink-200 focus-within:ring-2 focus-within:ring-brand-600">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap gap-1 border-b border-ink-100 p-1"
        >
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={editor?.isActive('bold') ?? false}
            className={tool(editor?.isActive('bold') ?? false)}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            aria-label="Italic"
            aria-pressed={editor?.isActive('italic') ?? false}
            className={tool(editor?.isActive('italic') ?? false)}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            aria-label="Heading style"
            aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}
            className={tool(editor?.isActive('heading', { level: 2 }) ?? false)}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H
          </button>
          <button
            type="button"
            aria-label="Bullet list"
            aria-pressed={editor?.isActive('bulletList') ?? false}
            className={tool(editor?.isActive('bulletList') ?? false)}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            • List
          </button>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
