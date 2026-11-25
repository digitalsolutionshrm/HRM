'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { MdClose, MdFormatBold, MdFormatItalic, MdLink } from 'react-icons/md';
import { sanitizeRichTextHtml } from './rich-text-utils';

const extensions = [
  StarterKit.configure({ link: false }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    validate: (href) => /^https?:\/\//i.test(href),
    HTMLAttributes: {
      class: 'text-blue-600 underline decoration-blue-500 underline-offset-2 dark:text-blue-400',
    },
  }),
];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  disabled = false,
  ariaLabel = 'Rich text editor',
  minHeight = 'min-h-28',
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions,
    content: sanitizeRichTextHtml(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        class: `${minHeight} max-h-[28rem] min-w-0 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-sm leading-6 text-navy-700 outline-none dark:text-white`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      lastEmittedValueRef.current = html;
      onChangeRef.current(html);
    },
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedValueRef.current) {
      lastEmittedValueRef.current = null;
      return;
    }
    const safeValue = sanitizeRichTextHtml(value);
    if (editor.getHTML() !== safeValue) {
      editor.commands.setContent(safeValue, { emitUpdate: false });
    }
  }, [editor, value]);

  const insertLink = () => {
    const href = linkUrl.trim();
    if (!editor || !/^https?:\/\//i.test(href)) {
      setLinkError('Enter a complete http:// or https:// link.');
      return;
    }

    const { empty } = editor.state.selection;
    if (empty) {
      editor.chain().focus().insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }],
      }).run();
    } else {
      editor.chain().focus().setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run();
    }
    setLinkOpen(false);
    setLinkUrl('');
    setLinkError('');
  };

  return <div className="overflow-hidden rounded-xl border border-gray-300 bg-white transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-navy-600 dark:bg-navy-900">
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2 dark:border-navy-700 dark:bg-navy-800" aria-label="Text formatting toolbar">
      <button type="button" title="Bold" aria-label="Bold" disabled={disabled || !editor} aria-pressed={editor?.isActive('bold') ?? false} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()} className="rounded-lg p-2 text-navy-700 hover:bg-gray-200 disabled:opacity-40 dark:text-white dark:hover:bg-navy-700"><MdFormatBold className="h-5 w-5" /></button>
      <button type="button" title="Italic" aria-label="Italic" disabled={disabled || !editor} aria-pressed={editor?.isActive('italic') ?? false} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()} className="rounded-lg p-2 text-navy-700 hover:bg-gray-200 disabled:opacity-40 dark:text-white dark:hover:bg-navy-700"><MdFormatItalic className="h-5 w-5" /></button>
      <button type="button" title="Add link" aria-label="Add link" disabled={disabled || !editor} aria-pressed={editor?.isActive('link') ?? false} onMouseDown={(event) => event.preventDefault()} onClick={() => { setLinkError(''); setLinkOpen(true); }} className="rounded-lg p-2 text-navy-700 hover:bg-gray-200 disabled:opacity-40 dark:text-white dark:hover:bg-navy-700"><MdLink className="h-5 w-5" /></button>
      <span className="ml-auto px-2 text-xs text-gray-500 dark:text-gray-400">Type, select text, then format</span>
    </div>
    <div className="relative" onClick={() => editor?.chain().focus().run()}>
      {editor?.isEmpty && <span className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">{placeholder}</span>}
      <EditorContent editor={editor} />
    </div>
    {linkOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLinkOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="rich-link-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-800"><div className="flex items-center justify-between"><h3 id="rich-link-title" className="font-bold text-navy-700 dark:text-white">Add a link</h3><button type="button" aria-label="Close" onClick={() => setLinkOpen(false)} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button></div><label className="mt-4 flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white">Link URL<input autoFocus type="url" value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); insertLink(); } }} placeholder="https://example.com" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>{linkError && <p role="alert" className="mt-2 text-xs text-red-600">{linkError}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setLinkOpen(false)} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold dark:bg-navy-700 dark:text-white">Cancel</button><button type="button" onClick={insertLink} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">Insert link</button></div></section></div>}
  </div>;
}
