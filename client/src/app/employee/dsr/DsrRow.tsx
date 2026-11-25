import { MdDeleteOutline, MdEdit } from 'react-icons/md';
import { getDsrBusinessDate, type Dsr } from './dsr-api';
import DsrStatusBadge from './DsrStatusBadge';
import { formatDsrDuration } from './dsr-time';
import { hasRichTextMarkup, sanitizeRichTextHtml } from '@/components/rich-text-utils';

interface DsrRowProps {
  dsr: Dsr;
  onEdit: (dsr: Dsr) => void;
  onDelete: (id: number) => void;
}

function renderDescriptionWithLinks(description: string) {
  const parts = description.split(/(https?:\/\/[^\s]+)/gi);

  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) {
      return <span key={index}>{part}</span>;
    }

    let url = part;
    let punctuation = '';
    while (/[.,!?;:)]$/.test(url)) {
      punctuation = url.slice(-1) + punctuation;
      url = url.slice(0, -1);
    }

    if (!url) return <span key={index}>{part}</span>;

    return (
      <span key={index}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-500 underline underline-offset-2 hover:text-brand-600"
        >
          {url}
        </a>
        {punctuation}
      </span>
    );
  });
}
export default function DsrRow({ dsr, onEdit, onDelete }: DsrRowProps) {
  const status = dsr.status?.toLowerCase();
  const statusEditable = !status || status === 'pending' || status === 'submitted';
  const today = getDsrBusinessDate();
  const reportDate = dsr.date.slice(0, 10);
  const isPast = reportDate < today;
  const isEditable = isPast
    ? dsr.employeeEditAllowed === true
    : reportDate === today && statusEditable;
  const canDelete = reportDate === today && statusEditable;
  const date = new Date(dsr.date);
  const formattedDate = Number.isNaN(date.getTime()) ? dsr.date : date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <tr className="transition hover:bg-gray-50/70 dark:hover:bg-navy-700/30">
      <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-navy-700 dark:text-white">{formattedDate}</td>
      <td className="px-5 py-4 text-sm font-bold text-navy-700 dark:text-white">{dsr.title}</td>
      <td className="max-w-sm px-5 py-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
        <p className="line-clamp-2">{hasRichTextMarkup(dsr.description)
          ? <span className="[&_a]:font-medium [&_a]:text-brand-500 [&_a]:underline" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(dsr.description) }} />
          : renderDescriptionWithLinks(dsr.description)}</p>
      </td>
      <td className="max-w-xs px-5 py-4 text-sm leading-6 text-gray-600 dark:text-gray-400">
        <p className="line-clamp-2">{dsr.tasksStatus || '—'}</p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-navy-700 dark:text-white">{formatDsrDuration(dsr.hoursWorked)}</td>
      <td className="whitespace-nowrap px-5 py-4"><DsrStatusBadge status={dsr.status} /></td>
      <td className="whitespace-nowrap px-5 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button type="button" aria-label={`Edit ${dsr.title}`} title="Edit report" disabled={!isEditable} onClick={() => onEdit(dsr)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-lightPrimary text-brand-500 transition hover:bg-brand-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-navy-700 dark:text-white dark:hover:bg-brand-500">
            <MdEdit className="h-4 w-4" />
          </button>
          <button type="button" aria-label={`Delete ${dsr.title}`} title="Delete report" disabled={!canDelete} onClick={() => onDelete(dsr.id)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-lightPrimary text-red-500 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-navy-700 dark:hover:bg-red-500">
            <MdDeleteOutline className="h-5 w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
