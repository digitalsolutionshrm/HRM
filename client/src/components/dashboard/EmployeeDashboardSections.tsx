'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  MdArrowForward, MdCake, MdDownload, MdNotifications, MdPerson,
} from 'react-icons/md';
import Card from 'components/card';
import { downloadPayslip, formatCurrency, PayrollRecord, periodLabel } from '@/components/payroll/payroll-shared';

type EmployeeProfile = {
  id: number; firstName?: string; lastName?: string; employeeCode?: string;
  designation?: string | null; department?: string | { name?: string } | null;
  phone?: string | null; joiningDate?: string | null;
  personalDetails?: { dateOfBirth?: string | null; gender?: string | null; personalEmail?: string | null };
  addresses?: Array<{ addressLine1?: string | null; city?: string | null; postalCode?: string | null }>;
  documents?: Array<{ id?: number }>;
  manager?: { firstName?: string; lastName?: string; designation?: string | null } | null;
  user?: { id?: number; email?: string };
};
type AttendanceRecord = {
  employeeId: number; date: string; status: string; checkIn?: string | null; checkOut?: string | null;
  breakStart?: string | null; breakEnd?: string | null; breakMinutes?: number;
  workingHours?: number | string | null;
};
type LeaveRecord = {
  id: number; status: string; leaveType?: string; leaveDuration?: string;
  startDate?: string; endDate?: string; createdAt?: string;
};
type DsrRecord = { id: number; date: string; title?: string; status: string; hoursWorked?: number | string };
type Notice = { id: number; title: string; message: string; type: string; createdAt: string; relatedEntityType?: string; relatedEntityId?: string; announcementAuthorRole?: string | null };
type Props = {
  loading: boolean; profile: EmployeeProfile | null; attendance: AttendanceRecord[];
  leaves: LeaveRecord[]; dsrs: DsrRecord[]; payroll: PayrollRecord[];
  notifications: Notice[]; unreadCount: number;
};

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const normalized = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
const announcementRoleLabel = (role?: string | null) => {
  switch (role?.toLowerCase()) {
    case 'admin': return 'Admin';
    case 'hr': return 'HR';
    case 'manager': return 'Manager';
    default: return 'Unknown sender';
  }
};
const departmentLabel = (value?: EmployeeProfile['department']) => typeof value === 'string' ? value : value?.name ?? 'Unassigned';
const shortDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
function Section({ title, href, action, children }: { title: string; href?: string; action?: ReactNode; children: ReactNode }) {
  return <Card extra="w-full overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-navy-700 sm:px-5"><h2 className="text-sm font-bold text-navy-700 dark:text-white">{title}</h2>{action ?? (href ? <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">View all <MdArrowForward /></Link> : null)}</div><div className="p-4 sm:p-5">{children}</div></Card>;
}

function Empty({ children }: { children: ReactNode }) { return <p className="py-5 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>; }

function Status({ value }: { value: string }) {
  const status = normalized(value);
  const good = ['PAID', 'PROCESSED', 'APPROVED', 'PRESENT', 'COMPLETED', 'SUBMITTED'].includes(status);
  const waiting = ['PENDING', 'LATE', 'SHORT_LEAVE', 'HALF_DAY', 'ON_LEAVE'].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${good ? 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300' : waiting ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300'}`}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</span>;
}

function workedHours(record: AttendanceRecord, now: number): number {
  if (record.workingHours !== null && record.workingHours !== undefined && record.checkOut) return Math.max(0, Number(record.workingHours) || 0);
  if (!record.checkIn) return 0;
  const recordDate = record.date?.slice(0, 10);
  if (!record.checkOut && recordDate !== localDate(new Date(now))) return Math.max(0, Number(record.workingHours) || 0);
  const start = new Date(record.checkIn).getTime();
  const end = record.checkOut ? new Date(record.checkOut).getTime() : record.breakStart && !record.breakEnd ? new Date(record.breakStart).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 3_600_000 - Number(record.breakMinutes ?? 0) / 60);
}

function currencyCompact(value: number) {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
  return `₹${Math.round(value)}`;
}

export default function EmployeeDashboardSections({ loading, profile, attendance, leaves, dsrs, payroll, notifications, unreadCount }: Props) {
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const today = new Date();
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const todayKey = localDate(today);
  const monthKey = todayKey.slice(0, 7);
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const monthLabel = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const todayRecord = attendance.find((item) => item.date?.slice(0, 10) === todayKey);
  const myPayroll = useMemo(() => [...payroll].sort((a, b) => b.year - a.year || b.month - a.month), [payroll]);
  const latestPayroll = myPayroll[0];
  const latestApprovedPayslip = myPayroll.find((record) => record.isApproved);
  const usedLeave = leaves.reduce((total, leave) => {
    if (normalized(leave.status) !== 'APPROVED' || normalized(leave.leaveType) === 'UNPAID' || !leave.startDate || !leave.endDate) return total;
    const start = new Date(`${leave.startDate.slice(0, 10)}T00:00:00`);
    const end = new Date(`${leave.endDate.slice(0, 10)}T00:00:00`);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < yearStart || start > yearEnd) return total;
    const from = start < yearStart ? yearStart : start;
    const to = end > yearEnd ? yearEnd : end;
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    return total + (['HALF_DAY', 'SHORT_LEAVE'].includes(normalized(leave.leaveDuration)) ? 0.5 : days);
  }, 0);
  const remainingLeave = Math.max(0, 12 - usedLeave);
  const formatDays = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const myPendingDsrs = dsrs.filter((record) => ['PENDING', 'SUBMITTED'].includes(normalized(record.status)));
  const dsrsThisMonth = dsrs.filter((record) => record.date?.slice(0, 7) === monthKey);
  const monthAttendance = attendance.filter((record) => record.date?.slice(0, 7) === monthKey);
  const calendarDays = new Date(year, monthIndex + 1, 0).getDate();
  const calendarOffset = new Date(year, monthIndex, 1).getDay();
  const attendanceByDate = new Map(attendance.map((record) => [record.date.slice(0, 10), record]));
  const approvedLeaveDates = new Set<string>();
  leaves.filter((leave) => normalized(leave.status) === 'APPROVED' && leave.startDate && leave.endDate).forEach((leave) => {
    const start = new Date(`${leave.startDate!.slice(0, 10)}T00:00:00`);
    const end = new Date(`${leave.endDate!.slice(0, 10)}T00:00:00`);
    for (const date = new Date(Math.max(start.getTime(), new Date(year, monthIndex, 1).getTime())); date <= end && date.getMonth() === monthIndex; date.setDate(date.getDate() + 1)) {
      approvedLeaveDates.add(localDate(date));
    }
  });
  const inferredAbsentDates = new Set<string>();
  const joiningDate = profile?.joiningDate?.slice(0, 10);
  for (let day = 1; day <= calendarDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const key = localDate(date);
    const weekday = date.getDay();
    if (key < todayKey && weekday !== 0 && weekday !== 6 && (!joiningDate || key >= joiningDate) && !normalized(attendanceByDate.get(key)?.status) && !approvedLeaveDates.has(key)) {
      inferredAbsentDates.add(key);
    }
  }
  const calendarStatus = (date: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const recorded = normalized(attendanceByDate.get(key)?.status);
    if (approvedLeaveDates.has(key)) return 'ON_LEAVE';
    return recorded || (inferredAbsentDates.has(key) ? 'ABSENT' : '');
  };
  const monthStatusCounts = Array.from({ length: calendarDays }, (_, index) => calendarStatus(index + 1));
  const attendanceStats = [
    { label: 'Present', value: monthStatusCounts.filter((status) => status === 'PRESENT').length, classes: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/10' },
    { label: 'Absent', value: monthStatusCounts.filter((status) => status === 'ABSENT').length, classes: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10' },
    { label: 'Late', value: monthStatusCounts.filter((status) => status === 'LATE').length, classes: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Short leave', value: monthStatusCounts.filter((status) => status === 'SHORT_LEAVE').length, classes: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-500/10' },
    { label: 'Half days', value: monthStatusCounts.filter((status) => status === 'HALF_DAY').length, classes: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Leave days', value: monthStatusCounts.filter((status) => status === 'ON_LEAVE').length, classes: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10' },
  ];
  const weekStart = new Date(year, monthIndex, today.getDate() - ((today.getDay() + 6) % 7));
  const weekHours = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const key = localDate(day);
    const record = attendanceByDate.get(key);
    return { key, label: day.toLocaleDateString('en-IN', { weekday: 'short' }), dayNumber: day.getDate(), hours: record ? workedHours(record, clockNow) : 0, today: key === todayKey };
  });
  const weekRangeLabel = `${new Date(`${weekHours[0].key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(`${weekHours[6].key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const maxWeekHours = Math.max(8, ...weekHours.map((day) => day.hours));
  const weeklyHours = weekHours.reduce((sum, day) => sum + day.hours, 0);
  const salaryPeriods = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, monthIndex - (5 - index), 1);
    const month = date.getMonth() + 1;
    const periodYear = date.getFullYear();
    const records = myPayroll.filter((record) => record.month === month && record.year === periodYear);
    return { key: `${periodYear}-${month}`, label: date.toLocaleDateString('en-IN', { month: 'short' }), value: records.reduce((sum, record) => sum + Number(record.netSalary || 0), 0) };
  });
  const maxSalary = Math.max(1, ...salaryPeriods.map((period) => period.value));
  const payrollParts = latestPayroll ? [
    { label: 'Basic salary', value: Number(latestPayroll.basicSalary || 0), color: '#536dfe' },
    { label: 'HRA', value: Number(latestPayroll.hra || 0), color: '#25b8b1' },
    { label: 'Allowances', value: Number(latestPayroll.allowances || 0), color: '#a56eff' },
    { label: 'Bonus', value: Number(latestPayroll.bonus || 0), color: '#ffae57' },
    { label: 'Overtime', value: Number(latestPayroll.overtime || 0), color: '#3ca4ec' },
    { label: 'Total deductions', value: Number(latestPayroll.totalDeductions || 0), color: '#f16b82' },
  ] : [];
  const donutTotal = payrollParts.reduce((sum, item) => sum + item.value, 0);
  let donutOffset = 0;
  const donutStops = payrollParts.map((item) => {
    const start = donutOffset;
    donutOffset += donutTotal ? (item.value / donutTotal) * 100 : 0;
    return `${item.color} ${start}% ${donutOffset}%`;
  }).join(', ');
  const completionValues = [
    Boolean(profile?.firstName), Boolean(profile?.lastName), Boolean(profile?.phone),
    Boolean(profile?.designation), Boolean(profile?.department), Boolean(profile?.personalDetails?.personalEmail),
    Boolean(profile?.personalDetails?.dateOfBirth), Boolean(profile?.personalDetails?.gender),
    Boolean(profile?.addresses?.length), Boolean(profile?.documents?.length),
  ];
  const completedFields = completionValues.filter(Boolean).length;
  const profileCompletion = Math.round((completedFields / completionValues.length) * 100);
  const moments = notifications.filter((item) => /birthday|work_anniversary/i.test(`${item.relatedEntityType ?? ''} ${item.title}`) && new Date(item.createdAt).toDateString() === today.toDateString()).slice(0, 5);
  const announcements = notifications.filter((item) => item.type === 'GENERAL' && !/birthday|work_anniversary/i.test(`${item.relatedEntityType ?? ''} ${item.title}`)).slice(0, 3);
  const recentDsr = [...dsrs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const currentMonthOvertime = Number(latestPayroll?.overtimeHours || 0);
  const workingTime = (() => {
    if (!todayRecord) return 'Not checked in';
    const hours = workedHours(todayRecord, clockNow);
    return `${Math.floor(hours)}h ${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}m`;
  })();
  const dayStatus = (date: number) => {
    const status = calendarStatus(date);
    if (status === 'PRESENT') return 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200';
    if (status === 'ABSENT') return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200';
    if (status === 'LATE') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';
    if (status === 'SHORT_LEAVE') return 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200';
    if (status === 'HALF_DAY') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200';
    if (status === 'ON_LEAVE') return 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200';
    return 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700';
  };

  return <div className="flex flex-col gap-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <Card extra="h-full min-h-[150px] w-full p-4 sm:p-5"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">Today’s attendance</p><p className="mt-2 text-xl font-bold text-navy-700 dark:text-white">{loading ? 'Loading…' : todayRecord ? normalized(todayRecord.status).replace(/_/g, ' ') : 'Not checked in'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{todayRecord?.checkIn ? `In ${new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${todayRecord.checkOut ? ` · Out ${new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'No check-in recorded yet'}</p><p className="mt-2 text-sm font-semibold text-brand-600 dark:text-brand-300">Work time · {workingTime}</p></Card>
      <Card extra="h-full min-h-[150px] w-full p-4 sm:p-5"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">Annual leave balance</p><p className="mt-2 text-2xl font-bold tracking-tight text-navy-700 dark:text-white">{loading ? '—' : `${usedLeave}/${12}`}</p><p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">{loading ? 'Loading leave balance…' : `${formatDays(remainingLeave)} days remaining`}</p></Card>
      <Card extra="h-full min-h-[150px] w-full p-4 sm:p-5"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">DSR this month</p><p className="mt-2 text-2xl font-bold tracking-tight text-navy-700 dark:text-white">{loading ? '—' : dsrsThisMonth.length}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{myPendingDsrs.length} awaiting review</p>{dsrsThisMonth.length > 0 && <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">Latest · {shortDate([...dsrsThisMonth].sort((a, b) => b.date.localeCompare(a.date))[0].date)}</p>}</Card>
      <Card extra="h-full min-h-[150px] w-full p-4 sm:p-5"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">Latest net salary</p><p className="mt-2 text-2xl font-bold tracking-tight text-navy-700 dark:text-white">{loading ? '—' : latestPayroll ? formatCurrency(latestPayroll.netSalary) : '—'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{latestPayroll ? periodLabel(latestPayroll) : 'No payroll record yet'}</p><div className="mt-2">{latestPayroll ? <Status value={latestPayroll.status} /> : <span className="text-xs text-gray-500 dark:text-gray-400">No payslip yet</span>}</div></Card>
    </div>

    <Section title={`Attendance · ${monthLabel}`} href="/employee/attendance"><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{attendanceStats.map((item) => <div key={item.label} className={`rounded-xl p-3 ${item.classes}`}><p className="text-xs font-medium">{item.label}</p><p className="mt-1 text-xl font-bold">{loading ? '—' : item.value}</p></div>)}</div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-800 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">Attendance overview</p><h3 className="mt-1 text-base font-bold text-navy-700 dark:text-white">Monthly calendar</h3></div><span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{monthLabel}</span></div><div className="rounded-xl bg-gray-50/80 p-2 dark:bg-navy-900/70 sm:p-3"><div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-1.5 text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:text-[10px]">{day}</span>)}{Array.from({ length: calendarOffset }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" className="aspect-square" />)}{Array.from({ length: calendarDays }, (_, index) => { const day = index + 1; const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const record = attendanceByDate.get(key); const status = calendarStatus(day).replace(/_/g, ' ').toLowerCase(); const dayHours = record ? workedHours(record, clockNow) : 0; return <span key={key} aria-label={day + ': ' + (status || 'no attendance record') + ', ' + dayHours.toFixed(1) + ' working hours'} title={monthLabel + ' ' + day + ' · ' + (status || 'No attendance') + ' · ' + dayHours.toFixed(1) + ' working hours'} className={`grid aspect-square min-h-8 place-items-center rounded-lg text-[11px] font-semibold transition-colors sm:rounded-xl sm:text-xs ${dayStatus(day)} ${key === todayKey ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-navy-900' : ''}`}>{day}</span>; })}</div></div><div className="mt-4 flex flex-wrap gap-2">{[{ label: 'Present', dot: 'bg-green-500' }, { label: 'Absent', dot: 'bg-red-500' }, { label: 'Late', dot: 'bg-amber-500' }, { label: 'Half day', dot: 'bg-indigo-500' }, { label: 'Leave', dot: 'bg-sky-500' }].map((item) => <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-600 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-300"><i className={`h-2 w-2 rounded-full ${item.dot}`} />{item.label}</span>)}</div></div>
        <div className="flex flex-col gap-4"><div className="rounded-xl border border-gray-100 p-4 dark:border-navy-700"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-navy-700 dark:text-white">Working hours this week</h3><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{weekRangeLabel} · daily attendance total</p></div><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{weeklyHours.toFixed(1)} hrs</span></div><div className="flex h-36 items-end justify-between gap-2 border-b border-gray-100 px-1 dark:border-navy-700">{weekHours.map((day) => <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[9px] text-gray-500 dark:text-gray-400">{day.hours ? day.hours.toFixed(1) : ''}</span><div className={`w-full max-w-8 rounded-t-md ${day.today ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-500/40'}`} style={{ height: `${Math.max(day.hours ? 8 : 2, (day.hours / maxWeekHours) * 100)}%` }} /><span className="pb-1 text-center text-[10px] leading-tight text-gray-500 dark:text-gray-400">{day.label}<small className="mt-0.5 block text-[9px] text-gray-400 dark:text-gray-500">{day.dayNumber}</small></span></div>)}</div><p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">Each bar shows one day’s recorded hours; today updates live.</p></div><div className="flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><div><p className="text-xs text-gray-500 dark:text-gray-400">Overtime · latest payslip period</p><p className="mt-1 text-lg font-bold text-navy-700 dark:text-white">{loading ? '—' : `${currentMonthOvertime.toFixed(1)} hours`}</p></div><p className="text-right text-xs text-gray-500 dark:text-gray-400">{formatCurrency(Number(latestPayroll?.overtime || 0))}<br />overtime pay</p></div></div>
      </div>
    </Section>

    <Section title="My payroll"><div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-navy-700 dark:text-white">Salary trend · last 6 months</h3><Link href="/employee/payslips" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Payslip history →</Link></div><div role="img" aria-label="Net salary trend for the last six months" className="flex h-52 items-end gap-3 rounded-xl bg-gray-50 px-4 pb-3 pt-5 dark:bg-navy-900">{salaryPeriods.map((item) => <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="truncate text-[9px] text-gray-500 dark:text-gray-400">{item.value ? currencyCompact(item.value) : '—'}</span><div className={`w-full max-w-10 rounded-t-md ${item.key === `${year}-${monthIndex + 1}` ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-500/45'}`} style={{ height: `${item.value ? Math.max(8, (item.value / maxSalary) * 100) : 2}%` }} /><span className="text-[10px] text-gray-500 dark:text-gray-400">{item.label}</span></div>)}</div></div>
      <div><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-navy-700 dark:text-white">Latest salary breakdown</h3>{latestApprovedPayslip && <button type="button" disabled={downloading} onClick={async () => { setDownloading(true); setDownloadError(''); try { await downloadPayslip(latestApprovedPayslip); } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Could not download this payslip.'); } finally { setDownloading(false); } }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"><MdDownload />{downloading ? 'Preparing…' : 'Download payslip'}</button>}</div>{latestPayroll ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div role="img" aria-label="Salary breakdown donut chart" className="mx-auto h-36 w-36 shrink-0 rounded-full" style={{ background: donutTotal ? `conic-gradient(${donutStops})` : '#e5e7eb' }}><div className="m-5 grid h-[104px] w-[104px] place-items-center rounded-full bg-white text-center dark:bg-navy-800"><span><strong className="block text-sm text-navy-700 dark:text-white">{formatCurrency(latestPayroll.netSalary)}</strong><small className="text-[9px] text-gray-500 dark:text-gray-400">Net pay</small></span></div></div><div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">{payrollParts.map((part) => <div key={part.label} className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: part.color }} /><span className="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300">{part.label}</span><span className="text-xs font-semibold text-navy-700 dark:text-white">{formatCurrency(part.value)}</span></div>)}</div></div> : <Empty>No salary breakdown is available yet.</Empty>}{downloadError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{downloadError}</p>}</div>
    </div></Section>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Section title="My DSR & work log" href="/employee/dsr"><div className="space-y-3">{recentDsr.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900"><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{record.title || 'Daily status report'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{shortDate(record.date)} · {Number(record.hoursWorked || 0).toFixed(1)} hours</p></div><Status value={record.status} /></div>)}{!loading && recentDsr.length === 0 && <Empty>No DSR entries yet. Use the DSR page to log your work.</Empty>}</div></Section>
      <Section title="Personal & company updates"><div className="grid grid-cols-1 gap-5 md:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><MdPerson /></span><div><p className="text-sm font-bold text-navy-700 dark:text-white">Profile completion</p><p className="text-[10px] text-gray-500 dark:text-gray-400">{completedFields} of {completionValues.length} details available</p></div></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900"><div className="h-full rounded-full bg-brand-500" style={{ width: `${profileCompletion}%` }} /></div><p className="mt-1 text-right text-xs font-semibold text-navy-700 dark:text-gray-200">{profileCompletion}%</p><div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300"><p><b className="text-navy-700 dark:text-white">Manager:</b> {profile?.manager ? `${profile.manager.firstName ?? ''} ${profile.manager.lastName ?? ''}`.trim() : 'Not assigned'}</p><p><b className="text-navy-700 dark:text-white">Department:</b> {departmentLabel(profile?.department)}</p><p><b className="text-navy-700 dark:text-white">Employee ID:</b> {profile?.employeeCode ?? '—'}</p></div><Link href="/employee/profile" className="mt-3 inline-flex text-xs font-semibold text-brand-600 dark:text-brand-300">Review my profile →</Link></div><div><div className="mb-2 flex items-center gap-2"><MdCake className="text-pink-500" /><h3 className="text-sm font-bold text-navy-700 dark:text-white">Birthdays & anniversaries</h3></div>{moments.length ? moments.map((notice) => <div key={notice.id} className="border-b border-gray-100 py-2 last:border-0 dark:border-navy-700"><p className="text-xs font-semibold text-navy-700 dark:text-white">{notice.title}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-gray-500 dark:text-gray-400">{notice.message}</p></div>) : <p className="py-2 text-xs text-gray-500 dark:text-gray-400">No birthday or work anniversary updates today.</p>}</div></div></Section>
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><Section title="Announcements" href="/employee/notifications"><div className="space-y-3">{announcements.map((notice) => <div key={notice.id} className="rounded-lg bg-gray-50 p-3 dark:bg-navy-900"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold text-navy-700 dark:text-white">{notice.title}</p><span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">Posted by {announcementRoleLabel(notice.announcementAuthorRole ?? notice.relatedEntityId)}</span></div><p className="mt-1 whitespace-pre-line break-words text-xs text-gray-600 dark:text-gray-300">{notice.message}</p><p className="mt-1 text-[10px] text-gray-400">{new Date(notice.createdAt).toLocaleDateString()}</p></div>)}{announcements.length === 0 && <Empty>No company announcements right now.</Empty>}</div></Section><Section title={`Notifications${unreadCount ? ` · ${unreadCount} unread` : ''}`} href="/employee/notifications"><div className="space-y-3">{notifications.slice(0, 4).map((notice) => <div key={notice.id} className="flex gap-3"><MdNotifications className="mt-0.5 shrink-0 text-brand-500" /><div className="min-w-0"><p className="text-sm font-semibold text-navy-700 dark:text-white">{notice.title}</p><p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-xs text-gray-500 dark:text-gray-400">{notice.message}</p><p className="mt-1 text-[10px] text-gray-400">{new Date(notice.createdAt).toLocaleDateString()}</p></div></div>)}{notifications.length === 0 && <Empty>No new notifications.</Empty>}</div></Section></div>
  </div>;
}


