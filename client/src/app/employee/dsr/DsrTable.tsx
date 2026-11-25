import { MdDescription, MdRefresh } from 'react-icons/md';
import Card from 'components/card';
import type { Dsr } from './dsr-api';
import DsrRow from './DsrRow';

interface DsrTableProps {
  dsrs: Dsr[];
  loading: boolean;
  onEdit: (dsr: Dsr) => void;
  onDelete: (id: number) => void;
  onRetry: () => void;
}

export default function DsrTable({ dsrs, loading, onEdit, onDelete, onRetry }: DsrTableProps) {
  return (
    <Card extra="w-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-4 pt-5 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-navy-700 dark:text-white">My Daily Status Reports</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">All reports submitted today. Available actions depend on each report’s status.</p>
        </div>
        <span className="rounded-full bg-lightPrimary px-3 py-1 text-xs font-bold text-brand-500 dark:bg-navy-700 dark:text-white">
          {loading ? '…' : `${dsrs.length} ${dsrs.length === 1 ? 'report' : 'reports'}`}
        </span>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center border-t border-gray-100 px-5 text-sm font-medium text-gray-600 dark:border-navy-700 dark:text-gray-400" role="status">
          <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500" /> Loading your DSRs…
        </div>
      ) : dsrs.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center border-t border-gray-100 px-5 text-center dark:border-navy-700">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-lightPrimary text-brand-500 dark:bg-navy-700 dark:text-white">
            <MdDescription className="h-6 w-6" />
          </div>
          <p className="font-bold text-navy-700 dark:text-white">No DSRs submitted today</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Your submitted reports will appear here.</p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto border-t border-gray-100 dark:border-navy-700">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-navy-900/60">
                {['Date', 'Task / Project', 'Description', 'Task Status', 'Hours', 'Review Status', 'Actions'].map((heading) => (
                  <th key={heading} scope="col" className={`px-5 py-4 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${heading === 'Actions' ? 'text-right' : ''}`}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {dsrs.map((dsr) => <DsrRow key={dsr.id} dsr={dsr} onEdit={onEdit} onDelete={onDelete} />)}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end border-t border-gray-100 px-5 py-3 dark:border-navy-700">
        <button type="button" onClick={onRetry} disabled={loading} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-lightPrimary hover:text-brand-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-navy-700 dark:hover:text-white">
          <MdRefresh className="h-4 w-4" /> Refresh
        </button>
      </div>
    </Card>
  );
}
