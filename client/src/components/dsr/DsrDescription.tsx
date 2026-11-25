'use client';

import { useEffect, useId, useState } from 'react';
import { MdClose, MdVisibility } from 'react-icons/md';
import {
  hasRichTextMarkup,
  sanitizeRichTextHtml,
} from '@/components/rich-text-utils';

interface DsrDescriptionProps {
  description?: string | null;
}

function descriptionPreview(description: string): string {
  if (!hasRichTextMarkup(description)) return description;

  return description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DsrDescription({
  description,
}: DsrDescriptionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const value = description?.trim() ?? '';
  const isRichText = hasRichTextMarkup(value);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        disabled={!value}
        onClick={() => setIsOpen(true)}
        aria-label="View full work description"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={value ? 'View full work description' : undefined}
        className="flex w-full max-w-[28rem] items-center gap-2 text-left text-sm text-navy-700 disabled:cursor-default dark:text-gray-200"
      >
        <span className="min-w-0 flex-1 truncate">
          {value ? descriptionPreview(value) : '—'}
        </span>
        {value && (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-500">
            <MdVisibility className="h-4 w-4" />
            View
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-navy-800"
          >
            <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-navy-700">
              <h2 id={titleId} className="text-lg font-bold text-navy-700 dark:text-white">
                Work Description
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close work description"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-navy-700 dark:hover:bg-navy-700 dark:hover:text-white"
              >
                <MdClose className="h-5 w-5" />
              </button>
            </header>
            <div className="max-h-[calc(85vh-4.5rem)] overflow-y-auto px-5 py-4 text-sm leading-6 text-navy-700 dark:text-gray-200">
              {isRichText ? (
                <div
                  className="[&_a]:text-brand-500 [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeRichTextHtml(value),
                  }}
                />
              ) : (
                <p className="whitespace-pre-wrap">{value}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
