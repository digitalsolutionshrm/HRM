'use client';

import { useCallback, useEffect, useState } from 'react';
import { MdCardGiftcard, MdClose, MdHistory, MdRefresh } from 'react-icons/md';
import Card from 'components/card';
import IncrementHistoryPanel from './IncrementHistoryPanel';
import {
  PayrollRecord, employeeName, formatCurrency, payrollApi, periodLabel,
  statusLabel, statusStyle,
} from './payroll-shared';

export default function ManagerPayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const [bonus, setBonus] = useState('');
  const [incrementsOpen, setIncrementsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await payrollApi.getManaged());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load team payroll.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveBonus = async () => {
    if (!selected) return;
    const amount = Number(bonus);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid bonus amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await payrollApi.setBonus(selected.id, amount);
      setRecords((current) => current.map((record) => record.id === updated.id ? updated : record));
      setNotice(`Bonus updated for ${employeeName(updated)} · ${periodLabel(updated)}.`);
      setSelected(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update this bonus.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="mt-5 flex flex-col gap-5">
    <header className="flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-navy-700 dark:text-white md:text-3xl">Team Payroll</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Add a month-specific bonus for your direct reports. Bonus is added to gross salary.</p></div>
      <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => setIncrementsOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 text-sm font-bold text-brand-600 hover:bg-brand-50 dark:border-navy-700 dark:bg-navy-900 dark:text-white"><MdHistory className="h-5 w-5" /><span className="hidden sm:inline">Increments</span></button><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh team payroll" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900"><MdRefresh className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button></div>
    </header>
    {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
    <Card extra="w-full overflow-hidden">
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left">
        <thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-navy-900 dark:text-gray-400">{['Employee', 'Period', 'Gross', 'Bonus', 'Deductions', 'Net pay', 'Status', 'Action'].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
          {loading ? <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading team payroll…</td></tr>
            : records.length === 0 ? <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No payroll records are available for your direct reports yet.</td></tr>
              : records.map((record) => <tr key={record.id} className="text-sm text-navy-700 dark:text-gray-200">
                <td className="px-5 py-4 font-semibold">{employeeName(record)}</td><td className="px-5 py-4">{periodLabel(record)}</td><td className="px-5 py-4 font-mono">{formatCurrency(record.grossSalary)}</td><td className="px-5 py-4 font-mono text-green-600 dark:text-green-400">+{formatCurrency(record.bonus)}</td><td className="px-5 py-4 font-mono text-red-500 dark:text-red-400">{record.totalDeductions > 0 ? `-${formatCurrency(record.totalDeductions)}` : formatCurrency(0)}</td><td className="px-5 py-4 font-mono font-bold">{formatCurrency(record.netSalary)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(record.status)}`}>{statusLabel(record.status)}</span></td><td className="px-5 py-4"><button type="button" disabled={record.status === 'PAID'} onClick={() => { setSelected(record); setBonus(String(record.bonus || 0)); setError(''); }} className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-green-900/20 dark:text-green-300"><MdCardGiftcard className="h-4 w-4" /> Bonus</button></td>
              </tr>)}
        </tbody>
      </table></div>
      <div className="flex flex-col gap-3 p-4 md:hidden">
        {loading ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading team payroll…</p>
          : records.length === 0 ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No payroll records are available for your direct reports yet.</p>
            : records.map((record) => <article key={record.id} className="rounded-xl border border-gray-100 p-4 dark:border-navy-700">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-navy-700 dark:text-white">{employeeName(record)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{periodLabel(record)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(record.status)}`}>{statusLabel(record.status)}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gray-500 dark:text-gray-400">Gross</p><p>{formatCurrency(record.grossSalary)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Bonus</p><p className="text-green-600 dark:text-green-400">+{formatCurrency(record.bonus)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Deductions</p><p className="text-red-500 dark:text-red-400">{record.totalDeductions > 0 ? `-${formatCurrency(record.totalDeductions)}` : formatCurrency(0)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Net pay</p><p className="font-bold">{formatCurrency(record.netSalary)}</p></div></div>
              <button type="button" disabled={record.status === 'PAID'} onClick={() => { setSelected(record); setBonus(String(record.bonus || 0)); setError(''); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-xs font-semibold text-green-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-green-900/20 dark:text-green-300"><MdCardGiftcard className="h-4 w-4" /> Add or edit bonus</button>
            </article>)}
      </div>
    </Card>
    {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="team-bonus-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-800">
      <div className="flex items-start justify-between gap-3"><div><h2 id="team-bonus-title" className="text-lg font-bold text-navy-700 dark:text-white">Bonus · {employeeName(selected)}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{periodLabel(selected)}</p></div><button type="button" aria-label="Close" disabled={saving} onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button></div>
      <label className="mt-5 grid gap-2 text-sm font-semibold text-navy-700 dark:text-white">Bonus amount (₹)<input autoFocus type="number" min="0" step="0.01" value={bonus} onChange={(event) => setBonus(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Saving replaces this employee's bonus for this month and updates gross and net pay.</p>
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setSelected(null)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold text-navy-700 dark:bg-navy-700 dark:text-white">Cancel</button><button type="button" disabled={saving} onClick={() => void saveBonus()} className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Saving…' : 'Save bonus'}</button></div>
    </section></div>}
    {incrementsOpen && <IncrementHistoryPanel onClose={() => setIncrementsOpen(false)} />}
  </div>;
}
