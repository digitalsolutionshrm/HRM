'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  MdAccessTime, MdArrowDownward, MdArrowForward, MdArrowUpward, MdCalendarMonth,
  MdCheckCircle, MdClose, MdCurrencyRupee, MdEditNote, MdEventBusy, MdGroups,
  MdPeopleAlt, MdPendingActions, MdRefresh,
} from 'react-icons/md';
import Card from 'components/card';
import BarChart from 'components/charts/BarChart';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationRealtime } from '@/contexts/NotificationRealtimeContext';
import { apiFetch } from '@/lib/api';
import { PayrollRecord, formatCurrency, payrollApi } from '@/components/payroll/payroll-shared';
import DsrDescription from '@/components/dsr/DsrDescription';
import { getMediaUrl } from '@/lib/media-url';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TeamMember = {
  id: number; // employee id
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  designation?: string | null;
  profileImage?: string | null;
  department?: { id: number; name: string } | null;
  user?: { id?: number; email?: string };
};
// `employeeId` on attendance is the USER id; `memberId` is the employee id we fetched it for.
type AttendanceRow = { employeeId: number; memberId: number; date: string; status: string; checkIn?: string | null; checkOut?: string | null; workingHours?: number | string | null };
type LeaveRow = { id: number; employeeId: number; status: string; leaveType?: string; leaveDuration?: string; startDate: string; endDate: string; reason?: string };
type DsrRow = { id: number; memberId: number; date: string; title?: string; description?: string; status: string; hoursWorked?: number | string | null };

type Data = {
  team: TeamMember[];
  attendance: AttendanceRow[];
  leaves: LeaveRow[];
  dsrs: DsrRow[];
  myPayroll: PayrollRecord[]; // the manager's OWN payslips only
};
const EMPTY: Data = { team: [], attendance: [], leaves: [], dsrs: [], myPayroll: [] };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? fallback;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as T;
}

async function getList<T>(path: string): Promise<T[]> {
  const payload = await unwrap<T[] | { items?: T[] }>(await apiFetch(path), `Could not load ${path}`);
  return Array.isArray(payload) ? payload : payload?.items ?? [];
}

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysFromToday = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return ymd(d); };
const day = (value?: string | null) => (value ?? '').slice(0, 10);
const norm = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
const nameOf = (m?: { firstName?: string; lastName?: string } | null) => [m?.firstName, m?.lastName].filter(Boolean).join(' ') || 'Team member';
const initials = (m?: TeamMember | null) => nameOf(m).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const hours = (value?: number | string | null) => Number(value ?? 0) || 0;
const pretty = (value: string) => norm(value).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) || '—';

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${day(value)}T00:00:00`)) : '—';
const weekdayShort = (value: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
const timeLabel = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)) : '—';

const PRESENT_SET = ['PRESENT', 'LATE', 'SHORT_LEAVE', 'HALF_DAY'];

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-navy-700 dark:text-white',
  good: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-300',
  bad: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-300',
};
const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  good: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300',
  warn: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
};

function KpiCard({ label, value, note, icon, tone = 'neutral', href, trend }: {
  label: string; value: string | number; note: string; icon: ReactNode; tone?: Tone; href: string;
  trend?: { dir: 'up' | 'down'; text: string; good: boolean } | null;
}) {
  return (
    <Link href={href} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-[20px]">
      <Card extra="h-full w-full p-4 sm:p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`mt-2 truncate text-2xl font-bold tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>
          </div>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE_ICON[tone]}`}>{icon}</span>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>
        {trend && (
          <p className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold ${trend.good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {trend.dir === 'up' ? <MdArrowUpward /> : <MdArrowDownward />}{trend.text}
          </p>
        )}
      </Card>
    </Link>
  );
}

function Section({ id, title, subtitle, href, hrefLabel = 'View all', children }: {
  id?: string; title: string; subtitle?: string; href?: string; hrefLabel?: string; children: ReactNode;
}) {
  return (
    <Card extra="w-full overflow-hidden" id={id}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-navy-700 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-navy-700 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">
            {hrefLabel} <MdArrowForward />
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>;
}

const PILL: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300',
  good: 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/25 dark:text-sky-300',
};
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${PILL[tone]}`}>{children}</span>;
}

function attendanceTone(status: string): Tone {
  switch (status) {
    case 'PRESENT': return 'good';
    case 'LATE': case 'SHORT_LEAVE': case 'HALF_DAY': return 'warn';
    case 'ABSENT': return 'bad';
    case 'ON_LEAVE': return 'info';
    default: return 'neutral';
  }
}
function dsrTone(status: string): Tone {
  switch (status) {
    case 'APPROVED': return 'good';
    case 'SUBMITTED': return 'warn';
    case 'REJECTED': return 'bad';
    case 'DRAFT': return 'neutral';
    default: return 'bad';
  }
}

function Avatar({ member, size = 'h-9 w-9' }: { member?: TeamMember | null; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200`}>
      {member?.profileImage ? <img src={getMediaUrl(member.profileImage)} alt="" className="h-full w-full object-cover" /> : initials(member)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotificationRealtime();
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const today = ymd(new Date());
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => daysFromToday(i - 6)), []);

  /* ---------- load (everything is scoped to the manager's own team) ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    setWarning('');
    let failed = 0;
    const safe = async <T,>(task: Promise<T>, fallback: T): Promise<T> => {
      try { return await task; } catch { failed += 1; return fallback; }
    };

    const team = await safe(getList<TeamMember>('/employees/team'), []);
    const perMember = await Promise.all(team.map(async (member) => {
      const userId = member.user?.id;
      const [attendance, leaves, dsrs] = await Promise.all([
        userId ? safe(getList<Omit<AttendanceRow, 'memberId'>>(`/attendance/employee/${userId}`), []) : Promise.resolve([]),
        safe(getList<LeaveRow>(`/leaves/employee/${member.id}`), []),
        safe(getList<Omit<DsrRow, 'memberId'>>(`/dsr/employee/${member.id}`), []),
      ]);
      const cutoff = daysFromToday(-6);
      return {
        attendance: attendance.filter((row) => day(row.date) >= cutoff).map((row) => ({ ...row, date: day(row.date), memberId: member.id })),
        leaves,
        dsrs: dsrs.filter((row) => day(row.date) >= cutoff).map((row) => ({ ...row, date: day(row.date), memberId: member.id })),
      };
    }));

    const myPayroll = await safe(payrollApi.getMine(), [] as PayrollRecord[]);

    setData({
      team,
      attendance: perMember.flatMap((entry) => entry.attendance),
      leaves: perMember.flatMap((entry) => entry.leaves),
      dsrs: perMember.flatMap((entry) => entry.dsrs),
      myPayroll,
    });
    setWarning(failed ? 'Some dashboard sections could not be loaded. Use Refresh to try again.' : '');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---------- derived numbers ---------- */
  const view = useMemo(() => {
    const { team, attendance, leaves, dsrs, myPayroll } = data;

    const approvedLeaveToday = (memberId: number) =>
      leaves.some((leave) => leave.employeeId === memberId && norm(leave.status) === 'APPROVED' && day(leave.startDate) <= today && day(leave.endDate) >= today);

    const rows = team.map((member) => {
      const att = attendance.find((row) => row.memberId === member.id && row.date === today);
      const status = att ? norm(att.status) : approvedLeaveToday(member.id) ? 'ON_LEAVE' : 'NOT_MARKED';
      const dsrToday = dsrs.find((row) => row.memberId === member.id && row.date === today);
      const weekHours = dsrs.filter((row) => row.memberId === member.id).reduce((sum, row) => sum + hours(row.hoursWorked), 0);
      return { member, att, status, dsrStatus: dsrToday ? norm(dsrToday.status) : 'MISSING', weekHours };
    });

    const present = rows.filter((row) => PRESENT_SET.includes(row.status)).length;
    const late = rows.filter((row) => row.status === 'LATE').length;
    const absent = rows.filter((row) => row.status === 'ABSENT').length;
    const onLeave = rows.filter((row) => row.status === 'ON_LEAVE').length;
    const notMarked = rows.filter((row) => row.status === 'NOT_MARKED').length;

    const yesterday = daysFromToday(-1);
    const presentYesterday = attendance.filter((row) => row.date === yesterday && PRESENT_SET.includes(norm(row.status))).length;

    const memberById = new Map(team.map((member) => [member.id, member]));
    const pendingDsrs = dsrs.filter((row) => norm(row.status) === 'SUBMITTED').sort((a, b) => b.date.localeCompare(a.date));
    const pendingLeaves = leaves.filter((row) => norm(row.status) === 'PENDING').sort((a, b) => day(a.startDate).localeCompare(day(b.startDate)));
    const horizon = daysFromToday(14);
    const upcomingLeaves = leaves
      .filter((row) => norm(row.status) === 'APPROVED' && day(row.endDate) >= today && day(row.startDate) <= horizon)
      .sort((a, b) => day(a.startDate).localeCompare(day(b.startDate)));
    const dsrMissing = rows.filter((row) => row.dsrStatus === 'MISSING' && row.status !== 'ON_LEAVE').length;

    const series = [
      { name: 'Present', data: last7.map((d) => attendance.filter((row) => row.date === d && ['PRESENT', 'HALF_DAY'].includes(norm(row.status))).length) },
      { name: 'Late', data: last7.map((d) => attendance.filter((row) => row.date === d && norm(row.status) === 'LATE').length) },
      { name: 'On leave', data: last7.map((d) => attendance.filter((row) => row.date === d && norm(row.status) === 'ON_LEAVE').length) },
      { name: 'Absent', data: last7.map((d) => attendance.filter((row) => row.date === d && norm(row.status) === 'ABSENT').length) },
    ];

    const myLatest = [...myPayroll].sort((a, b) => b.year - a.year || b.month - a.month)[0] ?? null;
    const maxHours = Math.max(1, ...rows.map((row) => row.weekHours));

    return { rows, present, late, absent, onLeave, notMarked, presentYesterday, memberById, pendingDsrs, pendingLeaves, upcomingLeaves, dsrMissing, series, maxHours, myLatest };
  }, [data, today, last7]);

  /* ---------- actions ---------- */
  const reviewDsr = async (id: number, kind: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const response = await apiFetch(`/dsr/${id}/${kind}`, {
        method: 'PATCH',
        ...(kind === 'reject' ? { body: JSON.stringify({ managerComment: rejectComment.trim() || undefined }) } : {}),
      });
      await unwrap<unknown>(response, `Could not ${kind} this DSR.`);
      setData((current) => ({ ...current, dsrs: current.dsrs.map((row) => (row.id === id ? { ...row, status: kind === 'approve' ? 'APPROVED' : 'REJECTED' } : row)) }));
      setRejectingId(null);
      setRejectComment('');
      setNotice({ kind: 'success', text: kind === 'approve' ? 'DSR approved.' : 'DSR sent back to the employee.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Action failed.' });
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- render helpers ---------- */
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const total = data.team.length;
  const presentDelta = view.present - view.presentYesterday;
  const pendingApprovals = view.pendingDsrs.length;
  const dash = (value: string | number) => (loading ? '—' : value);
  const gridText = '#A3AED0';

  const chartOptions = {
    chart: { stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
    colors: ['#22c55e', '#f59e0b', '#0ea5e9', '#ef4444'],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '42%' } },
    dataLabels: { enabled: false },
    stroke: { show: false },
    grid: { borderColor: 'rgba(163,174,208,0.2)', strokeDashArray: 4 },
    xaxis: { categories: last7.map(weekdayShort), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: gridText, fontSize: '11px' } } },
    yaxis: { forceNiceScale: true, decimalsInFloat: 0, labels: { style: { colors: gridText, fontSize: '11px' } } },
    legend: { position: 'bottom', labels: { colors: gridText }, markers: { radius: 12 } },
    tooltip: { theme: 'dark' },
  };

  return (
    <div className="mt-4 flex flex-col gap-5 pb-4 sm:mt-5 sm:gap-6">
      {/* ---------------- Header ---------------- */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-500 dark:text-brand-300">{longDate.format(new Date())}</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700 dark:text-white md:text-3xl">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {loading ? 'Loading your team…' : total ? `${view.present} of ${total} team members are in today · ${pendingApprovals} approval${pendingApprovals === 1 ? '' : 's'} waiting for you.` : 'No direct reports are assigned to you yet.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/manager/team" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-xs font-bold text-white hover:bg-brand-600"><MdPeopleAlt className="h-4 w-4" /> My team</Link>
          <button type="button" onClick={() => setRefreshKey((v) => v + 1)} disabled={loading} aria-label="Refresh dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700">
            <MdRefresh className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {warning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">{warning}</div>}
      {notice && <div role="status" className={`rounded-xl px-4 py-3 text-xs font-medium ${notice.kind === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'}`}>{notice.text}</div>}

      {/* ---------------- KPI cards ---------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Pending approvals" value={dash(pendingApprovals)} note="DSRs waiting for your review" icon={<MdPendingActions className="h-5 w-5" />} tone={pendingApprovals ? 'warn' : 'good'} href="#approvals" />
        <KpiCard label="Team size" value={dash(total)} note={`${new Set(data.team.map((m) => m.department?.name).filter(Boolean)).size} department(s)`} icon={<MdGroups className="h-5 w-5" />} href="/manager/team" />
        <KpiCard label="Present today" value={dash(`${view.present}/${total}`)} note={`${view.late} late · ${view.absent} absent · ${view.notMarked} not marked`} icon={<MdAccessTime className="h-5 w-5" />} tone={total && view.present === total ? 'good' : 'neutral'} href="/manager/attendance"
          trend={!loading && presentDelta !== 0 ? { dir: presentDelta > 0 ? 'up' : 'down', text: `${Math.abs(presentDelta)} vs yesterday`, good: presentDelta > 0 } : null} />
        <KpiCard label="On leave today" value={dash(view.onLeave)} note={`${view.upcomingLeaves.length} approved in next 14 days`} icon={<MdEventBusy className="h-5 w-5" />} tone={view.onLeave ? 'info' : 'neutral'} href="/manager/leaves" />
        <KpiCard label="Leave requests" value={dash(view.pendingLeaves.length)} note="Pending with HR" icon={<MdCalendarMonth className="h-5 w-5" />} tone={view.pendingLeaves.length ? 'warn' : 'neutral'} href="/manager/leaves" />
        <KpiCard label="DSR missing today" value={dash(view.dsrMissing)} note="Not submitted yet (excl. on leave)" icon={<MdEditNote className="h-5 w-5" />} tone={view.dsrMissing ? 'bad' : 'good'} href="#team-today" />
      </div>

      {/* ---------------- Team today + approvals ---------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Section id="team-today" title="Team today" subtitle="Live attendance and DSR status for each direct report" href="/manager/attendance" hrefLabel="Attendance">
          {loading ? <Empty>Loading team…</Empty> : view.rows.length === 0 ? <Empty>No direct reports yet. Employees assigned to you will appear here.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="pb-3">Employee</th><th className="pb-3">Attendance</th><th className="pb-3">Check-in</th><th className="pb-3">DSR today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                  {view.rows.slice(0, 10).map(({ member, att, status, dsrStatus }) => (
                    <tr key={member.id} className="text-sm text-navy-700 dark:text-gray-200">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <Avatar member={member} />
                          <div className="min-w-0"><p className="truncate font-semibold">{nameOf(member)}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{member.designation || member.department?.name || '—'}</p></div>
                        </div>
                      </td>
                      <td className="py-3"><Pill tone={status === 'NOT_MARKED' ? 'neutral' : attendanceTone(status)}>{status === 'NOT_MARKED' ? 'Not marked' : pretty(status)}</Pill></td>
                      <td className="py-3 font-mono text-xs">{timeLabel(att?.checkIn)}</td>
                      <td className="py-3"><Pill tone={dsrTone(dsrStatus)}>{dsrStatus === 'MISSING' ? 'Missing' : pretty(dsrStatus)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {view.rows.length > 10 && <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">Showing 10 of {view.rows.length}. <Link href="/manager/team" className="font-semibold text-brand-600 dark:text-brand-300">See full team</Link></p>}
            </div>
          )}
        </Section>

        <Section id="approvals" title="Approvals" subtitle="Review your team's daily status reports">
          {loading ? <Empty>Loading approvals…</Empty> : view.pendingDsrs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center"><MdCheckCircle className="h-8 w-8 text-green-500" /><p className="text-sm font-semibold text-navy-700 dark:text-white">All caught up</p><p className="text-xs text-gray-500 dark:text-gray-400">No DSRs are waiting for review.</p></div>
          ) : (
            <ul className="space-y-3">
              {view.pendingDsrs.slice(0, 6).map((dsr) => {
                const member = view.memberById.get(dsr.memberId);
                const busy = busyId === dsr.id;
                return (
                  <li key={dsr.id} className="rounded-xl bg-gray-50 p-3 dark:bg-navy-900">
                    <div className="flex items-start gap-3">
                      <Avatar member={member} size="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{dsr.title || 'Daily status report'}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{nameOf(member)} · {shortDate(dsr.date)} · {hours(dsr.hoursWorked)}h logged</p>
                        {dsr.description && (
                          <div className="mt-2">
                            <DsrDescription description={dsr.description} />
                          </div>
                        )}
                      </div>
                    </div>
                    {rejectingId === dsr.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} rows={2} placeholder="Reason for sending back (optional)"
                          className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-navy-700 outline-none focus:border-brand-400 dark:border-navy-600 dark:bg-navy-800 dark:text-white" />
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={() => void reviewDsr(dsr.id, 'reject')} className="h-8 flex-1 rounded-lg bg-red-500 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50">{busy ? 'Sending…' : 'Send back'}</button>
                          <button type="button" disabled={busy} onClick={() => { setRejectingId(null); setRejectComment(''); }} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 dark:border-navy-600 dark:text-gray-300">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void reviewDsr(dsr.id, 'approve')} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-green-500 text-xs font-bold text-white hover:bg-green-600 disabled:opacity-50"><MdCheckCircle /> {busy ? 'Saving…' : 'Approve'}</button>
                        <button type="button" disabled={busy} onClick={() => { setRejectingId(dsr.id); setRejectComment(''); }} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"><MdClose /> Reject</button>
                      </div>
                    )}
                  </li>
                );
              })}
              {view.pendingDsrs.length > 6 && <p className="text-center text-xs text-gray-500 dark:text-gray-400">+{view.pendingDsrs.length - 6} more after you clear these.</p>}
            </ul>
          )}
        </Section>
      </div>

      {/* ---------------- Trend + workload ---------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Attendance · last 7 days" subtitle="Daily headcount by status">
          {loading ? <Empty>Loading chart…</Empty> : total === 0 ? <Empty>No team data to chart yet.</Empty> : <div className="h-[260px] w-full"><BarChart chartData={view.series} chartOptions={chartOptions} /></div>}
        </Section>

        <Section title="Workload · last 7 days" subtitle="Hours logged in DSRs per person">
          {loading ? <Empty>Loading workload…</Empty> : view.rows.length === 0 ? <Empty>No team members yet.</Empty> : (
            <ul className="space-y-4">
              {[...view.rows].sort((a, b) => b.weekHours - a.weekHours).slice(0, 7).map(({ member, weekHours }) => (
                <li key={member.id}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="truncate font-medium text-navy-700 dark:text-gray-200">{nameOf(member)}</span>
                    <span className={weekHours ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-amber-600 dark:text-amber-300'}>{weekHours ? `${weekHours.toFixed(1)} h` : 'No DSR'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900"><div className="h-full rounded-full bg-brand-500" style={{ width: `${weekHours ? Math.max(4, Math.round((weekHours / view.maxHours) * 100)) : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ---------------- Leaves + payroll ---------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Leave calendar" subtitle="Pending requests and approved leave in the next 14 days" href="/manager/leaves">
          {loading ? <Empty>Loading leaves…</Empty> : view.pendingLeaves.length + view.upcomingLeaves.length === 0 ? <Empty>No pending or upcoming leave for your team.</Empty> : (
            <ul className="space-y-3">
              {[...view.pendingLeaves.slice(0, 4), ...view.upcomingLeaves.slice(0, 4)].map((leave) => (
                <li key={`${leave.id}-${leave.status}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{nameOf(view.memberById.get(leave.employeeId))}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{pretty(leave.leaveType ?? 'Leave')} · {shortDate(leave.startDate)}{day(leave.endDate) !== day(leave.startDate) ? ` – ${shortDate(leave.endDate)}` : ''}{leave.leaveDuration && norm(leave.leaveDuration) !== 'FULL_DAY' ? ` · ${pretty(leave.leaveDuration)}` : ''}</p>
                  </div>
                  <Pill tone={norm(leave.status) === 'PENDING' ? 'warn' : 'good'}>{pretty(leave.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">Leave requests are approved by HR; you can see them here to plan coverage.</p>
        </Section>

        <Section title="My payroll" subtitle={view.myLatest ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(view.myLatest.year, view.myLatest.month - 1, 1)) : 'Your latest payslip'} href="/manager/payslips" hrefLabel="My payslips">
          {loading ? <Empty>Loading your payslip…</Empty> : !view.myLatest ? <Empty>No payslip has been generated for you yet.</Empty> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Net salary</p><p className="mt-2 text-lg font-bold text-navy-700 dark:text-white">{formatCurrency(view.myLatest.netSalary)}</p></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Deductions</p><p className="mt-2 text-lg font-bold text-navy-700 dark:text-white">{formatCurrency(view.myLatest.totalDeductions)}</p></div>
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Status</p><div className="mt-2"><Pill tone={norm(view.myLatest.status) === 'PAID' ? 'good' : 'warn'}>{pretty(view.myLatest.status)}</Pill></div></div>
            </div>
          )}
        </Section>
      </div>

      {/* ---------------- Notifications ---------------- */}
      <Section title="Recent notifications" subtitle={`${unreadCount} unread`} href="/manager/notifications">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {notifications.slice(0, 4).map((n) => (
            <div key={n.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 dark:bg-navy-900">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-gray-300 dark:bg-navy-600' : 'bg-brand-500'}`} />
              <div className="min-w-0"><p className="text-sm font-semibold text-navy-700 dark:text-white">{n.title}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.message}</p></div>
            </div>
          ))}
          {notifications.length === 0 && <div className="md:col-span-2"><Empty>No recent notifications.</Empty></div>}
        </div>
      </Section>

      {/* ---------------- Quick actions ---------------- */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-navy-700 dark:text-white">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: '/manager/team', icon: <MdPeopleAlt className="h-5 w-5" />, title: 'My team', detail: `${total} direct reports` },
            { href: '/manager/attendance', icon: <MdAccessTime className="h-5 w-5" />, title: 'Attendance', detail: 'Review & correct records' },
            { href: '/manager/leaves', icon: <MdCalendarMonth className="h-5 w-5" />, title: 'Leaves', detail: 'Apply or track requests' },
            { href: '/manager/payslips', icon: <MdCurrencyRupee className="h-5 w-5" />, title: 'My payroll', detail: 'Your payslips and salary history' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-navy-700 dark:bg-navy-800 dark:hover:border-brand-500/50 dark:hover:bg-navy-700">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-50 text-brand-600 dark:bg-navy-900 dark:text-brand-300">{item.icon}</span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-navy-700 dark:text-white">{item.title}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{item.detail}</span></span>
              <MdArrowForward className="ml-auto shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
