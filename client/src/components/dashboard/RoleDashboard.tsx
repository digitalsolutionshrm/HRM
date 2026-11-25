'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  MdAccessTime, MdArrowForward, MdCalendarMonth,
  MdCheckCircle, MdCurrencyRupee, MdGroups, MdHistory, MdNotifications,
  MdPeopleAlt, MdRefresh, MdTaskAlt, MdWarningAmber,
} from 'react-icons/md';
import Card from 'components/card';
import EmployeeDashboardSections from './EmployeeDashboardSections';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationRealtime } from '@/contexts/NotificationRealtimeContext';
import { apiFetch } from '@/lib/api';
import {
  PayrollRecord, PayrollIncrement,
  formatCurrency, payrollApi,
} from '@/components/payroll/payroll-shared';
import AttendanceExceptionDialog, { type AttendanceExceptionEntry } from './AttendanceExceptionDialog';

type Role = 'employee' | 'hr' | 'admin';
type EmployeeRecord = {
  id: number; firstName?: string; lastName?: string; employeeCode?: string;
  designation?: string | null; department?: string | { name?: string } | null;
  status?: boolean; phone?: string | null; joiningDate?: string | null;
  personalDetails?: { dateOfBirth?: string | null; gender?: string | null; personalEmail?: string | null };
  addresses?: Array<{ addressLine1?: string | null; city?: string | null; postalCode?: string | null }>;
  documents?: Array<{ id?: number }>;
  manager?: { firstName?: string; lastName?: string; designation?: string | null } | null;
  user?: { id?: number; name?: string; email?: string };
};
type AttendanceRecord = { employeeId: number; date: string; status: string; checkIn?: string | null; checkOut?: string | null; breakStart?: string | null; breakEnd?: string | null; breakMinutes?: number; workingHours?: number | string | null; employee?: { name?: string } };
type LeaveRecord = { id: number; employeeId: number; status: string; leaveType?: string; leaveDuration?: string; startDate?: string; endDate?: string; createdAt?: string; employee?: EmployeeRecord };
type DsrRecord = { id: number; employeeId?: number; date: string; title?: string; status: string; employee?: EmployeeRecord };
type DepartmentRecord = { id: number; name: string; status?: boolean };
type DashboardData = {
  profile: EmployeeRecord | null; employees: EmployeeRecord[]; attendance: AttendanceRecord[];
  leaves: LeaveRecord[]; dsrs: DsrRecord[]; departments: DepartmentRecord[];
  payroll: PayrollRecord[]; increments: PayrollIncrement[];
};

const EMPTY_DATA: DashboardData = {
  profile: null, employees: [], attendance: [], leaves: [], dsrs: [],
  departments: [], payroll: [], increments: [],
};

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? fallback;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as T;
}

async function getList<T>(path: string): Promise<T[]> {
  const payload = await responseData<T[] | { items?: T[] }>(await apiFetch(path), `Could not load ${path}.`);
  if (Array.isArray(payload)) return payload as T[];
  return (payload as { items?: T[] } | null)?.items ?? [];
}

async function getOne<T>(path: string): Promise<T> {
  return responseData<T>(await apiFetch(path), `Could not load ${path}.`);
}

async function safe<T>(task: Promise<T>, fallback: T, issues: string[]): Promise<T> {
  try { return await task; } catch { issues.push('Some dashboard information could not be loaded.'); return fallback; }
}

const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currentPeriod = () => { const now = new Date(); return { month: now.getMonth() + 1, year: now.getFullYear() }; };
const normalized = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
const fullName = (employee?: EmployeeRecord | null) => [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') || 'Employee';
const departmentName = (value: EmployeeRecord['department']) => typeof value === 'string' ? value : value?.name ?? 'Unassigned';
const dateLabel = (value = new Date()) => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
const shortDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : '—';

function Metric({ label, value, note, icon, tone = 'text-navy-700 dark:text-white', onClick }: { label: string; value: string | number; note: string; icon: ReactNode; tone?: string; onClick?: () => void }) {
  const card = <Card extra="w-full p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-2 truncate text-2xl font-bold tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">{icon}</span></div></Card>;
  return onClick ? <button type="button" onClick={onClick} className="block w-full rounded-[20px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">{card}</button> : card;
}

function Section({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return <Card extra="w-full overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-navy-700 sm:px-5"><h2 className="text-sm font-bold text-navy-700 dark:text-white">{title}</h2>{href && <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">View all <MdArrowForward /></Link>}</div><div className="p-4 sm:p-5">{children}</div></Card>;
}

function Empty({ children }: { children: ReactNode }) { return <p className="py-5 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>; }

function Status({ value }: { value: string }) {
  const status = normalized(value);
  const positive = ['PAID', 'PROCESSED', 'APPROVED', 'PRESENT', 'COMPLETED', 'SUBMITTED'].includes(status);
  const pending = ['PENDING', 'LATE', 'SHORT_LEAVE', 'HALF_DAY', 'ON_LEAVE', 'IN_REVIEW'].includes(status);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${positive ? 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300' : pending ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300'}`}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()) || '—'}</span>;
}

function QuickLink({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return <Link href={href} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-navy-700 dark:bg-navy-800 dark:hover:border-brand-500/50 dark:hover:bg-navy-700"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-50 text-brand-600 dark:bg-navy-900 dark:text-brand-300">{icon}</span><span className="min-w-0"><span className="block text-sm font-semibold text-navy-700 dark:text-white">{title}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{detail}</span></span><MdArrowForward className="ml-auto shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500" /></Link>;
}

export default function RoleDashboard({ role }: { role: Role }) {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotificationRealtime();
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [attendanceDialog, setAttendanceDialog] = useState<'short-leave' | 'half-day' | null>(null);

  const load = useCallback(async () => {
    const issues: string[] = [];
    setLoading(true);
    setWarning('');
    const empty = <T,>() => [] as T[];

    if (role === 'employee') {
      const profile = await safe(getOne<EmployeeRecord>('/employees/profile'), null, issues);
      const attendancePromise = profile?.user?.id
        ? getList<AttendanceRecord>(`/attendance/employee/${profile.user.id}`)
        : Promise.resolve(empty<AttendanceRecord>());
      const [attendance, leaves, dsrs, payroll] = await Promise.all([
        safe(attendancePromise, empty<AttendanceRecord>(), issues),
        safe(profile ? getList<LeaveRecord>(`/leaves/employee/${profile.id}`) : Promise.resolve(empty<LeaveRecord>()), empty<LeaveRecord>(), issues),
        safe(getList<DsrRecord>('/dsr/my'), empty<DsrRecord>(), issues),
        safe(payrollApi.getMine(), empty<PayrollRecord>(), issues),
      ]);
      setData({ ...EMPTY_DATA, profile, attendance, leaves, dsrs, payroll });
    } else {
      const [employees, departments, attendance, leaves, dsrs, payroll] = await Promise.all([
        safe(getList<EmployeeRecord>('/employees'), empty<EmployeeRecord>(), issues),
        safe(getList<DepartmentRecord>('/departments'), empty<DepartmentRecord>(), issues),
        safe(getList<AttendanceRecord>('/attendance'), empty<AttendanceRecord>(), issues),
        safe(getList<LeaveRecord>('/leaves'), empty<LeaveRecord>(), issues),
        safe(getList<DsrRecord>('/dsr'), empty<DsrRecord>(), issues),
        safe(payrollApi.getAll(), empty<PayrollRecord>(), issues),
      ]);
      setData({ ...EMPTY_DATA, employees, departments, attendance, leaves, dsrs, payroll });
    }
    setWarning(issues.length ? 'Some live sections could not load. Refresh or open the related page to retry.' : '');
    setLoading(false);
  }, [role]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  const period = currentPeriod();
  const today = localDate();
  const name = user?.name?.trim().split(/\s+/)[0] || (role === 'employee' && data.profile ? fullName(data.profile).split(/\s+/)[0] : 'there');
  const currentPayroll = useMemo(() => data.payroll.filter((record) => record.month === period.month && record.year === period.year), [data.payroll, period.month, period.year]);
  const todayAttendance = data.attendance.filter((record) => record.date?.slice(0, 10) === today);
  const presentToday = todayAttendance.filter((record) => ['PRESENT', 'LATE', 'SHORT_LEAVE', 'HALF_DAY'].includes(normalized(record.status))).length;
  const employeeNameByUserId = useMemo(() => new Map<number, string>(
    data.employees.filter((employee) => employee.user?.id).map((employee) => [employee.user!.id!, fullName(employee)] as const),
  ), [data.employees]);
  const attendanceEntries = (status: 'SHORT_LEAVE' | 'HALF_DAY'): AttendanceExceptionEntry[] =>
    todayAttendance
      .filter((record) => normalized(record.status) === status)
      .map((record) => ({
        name: record.employee?.name || employeeNameByUserId.get(record.employeeId) || `Employee #${record.employeeId}`,
        checkIn: record.checkIn,
      }));
  const shortLeaveEntries = attendanceEntries('SHORT_LEAVE');
  const halfDayEntries = attendanceEntries('HALF_DAY');
  const activeAttendanceEntries = attendanceDialog === 'short-leave' ? shortLeaveEntries : halfDayEntries;
  const pendingLeaves = data.leaves.filter((record) => normalized(record.status) === 'PENDING');
  const pendingDsrs = data.dsrs.filter((record) => ['PENDING', 'SUBMITTED'].includes(normalized(record.status)));
  const paidPayroll = currentPayroll.filter((record) => normalized(record.status) === 'PAID');
  const pendingPayroll = currentPayroll.filter((record) => normalized(record.status) === 'PENDING');
  const totalNetPay = currentPayroll.reduce((sum, record) => sum + Number(record.netSalary || 0), 0);
  const totalBonus = currentPayroll.reduce((sum, record) => sum + Number(record.bonus || 0), 0);
  const deptTotals = useMemo(() => {
    const totals = new Map<string, number>();
    data.employees.forEach((employee) => { const department = departmentName(employee.department); totals.set(department, (totals.get(department) ?? 0) + 1); });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.employees]);
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(period.year, period.month - 1, 1));
  const roleNotifications = notifications;

  return <div className="mt-4 flex flex-col gap-5 pb-4 sm:mt-5 sm:gap-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-500 dark:text-brand-300">{dateLabel()}</p><h1 className="text-2xl font-bold tracking-tight text-navy-700 dark:text-white md:text-3xl">{role === 'employee' ? `Good day, ${name}` : `Welcome back, ${name}`}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{role === 'employee' ? [data.profile?.designation, data.profile?.employeeCode ? `ID ${data.profile.employeeCode}` : null, departmentName(data.profile?.department)].filter(Boolean).join(' · ') || 'Your attendance, leave and pay at a glance.' : role === 'hr' ? 'People operations and actions that need your attention.' : 'Company-wide workforce and payroll health.'}</p></div>
      <div className="flex flex-wrap items-center gap-2">{role === 'employee' && <Link href="/employee/leaves" className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-xs font-bold text-white hover:bg-brand-600">Apply Leave</Link>}<span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-navy-700 shadow-sm dark:bg-navy-800 dark:text-gray-200">{role === 'employee' ? departmentName(data.profile?.department) : monthLabel}</span><button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} aria-label="Refresh dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-navy-700 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"><MdRefresh className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
    </header>
    {warning && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">{warning}</div>}

    {role === 'employee' && <EmployeeDashboardSections loading={loading} profile={data.profile} attendance={data.attendance} leaves={data.leaves} dsrs={data.dsrs} payroll={data.payroll} notifications={roleNotifications} unreadCount={unreadCount} />}

    {(role === 'hr' || role === 'admin') && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Metric label="Active employees" value={loading ? '—' : data.employees.filter((employee) => employee.status !== false).length} note={`${data.departments.filter((department) => department.status !== false).length} active departments`} icon={<MdPeopleAlt className="h-5 w-5" />} />
        {role === 'admin' ? <>
          <Metric label="Short leave today" value={loading ? '—' : shortLeaveEntries.length} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} onClick={() => setAttendanceDialog('short-leave')} />
          <Metric label="Half-day today" value={loading ? '—' : halfDayEntries.length} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} tone={halfDayEntries.length ? 'text-amber-600 dark:text-amber-300' : undefined} onClick={() => setAttendanceDialog('half-day')} />
          <Metric label="Company net payroll" value={loading ? '—' : formatCurrency(totalNetPay)} note={monthLabel} icon={<MdCurrencyRupee className="h-5 w-5" />} />
          <Metric label="Payroll pending" value={loading ? '—' : pendingPayroll.length} note={`${paidPayroll.length} paid this month`} icon={<MdCheckCircle className="h-5 w-5" />} tone={pendingPayroll.length ? 'text-amber-600 dark:text-amber-300' : undefined} />
          <Metric label="Open reviews" value={loading ? '—' : pendingLeaves.length + pendingDsrs.length} note={`${pendingLeaves.length} leave · ${pendingDsrs.length} DSR`} icon={<MdWarningAmber className="h-5 w-5" />} tone={pendingLeaves.length + pendingDsrs.length ? 'text-amber-600 dark:text-amber-300' : undefined} />
        </> : <>
          <Metric label="Present today" value={loading ? '—' : presentToday} note={`${todayAttendance.filter((record) => normalized(record.status) === 'LATE').length} late check-ins`} icon={<MdAccessTime className="h-5 w-5" />} />
          <Metric label="Short leave today" value={loading ? '—' : shortLeaveEntries.length} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} onClick={() => setAttendanceDialog('short-leave')} />
          <Metric label="Half-day today" value={loading ? '—' : halfDayEntries.length} note="Click to view employee names" icon={<MdAccessTime className="h-5 w-5" />} tone={halfDayEntries.length ? 'text-amber-600 dark:text-amber-300' : undefined} onClick={() => setAttendanceDialog('half-day')} />
          <Metric label="Leave requests to review" value={loading ? '—' : pendingLeaves.length} note="Pending company leave requests" icon={<MdCalendarMonth className="h-5 w-5" />} tone={pendingLeaves.length ? 'text-amber-600 dark:text-amber-300' : undefined} />
          <Metric label="Payroll pending" value={loading ? '—' : pendingPayroll.length} note={`${monthLabel} · ${paidPayroll.length} paid`} icon={<MdCurrencyRupee className="h-5 w-5" />} tone={pendingPayroll.length ? 'text-amber-600 dark:text-amber-300' : undefined} />
        </>}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Section title={role === 'admin' ? 'Company payroll overview' : 'Payroll processing overview'} href={`/${role}/payroll`}><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Net payroll · {monthLabel}</p><p className="mt-2 text-xl font-bold text-navy-700 dark:text-white">{loading ? '—' : formatCurrency(totalNetPay)}</p></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Bonus included</p><p className="mt-2 text-xl font-bold text-green-600 dark:text-green-400">{loading ? '—' : formatCurrency(totalBonus)}</p></div><div className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Records ready</p><p className="mt-2 text-xl font-bold text-navy-700 dark:text-white">{loading ? '—' : `${paidPayroll.length} paid / ${currentPayroll.length} total`}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/${role}/payroll`} className="inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600">Open payroll</Link><Link href={`/${role}/payroll`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-navy-700 dark:border-navy-600 dark:text-white"><MdHistory /> Increment history</Link></div></Section>
        <Section title="Department distribution" href={role === 'admin' ? '/admin/departments' : '/hr/departments'}>{deptTotals.length ? <div className="space-y-4">{deptTotals.map(([department, count]) => <div key={department}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-navy-700 dark:text-gray-200">{department}</span><span className="text-gray-500 dark:text-gray-400">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, Math.round((count / Math.max(data.employees.length, 1)) * 100))}%` }} /></div></div>)}</div> : <Empty>{loading ? 'Loading department data…' : 'No department data available.'}</Empty>}</Section>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Needs attention" href={role === 'admin' ? '/admin/leaves' : '/hr/leaves'}><div className="space-y-3">{pendingLeaves.slice(0, 4).map((leave) => <div key={leave.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900"><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{fullName(leave.employee)}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{leave.leaveType ?? 'Leave'} · {shortDate(leave.startDate)}{leave.endDate && leave.endDate !== leave.startDate ? ` – ${shortDate(leave.endDate)}` : ''}</p></div><Status value={leave.status} /></div>)}{pendingDsrs.slice(0, 3).map((dsr) => <div key={`dsr-${dsr.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900"><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{dsr.title || 'Daily status report'}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">DSR · {shortDate(dsr.date)}</p></div><Status value={dsr.status} /></div>)}{!loading && pendingLeaves.length === 0 && pendingDsrs.length === 0 && <Empty>No pending leave or DSR reviews.</Empty>}</div></Section>
        <Section title="Today’s attendance" href={`/${role}/attendance`}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/15"><p className="text-xs text-green-700 dark:text-green-300">Present</p><p className="mt-1 text-xl font-bold text-green-800 dark:text-green-200">{loading ? '—' : todayAttendance.filter((item) => ['PRESENT', 'LATE', 'SHORT_LEAVE', 'HALF_DAY'].includes(normalized(item.status))).length}</p></div><div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/15"><p className="text-xs text-amber-700 dark:text-amber-300">Short leave</p><p className="mt-1 text-xl font-bold text-amber-800 dark:text-amber-200">{loading ? '—' : shortLeaveEntries.length}</p></div><div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/15"><p className="text-xs text-indigo-700 dark:text-indigo-300">Half day</p><p className="mt-1 text-xl font-bold text-indigo-800 dark:text-indigo-200">{loading ? '—' : halfDayEntries.length}</p></div><div className="rounded-xl bg-red-50 p-3 dark:bg-red-900/15"><p className="text-xs text-red-700 dark:text-red-300">Absent</p><p className="mt-1 text-xl font-bold text-red-800 dark:text-red-200">{loading ? '—' : todayAttendance.filter((item) => normalized(item.status) === 'ABSENT').length}</p></div><div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-900/15"><p className="text-xs text-sky-700 dark:text-sky-300">On leave</p><p className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-200">{loading ? '—' : todayAttendance.filter((item) => normalized(item.status) === 'ON_LEAVE').length}</p></div></div><p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Counts use attendance records for {dateLabel(new Date()).split(',')[0]}.</p></Section>
      </div>
      <Section title="Recent notifications and celebrations" href={`/${role}/notifications`}><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{roleNotifications.slice(0, 4).map((notification) => <div key={notification.id} className="flex gap-3 rounded-xl bg-gray-50 p-3 dark:bg-navy-900"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" /><div className="min-w-0"><p className="text-sm font-semibold text-navy-700 dark:text-white">{notification.title}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{notification.message}</p></div></div>)}{roleNotifications.length === 0 && <Empty>No recent notifications or celebrations.</Empty>}</div></Section>
      <section><h2 className="mb-3 text-sm font-bold text-navy-700 dark:text-white">Quick access</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><QuickLink href={`/${role}/employees`} icon={<MdPeopleAlt className="h-5 w-5" />} title="Employees" detail="Profiles and employee records" /><QuickLink href={`/${role}/departments`} icon={<MdGroups className="h-5 w-5" />} title="Departments" detail="Department directory" /><QuickLink href={`/${role}/payroll`} icon={<MdCurrencyRupee className="h-5 w-5" />} title="Payroll" detail="Monthly payroll and increments" /><QuickLink href={`/${role}/leaves`} icon={<MdCalendarMonth className="h-5 w-5" />} title="Leave requests" detail={`${pendingLeaves.length} pending review`} /><QuickLink href={`/${role}/dsr`} icon={<MdTaskAlt className="h-5 w-5" />} title="DSR" detail={`${pendingDsrs.length} pending review`} /><QuickLink href={`/${role}/notifications`} icon={<MdNotifications className="h-5 w-5" />} title="Notifications" detail={`${unreadCount} unread updates`} />{role === 'admin' && <><QuickLink href="/admin/users" icon={<MdGroups className="h-5 w-5" />} title="User access" detail="Manage accounts and roles" /><QuickLink href="/admin/settings" icon={<MdHistory className="h-5 w-5" />} title="Settings" detail="Company configuration" /></>}</div></section>
    </>}

    {attendanceDialog && (
      <AttendanceExceptionDialog
        title={attendanceDialog === 'short-leave' ? 'Short leave employees today' : 'Half-day employees today'}
        entries={activeAttendanceEntries}
        onClose={() => setAttendanceDialog(null)}
      />
    )}
  </div>;
}
