interface DsrStatusBadgeProps {
  status?: string | null;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  submitted: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20',
  approved: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20',
  rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
};

export default function DsrStatusBadge({ status }: DsrStatusBadgeProps) {
  const label = status?.trim() || 'Pending';
  const className = statusStyles[label.toLowerCase()] ?? 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-navy-700 dark:text-gray-300 dark:ring-navy-600';

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ring-inset ${className}`}>{label}</span>;
}
