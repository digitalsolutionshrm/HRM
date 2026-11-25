'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdCalendarMonth, MdCheckCircle, MdClose, MdCreditCard, MdCurrencyRupee, MdDownload,
  MdInsertDriveFile, MdRefresh, MdTrendingDown, MdTrendingUp,
} from 'react-icons/md';
import Card from 'components/card';
import { DonutChart, TrendChart } from './payroll-charts';
import {
  MONTH_SHORT, PayrollRecord, downloadPayslip, formatCurrency, payrollApi, periodLabel, statusLabel, statusStyle,
} from './payroll-shared';

export default function MyPayrollPage() {
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<number | 'all' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayslips(await payrollApi.getMine());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your payroll.');
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

  // The API returns newest first.
  const latest = payslips[0];

  const cards = useMemo(() => {
    if (!latest) return [];
    const ytd = payslips.filter((slip) => slip.year === latest.year).reduce((sum, slip) => sum + slip.netSalary, 0);
    const list = [
      { label: 'Monthly gross', value: formatCurrency(latest.grossSalary), icon: MdCurrencyRupee, tone: 'text-brand-500' },
      { label: 'Net salary', value: formatCurrency(latest.netSalary), icon: MdCreditCard, tone: 'text-green-600' },
      { label: 'Deductions', value: formatCurrency(latest.totalDeductions), icon: MdTrendingDown, tone: 'text-red-500' },
      { label: `YTD earnings ${latest.year}`, value: formatCurrency(ytd), icon: MdCalendarMonth, tone: 'text-amber-500' },
    ];
    if (latest.overtime > 0) {
      list.push({ label: `Overtime (${latest.overtimeHours}h)`, value: formatCurrency(latest.overtime), icon: MdTrendingUp, tone: 'text-pink-500' });
    }
    return list;
  }, [latest, payslips]);

  const trend = useMemo(() => {
    const ordered = [...payslips].reverse().slice(-6);
    return { labels: ordered.map((slip) => MONTH_SHORT[slip.month - 1]), values: ordered.map((slip) => slip.netSalary) };
  }, [payslips]);

  const breakdown = useMemo(() => {
    if (!latest) return [];
    return [
      { name: 'Basic', value: latest.basicSalary, color: '#4318FF' },
      { name: 'HRA', value: latest.hra, color: '#10B981' },
      { name: 'Bonus', value: latest.bonus, color: '#F59E0B' },
      { name: 'Other allowances', value: latest.allowances, color: '#8B5CF6' },
      { name: 'Overtime', value: latest.overtime, color: '#EC4899' },
    ].filter((item) => item.value > 0);
  }, [latest]);

  const breakdownTotal = breakdown.reduce((sum, item) => sum + item.value, 0);

  const downloadOne = async (slip: PayrollRecord) => {
    setDownloading(slip.id);
    try {
      await downloadPayslip(slip);
    } catch (downloadError) {
      setNotice({ kind: 'error', message: downloadError instanceof Error ? downloadError.message : 'Could not generate the payslip.' });
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    const approved = payslips.filter((slip) => slip.isApproved);
    if (approved.length === 0) {
      setNotice({ kind: 'error', message: 'No approved payslips are available to download yet.' });
      return;
    }
    setDownloading('all');
    try {
      for (const slip of approved) {
        await downloadPayslip(slip);
        // Small gap so the browser does not block consecutive downloads.
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
      setNotice({ kind: 'success', message: `Downloaded ${approved.length} approved payslip${approved.length > 1 ? 's' : ''}.` });
    } catch (downloadError) {
      setNotice({ kind: 'error', message: downloadError instanceof Error ? downloadError.message : 'Could not generate the payslips.' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-700 dark:text-white md:text-3xl">My Payroll</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">View your salary details. Downloading a payslip unlocks after HR/Admin approval.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh payroll" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:hover:bg-navy-700"><MdRefresh className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={() => void downloadAll()} disabled={downloading !== null || payslips.length === 0} className="flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            <MdDownload className="h-5 w-5" /> {downloading === 'all' ? 'Generating…' : 'Download all'}
          </button>
        </div>
      </header>

      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`fixed right-5 top-5 z-[80] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${notice.kind === 'success' ? 'border-green-200 bg-white text-green-800 dark:border-green-800 dark:bg-navy-800 dark:text-green-200' : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-navy-800 dark:text-red-200'}`}>
        {notice.kind === 'success' ? <MdCheckCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <MdClose className="mt-0.5 h-5 w-5 shrink-0" />}
        <span>{notice.message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)} className="ml-2 text-current opacity-70 hover:opacity-100"><MdClose className="h-4 w-4" /></button>
      </div>}

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {loading ? <Card extra="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading your payroll…</Card>
        : payslips.length === 0 && !error ? <Card extra="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400">No payroll records are available yet. Your salary for a month appears here once HR/Admin processes payroll.</Card>
          : <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {cards.map((card) => <Card key={card.label} extra="flex flex-col gap-3 p-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-lightPrimary dark:bg-navy-700 ${card.tone}`}><card.icon className="h-5 w-5" /></div>
                <div><p className="text-xl font-bold text-navy-700 dark:text-white">{card.value}</p><p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p></div>
              </Card>)}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card extra="p-5 lg:col-span-2">
                <h2 className="font-bold text-navy-700 dark:text-white">Salary trend</h2>
                <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">Net salary over your last {trend.values.length} month{trend.values.length === 1 ? '' : 's'}</p>
                <div className="h-64"><TrendChart labels={trend.labels} values={trend.values} name="Net salary" /></div>
              </Card>
              <Card extra="p-5">
                <h2 className="font-bold text-navy-700 dark:text-white">Salary breakdown</h2>
                <p className="mb-3 mt-1 text-xs text-gray-500 dark:text-gray-400">{latest ? periodLabel(latest) : ''}</p>
                {breakdownTotal > 0 && <div className="h-48"><DonutChart labels={breakdown.map((item) => item.name)} values={breakdown.map((item) => Math.round(item.value))} colors={breakdown.map((item) => item.color)} /></div>}
                <div className="mt-3 flex flex-col gap-2">
                  {breakdown.map((item) => <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.name}</span>
                    <span className="font-semibold text-navy-700 dark:text-white">{Math.round((item.value / breakdownTotal) * 100)}%</span>
                  </div>)}
                </div>
              </Card>
            </div>

            <Card extra="p-5">
              <h2 className="mb-4 font-bold text-navy-700 dark:text-white">Payslips</h2>
              <div className="flex flex-col gap-3">
                {payslips.map((slip) => {
                  const approved = slip.isApproved;
                  return <div key={slip.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-navy-700 dark:bg-navy-900 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lightPrimary text-brand-500 dark:bg-navy-700"><MdInsertDriveFile className="h-5 w-5" /></div>
                      <div><p className="text-sm font-bold text-navy-700 dark:text-white">{periodLabel(slip)}</p><p className="text-xs text-gray-500 dark:text-gray-400">Net {formatCurrency(slip.netSalary)} · {slip.attendanceDays} days present{slip.leaveDays ? ` · ${slip.leaveDays} leave` : ''}</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-5 md:justify-end">
                      <div className="text-right"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Gross</p><p className="text-sm text-navy-700 dark:text-white">{formatCurrency(slip.grossSalary)}</p></div>
                      <div className="text-right"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Deductions</p><p className="text-sm text-red-500 dark:text-red-400">-{formatCurrency(slip.totalDeductions)}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(slip.status)}`}>{statusLabel(slip.status)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${approved ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{approved ? 'Approved' : 'Awaiting approval'}</span>
                      <button type="button" disabled={!approved || downloading !== null} onClick={() => void downloadOne(slip)} title={approved ? 'Download approved payslip' : 'Available after HR/Admin approval'} aria-label={`Download payslip for ${periodLabel(slip)}`} className="rounded-lg p-2 text-brand-500 hover:bg-lightPrimary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-navy-700">
                        {downloading === slip.id ? <span className="text-xs">…</span> : <MdDownload className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>;
                })}
              </div>
            </Card>
          </>}
    </div>
  );
}
