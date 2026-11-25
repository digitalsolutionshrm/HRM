'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdCalculate, MdCheckCircle, MdClose, MdCurrencyRupee, MdDeleteOutline, MdDownload,
  MdFileDownload, MdPendingActions, MdRefresh, MdReceiptLong, MdSync,
  MdCardGiftcard,
  MdHistory,
} from 'react-icons/md';
import Card from 'components/card';
import IncrementHistoryPanel from './IncrementHistoryPanel';
import { DonutChart, TrendChart } from './payroll-charts';
import {
  MONTH_NAMES, MONTH_SHORT, PAYROLL_STATUSES, PayrollRecord, PayrollStatus,
  downloadPayslip, employeeName, formatCurrency, payrollApi, periodLabel, statusLabel, statusStyle,
} from './payroll-shared';

const inputClass = 'h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]';

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function PayrollPage({ role }: { role: 'admin' | 'hr' }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const [deleting, setDeleting] = useState<PayrollRecord | null>(null);
  const [bonusRecord, setBonusRecord] = useState<PayrollRecord | null>(null);
  const [bonusValue, setBonusValue] = useState('');
  const [incrementsOpen, setIncrementsOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await payrollApi.getAll());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payroll.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const monthRecords = useMemo(
    () => records.filter((record) => record.month === month && record.year === year),
    [records, month, year],
  );

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear(), year, ...records.map((record) => record.year)]);
    return Array.from(set).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, year]);

  const summary = useMemo(() => {
    const total = monthRecords.reduce((sum, record) => sum + record.netSalary, 0);
    return {
      total,
      processed: monthRecords.filter((record) => record.status !== 'PENDING').length,
      pending: monthRecords.filter((record) => record.status === 'PENDING').length,
      paid: monthRecords.filter((record) => record.status === 'PAID').length,
    };
  }, [monthRecords]);

  // Net payroll of the 6 months ending with the selected month.
  const trend = useMemo(() => {
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(year, month - 1 - i, 1);
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      labels.push(`${MONTH_SHORT[m - 1]}${y !== year ? ` ${String(y).slice(2)}` : ''}`);
      values.push(records.filter((r) => r.month === m && r.year === y).reduce((sum, r) => sum + r.netSalary, 0));
    }
    return { labels, values };
  }, [records, month, year]);

  const distribution = useMemo(() => {
    const sum = (pick: (r: PayrollRecord) => number) => monthRecords.reduce((total, r) => total + pick(r), 0);
    return [
      { name: 'Base Salary', value: sum((r) => r.basicSalary), color: '#4318FF' },
      { name: 'HRA & Allowances', value: sum((r) => r.hra + r.allowances), color: '#F97316' },
      { name: 'Bonuses', value: sum((r) => r.bonus), color: '#10B981' },
      { name: 'Overtime', value: sum((r) => r.overtime), color: '#EC4899' },
      { name: 'Deductions', value: sum((r) => r.totalDeductions), color: '#EF4444' },
    ];
  }, [monthRecords]);

  const distributionTotal = distribution.reduce((sum, item) => sum + item.value, 0);

  const replaceRecord = (updated: PayrollRecord) => {
    setRecords((current) => current.map((record) => (record.id === updated.id ? { ...record, ...updated, employee: updated.employee ?? record.employee } : record)));
    setSelected((current) => (current && current.id === updated.id ? { ...current, ...updated, employee: updated.employee ?? current.employee } : current));
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch (actionError) {
      setNotice({ kind: 'error', message: actionError instanceof Error ? actionError.message : 'The action could not be completed.' });
    } finally {
      setBusy(null);
    }
  };

  const processPayroll = () => run('process', async () => {
    const result = await payrollApi.processAll(month, year);
    const parts = [`${result.created} generated`];
    if (result.existing) parts.push(`${result.existing} already existed`);
    if (result.skipped) parts.push(`${result.skipped} skipped (no salary set)`);
    setNotice({ kind: 'success', message: `Payroll for ${MONTH_NAMES[month - 1]} ${year}: ${parts.join(', ')}.` });
    await load();
  });

  const changeStatus = (record: PayrollRecord, status: PayrollStatus) => run(`status-${record.id}`, async () => {
    if (status === record.status) return;
    replaceRecord(await payrollApi.setStatus(record.id, status));
    setNotice({ kind: 'success', message: `${employeeName(record)}: marked ${statusLabel(status).toLowerCase()}.` });
  });

  const approvePayslip = (record: PayrollRecord) => run(`approval-${record.id}`, async () => {
    const updated = await payrollApi.approvePayslip(record.id);
    replaceRecord(updated);
    setNotice({ kind: 'success', message: `${employeeName(updated)}’s ${periodLabel(updated)} payslip is approved and available to download.` });
  });

  const recalculate = (record: PayrollRecord) => run(`recalc-${record.id}`, async () => {
    replaceRecord(await payrollApi.recalculate(record.id));
    setNotice({ kind: 'success', message: `Recalculated payroll for ${employeeName(record)} from the latest attendance and leaves.` });
  });

  const saveBonus = () => run(`bonus-${bonusRecord?.id}`, async () => {
    if (!bonusRecord) return;
    const amount = Number(bonusValue);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid bonus amount.');
    const updated = await payrollApi.setBonus(bonusRecord.id, amount);
    replaceRecord(updated);
    setNotice({ kind: 'success', message: `Bonus updated for ${employeeName(updated)}. It has been added to gross salary.` });
    setBonusRecord(null);
  });

  const confirmDelete = () => run('delete', async () => {
    if (!deleting) return;
    await payrollApi.remove(deleting.id);
    setNotice({ kind: 'success', message: 'Payroll record deleted.' });
    setRecords((current) => current.filter((record) => record.id !== deleting.id));
    setSelected((current) => (current?.id === deleting.id ? null : current));
    setDeleting(null);
  });

  const download = (record: PayrollRecord) => run(`pdf-${record.id}`, async () => { await downloadPayslip(record); });

  const exportCsv = () => {
    if (monthRecords.length === 0) {
      setNotice({ kind: 'error', message: 'There is no payroll to export for this month.' });
      return;
    }
    const header = ['Employee ID', 'Employee', 'Department', 'Basic', 'HRA', 'Allowances', 'Bonus', 'Overtime hours', 'Overtime pay', 'Gross', 'PF', 'ESI', 'Tax', 'Attendance deductions', 'Leave deductions', 'Other deductions', 'Total deductions', 'Net salary', 'Present days', 'Absent days', 'Half days', 'Leave days', 'Status'];
    const lines = monthRecords.map((r) => [
      r.employee?.employeeCode ?? r.employeeId, employeeName(r), r.employee?.department ?? '', r.basicSalary, r.hra, r.allowances, r.bonus,
      r.overtimeHours, r.overtime, r.grossSalary, r.pf, r.esi, r.tax, r.attendanceDeductions, r.leaveDeductions, r.otherDeductions,
      r.totalDeductions, r.netSalary, r.attendanceDays, r.absentDays, r.halfDays, r.leaveDays, r.status,
    ].map(csvEscape).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll_${MONTH_NAMES[month - 1]}_${year}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cards = [
    { title: 'Total payroll (net)', value: formatCurrency(summary.total), icon: MdCurrencyRupee, tone: 'text-green-600' },
    { title: 'Processed', value: String(summary.processed), icon: MdCheckCircle, tone: 'text-blue-600' },
    { title: 'Pending', value: String(summary.pending), icon: MdPendingActions, tone: 'text-amber-500' },
    { title: 'Paid', value: String(summary.paid), icon: MdReceiptLong, tone: 'text-brand-500' },
  ];

  return (
    <div className="mt-5 flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          {/* <h1 className="text-2xl font-bold text-navy-700 dark:text-white md:text-3xl">Payroll Management</h1> */}
          {/* <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Generate payroll from salary, attendance and approved leaves, then track it from pending to paid.</p> */}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Month" value={month} onChange={(event) => setMonth(Number(event.target.value))} className={inputClass}>
            {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1} className="bg-white text-navy-700 dark:bg-navy-900 dark:text-white">{name}</option>)}
          </select>
          <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))} className={inputClass}>
            {years.map((value) => <option key={value} value={value} className="bg-white text-navy-700 dark:bg-navy-900 dark:text-white">{value}</option>)}
          </select>
          <button type="button" onClick={exportCsv} className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-navy-700 hover:bg-gray-50 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-700">
            <MdFileDownload className="h-5 w-5" /> Export
          </button>
          <button type="button" onClick={() => setIncrementsOpen(true)} className="flex h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-bold text-brand-600 hover:bg-brand-50 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:hover:bg-navy-700">
            <MdHistory className="h-5 w-5" /> Increments
          </button>
          <button type="button" onClick={() => void processPayroll()} disabled={busy === 'process'} className="flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            <MdCalculate className={`h-5 w-5 ${busy === 'process' ? 'animate-pulse' : ''}`} /> {busy === 'process' ? 'Processing…' : 'Process Payroll'}
          </button>
        </div>
      </header>

      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`fixed right-5 top-5 z-[80] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${notice.kind === 'success' ? 'border-green-200 bg-white text-green-800 dark:border-green-800 dark:bg-navy-800 dark:text-green-200' : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-navy-800 dark:text-red-200'}`}>
        {notice.kind === 'success' ? <MdCheckCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <MdClose className="mt-0.5 h-5 w-5 shrink-0" />}
        <span>{notice.message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)} className="ml-2 text-current opacity-70 hover:opacity-100"><MdClose className="h-4 w-4" /></button>
      </div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => <Card key={card.title} extra="flex items-center gap-4 px-5 py-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lightPrimary dark:bg-navy-700 ${card.tone}`}><card.icon className="h-6 w-6" /></div>
          <div className="min-w-0"><p className="truncate text-sm text-gray-500 dark:text-gray-400">{card.title}</p><p className="truncate text-xl font-bold text-navy-700 dark:text-white">{card.value}</p></div>
        </Card>)}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card extra="p-5 lg:col-span-2">
          <h2 className="font-bold text-navy-700 dark:text-white">Monthly payroll trend</h2>
          <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">Net payroll for the 6 months up to {MONTH_NAMES[month - 1]} {year}</p>
          <div className="h-64"><TrendChart labels={trend.labels} values={trend.values} name="Net payroll" /></div>
        </Card>
        <Card extra="p-5">
          <h2 className="font-bold text-navy-700 dark:text-white">Cost distribution</h2>
          <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">{MONTH_NAMES[month - 1]} {year} breakdown</p>
          {distributionTotal === 0
            ? <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">No data for this month.</div>
            : <div className="h-48"><DonutChart labels={distribution.map((d) => d.name)} values={distribution.map((d) => Math.round(d.value))} colors={distribution.map((d) => d.color)} /></div>}
          <div className="mt-3 flex flex-col gap-2">
            {distribution.map((item) => <div key={item.name} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.name}</span>
              <span className="font-semibold text-navy-700 dark:text-white">{distributionTotal ? Math.round((item.value / distributionTotal) * 100) : 0}%</span>
            </div>)}
          </div>
        </Card>
      </div>

      <Card extra="w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-navy-700">
          <div><h2 className="font-bold text-navy-700 dark:text-white">Employee payroll — {MONTH_NAMES[month - 1]} {year}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Approve a payslip here before the employee can download it. Salary changes clear the approval.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh payroll" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-navy-700"><MdRefresh className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left">
            <thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-navy-900 dark:text-gray-400">
              {['Employee', 'Department', 'Base', 'Bonus', 'Overtime', 'Deductions', 'Net salary', 'Status', 'Payslip approval'].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}
              <th className="px-5 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {loading ? <tr><td colSpan={10} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading payroll…</td></tr>
                : monthRecords.length === 0 ? <tr><td colSpan={10} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No payroll for {MONTH_NAMES[month - 1]} {year}. Select “Process Payroll” to generate it.</td></tr>
                  : monthRecords.map((record) => {
                    const locked = record.status === 'PAID';
                    return <tr key={record.id} onClick={() => setSelected(record)} className="cursor-pointer text-sm text-navy-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-navy-700/40">
                      <td className="px-5 py-4"><span className="font-semibold">{employeeName(record)}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{record.employee?.employeeCode}</span></td>
                      <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300">{record.employee?.department ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs">{formatCurrency(record.basicSalary)}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-green-600 dark:text-green-400">+{formatCurrency(record.bonus)}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-pink-500 dark:text-pink-400">+{formatCurrency(record.overtime)}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-red-500 dark:text-red-400">{record.totalDeductions > 0 ? `-${formatCurrency(record.totalDeductions)}` : formatCurrency(0)}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm font-bold">{formatCurrency(record.netSalary)}</td>
                      <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                        <select
                          aria-label={`Status for ${employeeName(record)}`}
                          value={record.status}
                          disabled={locked || busy === `status-${record.id}`}
                          onChange={(event) => void changeStatus(record, event.target.value as PayrollStatus)}
                          className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-bold outline-none disabled:cursor-not-allowed ${statusStyle(record.status)}`}
                        >
                          {PAYROLL_STATUSES.map((status) => <option key={status} value={status} className="bg-white text-navy-700 dark:bg-navy-900 dark:text-white">{statusLabel(status)}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                        {record.isApproved ? <span title={record.approvedAt ? `Approved ${new Date(record.approvedAt).toLocaleString()}` : 'Approved by HR/Admin'} className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/25 dark:text-green-300"><MdCheckCircle className="h-4 w-4" />Approved</span> : <button type="button" disabled={busy === `approval-${record.id}`} onClick={() => void approvePayslip(record)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"><MdCheckCircle className="h-4 w-4" />{busy === `approval-${record.id}` ? 'Approving…' : 'Approve payslip'}</button>}
                      </td>
                      <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button type="button" title={record.isApproved ? 'Download payslip' : 'Approve this payslip before downloading'} aria-label={`Download payslip for ${employeeName(record)}`} disabled={!record.isApproved || busy === `pdf-${record.id}`} onClick={() => void download(record)} className="rounded-lg p-2 text-brand-500 hover:bg-lightPrimary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-navy-700"><MdDownload className="h-5 w-5" /></button>
                          {!locked && <>
                            <button type="button" title="Add or edit bonus" aria-label={`Add or edit bonus for ${employeeName(record)}`} onClick={() => { setBonusRecord(record); setBonusValue(String(record.bonus || 0)); }} className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"><MdCardGiftcard className="h-5 w-5" /></button>
                            <button type="button" title="Recalculate from attendance & leaves" aria-label="Recalculate payroll" disabled={busy === `recalc-${record.id}`} onClick={() => void recalculate(record)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/20"><MdSync className={`h-5 w-5 ${busy === `recalc-${record.id}` ? 'animate-spin' : ''}`} /></button>
                            <button type="button" title="Delete" aria-label="Delete payroll" onClick={() => setDeleting(record)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><MdDeleteOutline className="h-5 w-5" /></button>
                          </>}
                        </div>
                      </td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="payroll-detail-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-800 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><h2 id="payroll-detail-title" className="text-xl font-bold text-navy-700 dark:text-white">{employeeName(selected)}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{periodLabel(selected)} · {selected.employee?.department ?? '—'}</p></div>
            <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Earnings</h3>
              {[['Basic', selected.basicSalary], ['HRA', selected.hra], ['Bonus', selected.bonus], ['Other allowances', selected.allowances], [`Overtime (${selected.overtimeHours}h)`, selected.overtime]].map(([label, value]) => <div key={label as string} className="flex justify-between border-b border-gray-100 py-2 text-sm dark:border-navy-700"><span className="text-gray-600 dark:text-gray-300">{label}</span><span className="font-mono">{formatCurrency(value as number)}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold text-navy-700 dark:text-white"><span>Gross</span><span className="font-mono">{formatCurrency(selected.grossSalary)}</span></div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Deductions</h3>
              {[['PF', selected.pf], ['ESI', selected.esi], ['Tax', selected.tax], ['Attendance', selected.attendanceDeductions], ['Unpaid leave', selected.leaveDeductions], ['Other', selected.otherDeductions]].map(([label, value]) => <div key={label as string} className="flex justify-between border-b border-gray-100 py-2 text-sm dark:border-navy-700"><span className="text-gray-600 dark:text-gray-300">{label}</span><span className="font-mono text-red-500 dark:text-red-400">{Number(value) > 0 ? `-${formatCurrency(value as number)}` : formatCurrency(0)}</span></div>)}
              <div className="flex justify-between py-2 text-sm font-bold text-navy-700 dark:text-white"><span>Total</span><span className="font-mono text-red-500 dark:text-red-400">{selected.totalDeductions > 0 ? `-${formatCurrency(selected.totalDeductions)}` : formatCurrency(0)}</span></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Present days', selected.attendanceDays], ['Absent days', selected.absentDays], ['Half days', selected.halfDays], ['Leave days', selected.leaveDays]].map(([label, value]) => <div key={label as string} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className="text-lg font-bold text-navy-700 dark:text-white">{value}</p></div>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">Payslip approval: {selected.isApproved ? <span className="font-semibold text-green-700 dark:text-green-300">Approved{selected.approvedAt ? ` · ${new Date(selected.approvedAt).toLocaleDateString()}` : ''}</span> : <span className="font-semibold text-amber-700 dark:text-amber-300">Waiting for HR/Admin</span>}</div>
          <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-gray-600 dark:text-gray-300">Net pay <span className="ml-2 text-2xl font-bold text-navy-700 dark:text-white">{formatCurrency(selected.netSalary)}</span>
              <span className={`ml-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(selected.status)}`}>{statusLabel(selected.status)}</span></div>
            <button type="button" title={selected.isApproved ? 'Download payslip' : 'Approve this payslip before downloading'} disabled={!selected.isApproved || busy === `pdf-${selected.id}`} onClick={() => void download(selected)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"><MdDownload className="h-5 w-5" /> {busy === `pdf-${selected.id}` ? 'Generating…' : 'Download payslip'}</button>
          </div>
        </section>
      </div>}

      {deleting && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-navy-900/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="payroll-delete-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-800">
        <h2 id="payroll-delete-title" className="text-lg font-bold text-navy-700 dark:text-white">Delete payroll record?</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{employeeName(deleting)}’s payroll for {periodLabel(deleting)} will be removed. You can generate it again with “Process Payroll”.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy === 'delete'} onClick={() => setDeleting(null)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold text-navy-700 dark:bg-navy-700 dark:text-white">Cancel</button>
          <button type="button" disabled={busy === 'delete'} onClick={() => void confirmDelete()} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
        </div>
      </section></div>}

      {bonusRecord && <div className="fixed inset-0 z-[76] flex items-center justify-center bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBonusRecord(null); }}><section role="dialog" aria-modal="true" aria-labelledby="payroll-bonus-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-800">
        <h2 id="payroll-bonus-title" className="text-lg font-bold text-navy-700 dark:text-white">Bonus · {employeeName(bonusRecord)}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{periodLabel(bonusRecord)} · Bonus is added to gross salary for this employee and month.</p>
        <label className="mt-5 grid gap-2 text-sm font-semibold text-navy-700 dark:text-white">Bonus amount (₹)<input autoFocus type="number" min="0" step="0.01" value={bonusValue} onChange={(event) => setBonusValue(event.target.value)} className={inputClass} /></label>
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy === `bonus-${bonusRecord.id}`} onClick={() => setBonusRecord(null)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold text-navy-700 dark:bg-navy-700 dark:text-white">Cancel</button><button type="button" disabled={busy === `bonus-${bonusRecord.id}`} onClick={() => void saveBonus()} className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{busy === `bonus-${bonusRecord.id}` ? 'Saving…' : 'Save bonus'}</button></div>
      </section></div>}
      {incrementsOpen && <IncrementHistoryPanel onClose={() => setIncrementsOpen(false)} initialMonth={month} initialYear={year} />}
    </div>
  );
}
