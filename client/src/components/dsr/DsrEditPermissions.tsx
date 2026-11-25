'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAllDsrs,
  setDsrEmployeeEditPermission,
  type Dsr,
} from '@/app/employee/dsr/dsr-api';
import DsrDescription from './DsrDescription';

export default function DsrEditPermissions() {
  const [dsrs, setDsrs] = useState<Dsr[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDsrs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDsrs(await getAllDsrs());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load DSRs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDsrs();
  }, [loadDsrs]);

  const updatePermission = async (dsr: Dsr, allowed: boolean) => {
    try {
      setUpdatingId(dsr.id);
      setError('');
      setNotice('');
      await setDsrEmployeeEditPermission(dsr.id, allowed);
      setNotice(
        allowed
          ? 'Employee may now update this previous DSR.'
          : 'Previous DSR edit permission has been revoked.',
      );
      await loadDsrs();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Could not update DSR permission.',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="mt-5 flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-navy-700 dark:text-white">
          DSR edit permissions
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Grant or revoke an employee’s permission to update a previous report.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm dark:bg-navy-800">
        <table className="w-full min-w-[760px] text-left text-navy-700 dark:text-gray-200">
          <thead>
            <tr className="border-b border-gray-100 dark:border-navy-700">
              {['Employee', 'Date', 'Report', 'Work Description', 'Hours', 'Status', 'Permission'].map((heading) => (
                <th key={heading} className="px-5 py-4 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-8 text-center text-gray-600 dark:text-gray-300" colSpan={7}>Loading DSRs…</td></tr>
            ) : dsrs.length === 0 ? (
              <tr><td className="px-5 py-8 text-center text-gray-600 dark:text-gray-300" colSpan={7}>No DSRs found.</td></tr>
            ) : dsrs.map((dsr) => {
              const employeeName = [
                dsr.employee?.firstName,
                dsr.employee?.lastName,
              ].filter(Boolean).join(' ') || dsr.employee?.employeeCode || 'Employee';

              return (
                <tr key={dsr.id} className="border-b border-gray-100 last:border-0 dark:border-navy-700">
                  <td className="px-5 py-4 text-sm font-medium">{employeeName}</td>
                  <td className="px-5 py-4 text-sm">{dsr.date.slice(0, 10)}</td>
                  <td className="px-5 py-4 text-sm">{dsr.title}</td>
                  <td className="max-w-lg px-5 py-4">
                    <DsrDescription description={dsr.description} />
                  </td>
                  <td className="px-5 py-4 text-sm">{Number(dsr.hoursWorked).toFixed(2)}</td>
                  <td className="px-5 py-4 text-sm">{dsr.status}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      disabled={updatingId === dsr.id}
                      onClick={() => void updatePermission(dsr, !dsr.employeeEditAllowed)}
                      className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {updatingId === dsr.id
                        ? 'Saving…'
                        : dsr.employeeEditAllowed
                          ? 'Revoke'
                          : 'Allow update'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}