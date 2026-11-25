'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdAccessTime, MdCalendarMonth, MdCurrencyRupee, MdFolderOpen, MdPeopleAlt, MdPersonAdd, MdRefresh,
} from 'react-icons/md';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationRealtime } from '@/contexts/NotificationRealtimeContext';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/components/payroll/payroll-shared';
import { EMPTY_HR_DATA, HrData, buildHrModel, loadHrData } from './hr-model';
import { KpiCard, type Tone } from './HrUi';
import AttendanceExceptionDialog, { type AttendanceExceptionEntry } from '../AttendanceExceptionDialog';
import {
  AnalyticsTab, AttendanceLeaveTab, ComplianceTab, EngagementTab, HiringTab, OnboardingTab, OverviewTab, PayrollTab, PerformanceTab, TrainingTab,
} from './HrTabs';

const TABS = [
  { id: 'overview', label: 'Employees' },
  { id: 'hiring', label: 'Recruitment' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'attendance', label: 'Attendance & Leave' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'performance', label: 'Performance' },
  { id: 'training', label: 'Training' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'analytics', label: 'Analytics' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function HrDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotificationRealtime();
  const [data, setData] = useState<HrData>(EMPTY_HR_DATA);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<TabId>('overview');
  const [attendanceDialog, setAttendanceDialog] = useState<'short-leave' | 'half-day' | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadHrData();
    setData(result.data);
    setFailed(result.failed);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(t);
  }, [notice]);

  const m = useMemo(() => buildHrModel(data), [data]);

  const reviewLeave = async (id: number, kind: 'approve' | 'reject', reason?: string) => {
    setBusyId(id);
    try {
      const response = await apiFetch(`/leaves/${id}/${kind}`, { method: 'PATCH', ...(kind === 'reject' ? { body: JSON.stringify({ rejectionReason: reason }) } : {}) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { const msg = body?.message ?? `Could not ${kind} this leave.`; throw new Error(Array.isArray(msg) ? msg.join(', ') : msg); }
      setData((cur) => ({ ...cur, leaves: cur.leaves.map((l) => (l.id === id ? { ...l, status: kind === 'approve' ? 'APPROVED' : 'REJECTED' } : l)) }));
      setNotice({ kind: 'success', text: kind === 'approve' ? 'Leave approved.' : 'Leave rejected.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Action failed.' });
    } finally {
      setBusyId(null);
    }
  };

  const announcements = useMemo(() => notifications.filter((n) => n.announcementAuthorRole).map((n) => ({ id: n.id, title: n.title, message: n.message, createdAt: n.createdAt })), [notifications]);

  const dash = (v: string | number) => (loading ? '—' : v);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const pay = m.payrollStatus;
  const payTotal = m.cur.length;
  const payTone: Tone = payTotal === 0 ? 'warn' : pay.pending ? 'warn' : pay.processed ? 'info' : 'good';
  const docAlerts = m.expired.length + m.expiring30.length;
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(m.year, m.month - 1, 1));

  const shared = { m, data, loading };
  const attendanceEntries = (status: 'SHORT_LEAVE' | 'HALF_DAY'): AttendanceExceptionEntry[] => {
    const employeeByUserId = new Map<number, (typeof data.employees)[number]>(
      data.employees.filter((employee) => employee.user?.id).map((employee) => [employee.user!.id!, employee] as const),
    );
    return data.attendance
      .filter((record) => record.date === m.today && record.status.trim().toUpperCase() === status)
      .map((record) => {
        const employee = employeeByUserId.get(record.employeeId);
        return {
          name: employee ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || `Employee #${record.employeeId}` : `Employee #${record.employeeId}`,
          checkIn: record.checkIn,
        };
      });
  };
  const shortLeaveEntries = attendanceEntries('SHORT_LEAVE');
  const halfDayEntries = attendanceEntries('HALF_DAY');

  return (
    <div className="mt-4 flex flex-col gap-5 pb-4 sm:mt-5 sm:gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-500 dark:text-brand-300">{longDate.format(new Date())}</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 dark:text-white md:text-3xl">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{loading ? 'Loading people data…' : `${m.active.length} active employees · ${m.pendingLeaves.length} leave request${m.pendingLeaves.length === 1 ? '' : 's'} to review · ${docAlerts} document alert${docAlerts === 1 ? '' : 's'}.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/hr/employees/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-xs font-bold text-white hover:bg-brand-600"><MdPersonAdd className="h-4 w-4" /> Add employee</Link>
          <button type="button" onClick={() => setRefreshKey((v) => v + 1)} disabled={loading} aria-label="Refresh dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"><MdRefresh className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </header>

      {failed.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">Could not load: {failed.join(', ')}. Sections using that data may look empty. Use Refresh to retry.</div>}
      {notice && <div role="status" className={`rounded-xl px-4 py-3 text-xs font-medium ${notice.kind === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'}`}>{notice.text}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Total employees" value={dash(data.employees.length)} note={`${m.active.length} active · ${m.inactive.length} inactive`} icon={<MdPeopleAlt className="h-5 w-5" />} onClick={() => setTab('overview')} />
        <KpiCard label="New joinees" value={dash(m.joined30.length)} note="Joined in the last 30 days" icon={<MdPersonAdd className="h-5 w-5" />} tone={m.joined30.length ? 'info' : 'neutral'} onClick={() => setTab('onboarding')} />
        <KpiCard label="Short leave today" value={dash(m.attToday.shortLeave)} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} tone={m.attToday.shortLeave ? 'warn' : 'neutral'} onClick={() => setAttendanceDialog('short-leave')} />
        <KpiCard label="Half-day today" value={dash(m.attToday.halfDay)} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} tone={m.attToday.halfDay ? 'warn' : 'neutral'} onClick={() => setAttendanceDialog('half-day')} />
        <KpiCard label="On leave today" value={dash(m.attToday.onLeave)} note={`${m.attToday.absent} absent · ${m.attToday.late} late`} icon={<MdAccessTime className="h-5 w-5" />} tone={m.attToday.onLeave ? 'info' : 'neutral'} onClick={() => setTab('attendance')} />
        <KpiCard label="Leave approvals" value={dash(m.pendingLeaves.length)} note="Waiting for HR" icon={<MdCalendarMonth className="h-5 w-5" />} tone={m.pendingLeaves.length ? 'warn' : 'good'} onClick={() => setTab('attendance')} />
        <KpiCard label={`Payroll · ${monthName}`} value={dash(payTotal ? `${pay.paid}/${payTotal} paid` : 'Not generated')} note={payTotal ? `${pay.pending} pending · ${pay.processed} processed · ${formatCurrency(m.payrollTotals.net)}` : 'No records for this month yet'} icon={<MdCurrencyRupee className="h-5 w-5" />} tone={payTone} onClick={() => setTab('payroll')} />
        <KpiCard label="Document alerts" value={dash(docAlerts)} note={`${m.expired.length} expired · ${m.expiring30.length} expiring in 30 days`} icon={<MdFolderOpen className="h-5 w-5" />} tone={m.expired.length ? 'bad' : m.expiring30.length ? 'warn' : 'good'} onClick={() => setTab('compliance')} />
      </div>

      <nav aria-label="HR dashboard sections" className="-mx-1 overflow-x-auto px-1">
        <div role="tablist" className="flex w-max min-w-full gap-1 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-navy-800">
          {TABS.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition ${tab === t.id ? 'bg-brand-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab {...shared} />}
        {tab === 'hiring' && <HiringTab {...shared} />}
        {tab === 'onboarding' && <OnboardingTab {...shared} />}
        {tab === 'attendance' && <AttendanceLeaveTab {...shared} busyId={busyId} onApprove={(id) => void reviewLeave(id, 'approve')} onReject={(id, reason) => void reviewLeave(id, 'reject', reason)} />}
        {tab === 'payroll' && <PayrollTab {...shared} />}
        {tab === 'performance' && <PerformanceTab {...shared} />}
        {tab === 'training' && <TrainingTab />}
        {tab === 'engagement' && <EngagementTab {...shared} announcements={announcements} />}
        {tab === 'compliance' && <ComplianceTab {...shared} />}
        {tab === 'analytics' && <AnalyticsTab {...shared} />}
      </div>
      {attendanceDialog && (
        <AttendanceExceptionDialog
          title={attendanceDialog === 'short-leave' ? 'Short leave employees today' : 'Half-day employees today'}
          entries={attendanceDialog === 'short-leave' ? shortLeaveEntries : halfDayEntries}
          onClose={() => setAttendanceDialog(null)}
        />
      )}
    </div>
  );
}
