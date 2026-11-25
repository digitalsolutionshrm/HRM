'use client';

import { useEffect, useState } from 'react';
import { MdDownload, MdRefresh } from 'react-icons/md';
import { apiFetch } from '@/lib/api';

interface ReportDay {
  date: string;
  day: number;
  weekday: number;
  future: boolean;
  weekOff: boolean;
  holiday: string | null;
}
interface ReportEmployee {
  employeeId: number;
  employeeCode?: string | null;
  name: string;
  department: string | null;
  cells: Record<string, string>;
  summary: {
    present: number;
    late: number;
    shortLeave: number;
    halfDay: number;
    absent: number;
    leave: number;
    holiday: number;
    weekOff: number;
    workingDays: number;
  };
}
interface MonthlyReport {
  month: number;
  year: number;
  daysInMonth: number;
  weeklyOffDays: number[];
  days: ReportDay[];
  holidays: { date: string; name: string }[];
  employees: ReportEmployee[];
  shift?: { id: number; name: string; code: string } | null;
}
interface ShiftOption { id:number; name:string; code:string; startTime:string; endTime:string; active?: boolean }

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CODE_LABEL: Record<string, string> = {
  P: 'Present',
  L: 'Late',
  SL: 'Short leave',
  HD: 'Half-day',
  A: 'Absent',
  LV: 'Leave',
  H: 'Holiday',
  W: 'Week off',
};

function unwrap<T>(body: any): T {
  return (body?.data ?? body) as T;
}

export default function AttendanceMonthlyExport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<MonthlyReport | null>(null);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftId, setShiftId] = useState('');

  useEffect(() => { void (async () => { try { const response = await apiFetch('/shifts'); const body = await response.json().catch(() => null); if (response.ok) setShifts(unwrap<ShiftOption[]>(body)); } catch { /* Report remains usable without a shift filter. */ } })(); }, []);

  const fetchReport = async (): Promise<MonthlyReport> => {
    const response = await apiFetch(
      `/attendance/monthly-report?month=${month}&year=${year}${shiftId ? `&shiftId=${shiftId}` : ''}`,
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.message ?? body?.error ?? 'Could not load the report.';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    return unwrap<MonthlyReport>(body);
  };

  const downloadExcel = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const report = await fetchReport();
      const XLSX = await import('xlsx');

      const header = [
        'Employee',
        'Code',
        'Department',
        'Shift',
        ...report.days.map((day) => `${WEEKDAY_SHORT[day.weekday]} ${day.day}`),
        'Present',
        'Late',
        'Short leave',
        'Half-day',
        'Absent',
        'Leave',
        'Holiday',
        'Week off',
        'Working days',
      ];

      const rows = report.employees.map((employee) => [
        employee.name,
        employee.employeeCode ?? '',
        employee.department ?? '',
        report.shift?.name ?? 'All shifts',
        ...report.days.map((day) => employee.cells[day.date] ?? ''),
        employee.summary.present,
        employee.summary.late,
        employee.summary.shortLeave,
        employee.summary.halfDay,
        employee.summary.absent,
        employee.summary.leave,
        employee.summary.holiday,
        employee.summary.weekOff,
        employee.summary.workingDays,
      ]);

      const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
      sheet['!cols'] = [
        { wch: 26 },
        { wch: 12 },
        { wch: 18 },
        { wch: 20 },
        ...report.days.map(() => ({ wch: 6 })),
        ...Array.from({ length: 9 }, () => ({ wch: 11 })),
      ];

      const legendRows: (string | number)[][] = [
        ['Legend', 'Meaning'],
        ['P', CODE_LABEL.P],
        ['L', CODE_LABEL.L],
        ['SL', CODE_LABEL.SL],
        ['HD', CODE_LABEL.HD],
        ['A', CODE_LABEL.A],
        ['LV', CODE_LABEL.LV],
        ['H', CODE_LABEL.H],
        ['W', CODE_LABEL.W],
        ['(blank)', 'Future date — not yet recorded'],
        [],
        ['Holidays this month', ''],
        ...report.holidays.map((holiday) => [holiday.date, holiday.name]),
      ];
      const legend = XLSX.utils.aoa_to_sheet(legendRows);
      legend['!cols'] = [{ wch: 26 }, { wch: 30 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        `${MONTHS[report.month - 1]} ${report.year}`.slice(0, 31),
      );
      XLSX.utils.book_append_sheet(workbook, legend, 'Legend');
      const shiftSuffix = report.shift?.code ? `-${report.shift.code.toLowerCase()}` : '';
      XLSX.writeFile(workbook, `attendance-${report.year}-${String(report.month).padStart(2, '0')}${shiftSuffix}.xlsx`);

      setPreview(report);
      setNotice(
        `Excel ready — ${report.employees.length} employee(s) for ${MONTHS[report.month - 1]} ${report.year}${report.shift ? ` · ${report.shift.name}` : ''}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not export the report.',
      );
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setPreview(await fetchReport());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load the report.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-gray-100 dark:border-navy-700 p-5 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-lg font-bold text-navy-700 dark:text-white">
            Monthly attendance report
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Export every employee&apos;s day-by-day attendance for a month to
            Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Month"
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="h-10 rounded-xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-navy-700 dark:text-white outline-none focus:border-indigo-500"
          >
            {MONTHS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select aria-label="Filter by shift" value={shiftId} onChange={(event) => { setShiftId(event.target.value); setPreview(null); }} className="h-10 max-w-full rounded-xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-navy-700 dark:text-white outline-none focus:border-indigo-500"><option value="">All shifts</option>{shifts.map(shift=><option key={shift.id} value={shift.id}>{shift.name} · {shift.code}{shift.active?'':' · inactive'}</option>)}</select>
          <input
            aria-label="Year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 w-24 rounded-xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 text-sm text-navy-700 dark:text-white outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => void loadPreview()}
            disabled={busy}
            className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 dark:border-navy-600 text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-navy-700 disabled:opacity-50"
            aria-label="Preview monthly report"
          >
            <MdRefresh className={busy ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => void downloadExcel()}
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ff6b00] px-4 text-sm font-semibold text-white transition hover:bg-[#e65f00] disabled:opacity-50"
          >
            <MdDownload />
            {busy ? 'Please wait…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`px-5 py-3 text-sm ${
            error
              ? 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300'
              : 'bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-300'
          }`}
        >
          {error || notice}
        </div>
      )}

      {preview && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Employee</th>
                {preview.shift && <th className="px-3 py-2">Shift</th>}
                {preview.days.map((day) => (
                  <th key={day.date} className="px-2 py-2 text-center">
                    <div>{WEEKDAY_SHORT[day.weekday]}</div>
                    <div className="text-[10px] font-normal">{day.day}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">SL</th>
                <th className="px-3 py-2 text-center">LV</th>
                <th className="px-3 py-2 text-center">A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {preview.employees.map((employee) => (
                <tr key={employee.employeeId}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-navy-700 dark:text-white">
                    {employee.name}
                  </td>
                  {preview.shift && <td className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-300">{preview.shift.name}</td>}
                  {preview.days.map((day) => (
                    <td
                      key={day.date}
                      className="px-2 py-2 text-center text-gray-600 dark:text-gray-300"
                    >
                      {employee.cells[day.date] ?? ''}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold text-green-600">
                    {employee.summary.present}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-orange-600">
                    {employee.summary.shortLeave}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-sky-600">
                    {employee.summary.leave}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-red-600">
                    {employee.summary.absent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
