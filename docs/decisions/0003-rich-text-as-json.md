# ADR 0003 — Rich text stored as a restricted JSON document

**Status:** accepted

Creator text is stored as a Tiptap/ProseMirror JSON document restricted to paragraphs, headings
(levels 2–3), bullet lists, bold and italic, validated by strict Zod schemas that reject unknown
nodes and attributes. It is rendered by mapping nodes to React elements. No HTML is ever stored,
sanitised or injected, removing a whole class of XSS risk.
