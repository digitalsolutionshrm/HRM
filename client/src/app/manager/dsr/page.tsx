'use client';

import { useCallback, useEffect, useState } from 'react';
import { MdRefresh } from 'react-icons/md';
import { apiFetch } from '@/lib/api';
import type { Dsr } from '@/app/employee/dsr/dsr-api';
import DsrDescription from '@/components/dsr/DsrDescription';

interface TeamMember {
  id: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
}

function employeeName(employee?: TeamMember): string {
  return [employee?.firstName, employee?.lastName].filter(Boolean).join(' ')
    || employee?.employeeCode
    || 'Employee';
}

async function readList<T>(response: Response, fallback: string): Promise<T[]> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message ?? body?.error ?? fallback;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  const data = body?.data ?? body;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function ManagerDsrPage() {
  const [dsrs, setDsrs] = useState<Dsr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDsrs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const members = await readList<TeamMember>(
        await apiFetch('/employees/team'),
        'Could not load your team.',
      );
      const reportsByMember = await Promise.all(
        members.map(async (member) => {
          const reports = await readList<Dsr>(
            await apiFetch(`/dsr/employee/${member.id}`),
            `Could not load DSRs for ${employeeName(member)}.`,
          );
          return reports.map((dsr) => ({
            ...dsr,
            employee: { ...dsr.employee, ...member },
          }));
        }),
      );

      setDsrs(
        reportsByMember
          .flat()
          .sort((first, second) => second.date.localeCompare(first.date)),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load team DSRs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDsrs();
  }, [loadDsrs]);

  return (
    <main className="mt-5 flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-700 dark:text-white">Team DSRs</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Review work reports and descriptions submitted by your team.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDsrs()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-700 sm:self-auto"
        >
          <MdRefresh className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-x-auto rounded-2xl bg-white shadow-sm dark:bg-navy-800">
        <table className="w-full min-w-[1050px] text-left text-navy-700 dark:text-gray-200">
          <thead>
            <tr className="border-b border-gray-100 dark:border-navy-700">
              {['Employee', 'Date', 'Task / Project', 'Work Description', 'Hours', 'Status'].map((heading) => (
                <th key={heading} className="px-5 py-4 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-8 text-center text-gray-600 dark:text-gray-300" colSpan={6}>Loading team DSRs…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-gray-600 dark:text-gray-300" colSpan={6}>No team DSRs found.</td></tr>
            ) : dsrs.map((dsr) => (
              <tr key={dsr.id} className="border-b border-gray-100 last:border-0 dark:border-navy-700">
                <td className="px-5 py-4 text-sm font-medium">{employeeName(dsr.employee)}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm">{dsr.date.slice(0, 10)}</td>
                <td className="px-5 py-4 text-sm font-medium">{dsr.title}</td>
                <td className="max-w-lg px-5 py-4">
                  <DsrDescription description={dsr.description} />
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm">{Number(dsr.hoursWorked).toFixed(2)}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm">{dsr.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
