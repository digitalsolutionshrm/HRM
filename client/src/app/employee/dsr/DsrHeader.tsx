import { MdAdd } from 'react-icons/md';

interface DsrHeaderProps {
  onAdd: () => void;
}

export default function DsrHeader({ onAdd }: DsrHeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-navy-700 dark:text-white md:text-3xl">
          Daily Status Reports
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Create and manage your daily work reports.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-navy-900"
      >
        <MdAdd className="h-5 w-5" /> Add DSR
      </button>
    </header>
  );
}
