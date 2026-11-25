'use client';

import { MdClose } from 'react-icons/md';

export interface AttendanceExceptionEntry {
  name: string;
  checkIn?: string | null;
}

interface AttendanceExceptionDialogProps {
  title: string;
  entries: AttendanceExceptionEntry[];
  onClose: () => void;
}

function timeLabel(value?: string | null) {
  if (!value) return 'Check-in time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceExceptionDialog({
  title,
  entries,
  onClose,
}: AttendanceExceptionDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-exception-title"
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-navy-800"
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-navy-700">
          <div>
            <h2 id="attendance-exception-title" className="text-lg font-bold text-navy-700 dark:text-white">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{entries.length} employee{entries.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" aria-label="Close employee list" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700">
            <MdClose className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {entries.length ? (
            <ul className="space-y-2">
              {entries.map((entry, index) => (
                <li key={`${entry.name}-${entry.checkIn ?? index}`} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-navy-900">
                  <span className="min-w-0 truncate text-sm font-semibold text-navy-700 dark:text-white">{entry.name}</span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{timeLabel(entry.checkIn)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No employees in this category today.</p>
          )}
        </div>
      </section>
    </div>
  );
}
