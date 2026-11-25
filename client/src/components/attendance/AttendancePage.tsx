'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MdAccessTime,
  MdCalendarMonth,
  MdCheckCircle,
  MdCoffee,
  MdClose,
  MdDownload,
  MdGroup,
  MdPersonOff,
  MdPendingActions,
  MdRefresh,
  MdSearch,
  MdQrCode2,
  MdFace,
} from 'react-icons/md';
import { apiFetch } from '@/lib/api';
import AttendanceQrTools from './AttendanceQrTools';
import AttendanceMonthlyExport from './AttendanceMonthlyExport';
import FaceAttendanceTools from './FaceAttendanceTools';

type Role = 'admin' | 'hr' | 'manager' | 'employee';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'SHORT_LEAVE' | 'ON_LEAVE';
interface User {
  id: number;
  name?: string;
  email?: string;
}
interface Employee {
  id: number;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  user?: User;
}
interface Attendance {
  id: number;
  employeeId: number;
  employee?: User;
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  breakMinutes?: number;
  workingHours?: number | string | null;
  remarks?: string | null;
  shiftId?: number | null;
  shiftNameSnapshot?: string | null;
  shiftStartSnapshot?: string | null;
  shiftEndSnapshot?: string | null;
  shiftWorkHoursSnapshot?: number | string | null;
  overtimeApprovalStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  overtimeRequestedAt?: string | null;
}
interface DisplayRow {
  key: string;
  name: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  breakMinutes: number | null;
  checkOut: string | null;
  workingHours: number | string | null;
  remarks: string | null;
  shiftName: string | null;
}

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT:
    'bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-300 ring-green-600/20 ',
  LATE: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-600/20 ',
  SHORT_LEAVE: 'bg-orange-50 dark:bg-orange-400/10 text-orange-700 dark:text-orange-300 ring-orange-600/20 ',
  ABSENT:
    'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-600/20 ',
  HALF_DAY:
    'bg-indigo-50 dark:bg-navy-900/60 text-indigo-700 dark:text-indigo-300 ring-indigo-600/20 ',
  ON_LEAVE:
    'bg-sky-50 text-sky-700 ring-sky-600/20 ',
};

function unwrap<T>(body: any): T {
  return (body?.data ?? body) as T;
}
async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body?.message ?? body?.error ?? 'The attendance request failed.';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return unwrap<T>(body);
}
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateLabel(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}
function timeLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
}
function employeeName(employee: Employee) {
  return (
    `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() ||
    employee.user?.name ||
    employee.user?.email ||
    `Employee #${employee.id}`
  );
}

export default function AttendancePage({ role, personal = false }: { role: Role; personal?: boolean }) {
  // Attendance is clocked in only on the "My Attendance" page (and the employee
  // attendance page). The team attendance page is a read-only roster.
  const canSelfClock = personal || role === 'employee';
  // HR and Admin see the whole company; a Manager only sees the people under them.
  // The personal ("My Attendance") view never lists anyone else.
  const canViewTeam = !personal && (role === 'admin' || role === 'hr' || role === 'manager');
  const seesWholeCompany = role === 'admin' || role === 'hr';
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myRows, setMyRows] = useState<Attendance[]>([]);
  const [dayRecords, setDayRecords] = useState<Attendance[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myShift, setMyShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeClockMethod, setActiveClockMethod] = useState<'face' | 'qr' | null>(null);
  const [reviewingOvertimeId, setReviewingOvertimeId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let selfRows: Attendance[] = [];
      if (canSelfClock) {
        const profile = await read<Employee>(
          await apiFetch('/employees/profile'),
        );
        if (!profile.user?.id)
          throw new Error(
            'Your profile is missing its linked user ID. Please contact HR.',
          );
        setMyUserId(profile.user.id);
        const assignedShift = await read<any>(await apiFetch(`/shifts/my-assignment?date=${localDate()}`));
        const data = await read<Attendance[] | { items?: Attendance[] }>(
          await apiFetch(`/attendance/employee/${profile.user.id}`),
        );
        selfRows = Array.isArray(data) ? data : data.items ?? [];
        const openRecord = selfRows.find(row => row.checkIn && !row.checkOut);
        setMyShift(openRecord?.shiftNameSnapshot ? { shift: { name: openRecord.shiftNameSnapshot, startTime: openRecord.shiftStartSnapshot, endTime: openRecord.shiftEndSnapshot } } : assignedShift);
      }
      setMyRows(selfRows);

      if (canViewTeam) {
        const [peopleResponse, dayResponse, overtimeResponse] = await Promise.all([
          apiFetch(seesWholeCompany ? '/employees' : '/employees/team'),
          apiFetch(`/attendance/date/${localDate()}`),
          apiFetch('/attendance/overtime-requests'),
        ]);
        const people = await read<Employee[] | { items?: Employee[] }>(
          peopleResponse,
        );
        setEmployees(Array.isArray(people) ? people : people.items ?? []);
        const day = await read<Attendance[] | { items?: Attendance[] }>(
          dayResponse,
        );
        setDayRecords(Array.isArray(day) ? day : day.items ?? []);
        const requests = await read<Attendance[] | { items?: Attendance[] }>(
          overtimeResponse,
        );
        setOvertimeRequests(Array.isArray(requests) ? requests : requests.items ?? []);
      } else {
        setOvertimeRequests([]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load attendance.',
      );
    } finally {
      setLoading(false);
    }
  }, [canSelfClock, canViewTeam, seesWholeCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live work timer: runs after check-in, pauses during an active break, and
  // freezes permanently once the employee checks out.
  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = myRows.find((row) => row.checkIn && !row.checkOut) ?? myRows.find((row) => row.date.slice(0, 10) === localDate());
  const isOnBreak = Boolean(todayRecord?.breakStart && !todayRecord?.breakEnd);
  const timerEnd = todayRecord?.checkOut
    ? new Date(todayRecord.checkOut).getTime()
    : isOnBreak && todayRecord?.breakStart
      ? new Date(todayRecord.breakStart).getTime()
      : liveNow;
  const timerStart = todayRecord?.checkIn ? new Date(todayRecord.checkIn).getTime() : null;
  const breakMs = todayRecord?.breakMinutes ? Number(todayRecord.breakMinutes) * 60_000 : 0;
  const elapsedMs = timerStart ? Math.max(0, timerEnd - timerStart - breakMs) : 0;
  const timerHours = Math.floor(elapsedMs / 3_600_000);
  const timerMinutes = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const timerSeconds = Math.floor((elapsedMs % 60_000) / 1000);
  const liveDuration = `${String(timerHours).padStart(2, '0')}:${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;
  const overtimeStatus = todayRecord?.overtimeApprovalStatus ?? 'NONE';
  const canRequestOvertime = Boolean(
    role === 'employee' &&
    todayRecord?.checkIn &&
    !todayRecord.checkOut &&
    overtimeStatus === 'NONE' &&
    elapsedMs >= 8 * 60 * 60 * 1000,
  );

  useEffect(() => {
    if (
      !canViewTeam &&
      !(canSelfClock && todayRecord?.checkIn && !todayRecord.checkOut)
    ) {
      return;
    }

    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [canSelfClock, canViewTeam, load, todayRecord?.checkIn, todayRecord?.checkOut]);

  const stats = useMemo(
    () => ({
      present: myRows.filter(
        (row) => row.status === 'PRESENT' || row.status === 'LATE' || row.status === 'SHORT_LEAVE',
      ).length,
      hours: myRows.reduce((sum, row) => sum + Number(row.workingHours ?? 0), 0),
      days: myRows.length,
    }),
    [myRows],
  );

  // HR/Manager view: every person in scope with today's present/absent state.
  const teamStats = useMemo(() => {
    const byUser = new Map<number, Attendance>();
    dayRecords.forEach((record) => byUser.set(record.employeeId, record));
    let present = 0;
    let absent = 0;
    employees.forEach((employee) => {
      if (!employee.user?.id) return;
      const record = byUser.get(employee.user.id);
      if (
        record &&
        (record.status === 'PRESENT' ||
          record.status === 'LATE' ||
        record.status === 'SHORT_LEAVE' ||
          record.status === 'HALF_DAY')
      ) {
        present += 1;
      } else {
        absent += 1;
      }
    });
    return { present, absent, total: present + absent };
  }, [dayRecords, employees]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (canViewTeam) {
      const today = localDate();
      const byUser = new Map<number, Attendance>();
      dayRecords.forEach((record) => byUser.set(record.employeeId, record));
      return employees
        .filter((employee) => employee.user?.id)
        .map((employee) => {
          const record = byUser.get(employee.user!.id);
          return {
            key: `employee-${employee.id}`,
            name: employeeName(employee),
            date: today,
            status: record?.status ?? 'ABSENT',
            checkIn: record?.checkIn ?? null,
            breakStart: record?.breakStart ?? null,
            breakEnd: record?.breakEnd ?? null,
            breakMinutes: record?.breakMinutes ?? null,
            checkOut: record?.checkOut ?? null,
            workingHours: record?.workingHours ?? null,
            remarks: record?.remarks ?? null,
            shiftName: record?.shiftNameSnapshot ?? null,
          };
        })
        .filter(
          (row) =>
            !search ||
            `${row.name} ${row.status}`.toLowerCase().includes(search.toLowerCase()),
        );
    }
    return myRows
      .filter((row) => !dateFilter || row.date.slice(0, 10) === dateFilter)
      .map((row) => ({
        key: `record-${row.id}`,
        name: row.employee?.name || row.employee?.email || `Employee #${row.employeeId}`,
        date: row.date,
        status: row.status,
        checkIn: row.checkIn ?? null,
        breakStart: row.breakStart ?? null,
        breakEnd: row.breakEnd ?? null,
        breakMinutes: row.breakMinutes ?? null,
        checkOut: row.checkOut ?? null,
        workingHours: row.workingHours ?? null,
        remarks: row.remarks ?? null,
        shiftName: row.shiftNameSnapshot ?? null,
      }));
  }, [canViewTeam, dateFilter, dayRecords, employees, myRows, search]);

  const markTime = async (
    action: 'check-out' | 'break-start' | 'break-end',
  ) => {
    if (!myUserId) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await read(
        await apiFetch(`/attendance/${action}/${myUserId}`, { method: 'POST' }),
      );
      const messages = {
        'check-out': 'You are checked out. Your hours have been recorded.',
        'break-start': 'Your break has started. Enjoy your break!',
        'break-end': 'Your break has ended. Welcome back!',
      };
      setNotice(messages[action]);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update your attendance.',
      );
    } finally {
      setBusy(false);
    }
  };

  const requestOvertime = async () => {
    if (!todayRecord) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await read(
        await apiFetch(`/attendance/${todayRecord.id}/overtime-request`, {
          method: 'POST',
        }),
      );
      setNotice('Overtime approval requested. HR, Admin, or your Manager can review it.');
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not request overtime approval.',
      );
    } finally {
      setBusy(false);
    }
  };

  const reviewOvertime = async (
    attendanceId: number,
    decision: 'approve' | 'reject',
  ) => {
    setReviewingOvertimeId(attendanceId);
    setError('');
    setNotice('');
    try {
      await read(
        await apiFetch(
          `/attendance/overtime-requests/${attendanceId}/${decision}`,
          { method: 'POST' },
        ),
      );
      setNotice(
        decision === 'approve'
          ? 'Overtime approved. The employee can continue until checkout.'
          : 'Overtime declined. Attendance will end automatically at the 9-hour limit unless the employee checks out earlier.',
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not review the overtime request.',
      );
    } finally {
      setReviewingOvertimeId(null);
    }
  };

  const exportCsv = () => {
    const escape = (value: unknown) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      [
        'Employee',
        'Date',
        'Status',
        'Shift',
        'Check in',
        'Break started',
        'Break ended',
        'Break minutes',
        'Check out',
        'Hours',
        'Notes',
      ],
      ...displayRows.map((row) => [
        row.name,
        row.date.slice(0, 10),
        row.status,
        row.shiftName ?? '',
        row.checkIn ?? '',
        row.breakStart ?? '',
        row.breakEnd ?? '',
        row.breakMinutes ?? 0,
        row.checkOut ?? '',
        row.workingHours ?? '',
        row.remarks ?? '',
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(escape).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${localDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-1 pb-10">
      <header className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-4 text-slate-900 dark:text-white shadow-sm sm:p-6">
        <div className={`relative grid gap-5 ${canSelfClock ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]' : ''}`}>
          <section className="flex min-h-[340px] flex-col justify-between rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-gray-400">
                  {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {canSelfClock ? 'Ready to clock in?' : 'Attendance overview'}
                </h1>
                <p className="mt-2 max-w-lg text-sm text-slate-600 dark:text-gray-300">
                  {canSelfClock ? 'Your work timer updates live, pauses during breaks, and stops when you check out.' : 'See who is present today and who is not.'}
                </p>
                {canSelfClock && <div className="mt-4 max-w-sm rounded-xl border border-indigo-100 dark:border-indigo-900 bg-white dark:bg-navy-800 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Today’s assigned shift</p><p className="mt-1 font-semibold text-indigo-700 dark:text-indigo-300">{myShift?.shift?.name ?? 'No shift assigned'}</p><p className="text-xs text-slate-500 dark:text-gray-400">{myShift?.shift ? `${String(myShift.shift.startTime).slice(0,5)}–${String(myShift.shift.endTime).slice(0,5)} · ${myShift.shift.graceMinutes} min grace` : 'Please contact HR to get a shift assigned.'}</p></div>}
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${isOnBreak ? 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200' : 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300 ring-blue-200'}`}>
                <MdAccessTime className="text-2xl" />
              </div>
            </div>
            {canSelfClock ? (
              <>
                <div className="my-8">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-gray-400">Net working time</p>
                  <div className="font-mono text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">{liveDuration}</div>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${todayRecord?.checkOut ? 'bg-slate-400' : isOnBreak ? 'bg-amber-500' : todayRecord?.checkIn ? 'animate-pulse bg-green-500' : 'bg-slate-300'}`} />
                    <span className={todayRecord?.checkOut ? 'text-slate-500 dark:text-gray-400' : isOnBreak ? 'text-amber-700 dark:text-amber-300' : todayRecord?.checkIn ? 'text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-gray-400'}>
                      {todayRecord?.checkOut ? 'Workday completed' : isOnBreak ? 'Break in progress · timer paused' : todayRecord?.checkIn ? 'Clocked in · timer running' : 'Not clocked in yet'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {!todayRecord?.checkIn && <div className="w-full rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-400/10 p-4 text-sm text-blue-900 dark:text-blue-200"><strong>{myShift ? 'Attendance verification required' : 'No shift assigned'}</strong><p className="mt-1 text-slate-600 dark:text-gray-300">{myShift ? 'Select Face scan or QR code below. Attendance starts only after successful verification.' : 'Please contact HR to get your shift assigned before clocking in.'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!myShift} onClick={() => setActiveClockMethod('face')} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><MdFace /> Face scan</button><button type="button" disabled={!myShift} onClick={() => setActiveClockMethod('qr')} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-navy-800 px-4 py-2 font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 disabled:opacity-50"><MdQrCode2 /> QR code</button></div></div>}
                  {todayRecord?.checkIn && !todayRecord?.checkOut && !isOnBreak && !todayRecord?.breakEnd && <button disabled={busy} onClick={() => void markTime('break-start')} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200 transition hover:bg-amber-100 disabled:opacity-50"><MdCoffee className="text-lg" />{busy ? 'Please wait…' : 'Start break'}</button>}
                  {isOnBreak && <button disabled={busy} onClick={() => void markTime('break-end')} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"><MdAccessTime className="text-lg" />{busy ? 'Please wait…' : 'End break & resume'}</button>}
                  {todayRecord?.checkIn && !todayRecord?.checkOut && <button disabled={busy || isOnBreak} onClick={() => void markTime('check-out')} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-700 dark:text-red-300 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40">End workday</button>}
                  {todayRecord?.checkOut && <div className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-4 text-sm font-semibold text-slate-600 dark:text-gray-300"><MdCheckCircle className="mr-2 text-green-600" />Checked out at {timeLabel(todayRecord.checkOut)}</div>}
                </div>
              </>
            ) : (
              <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-sm text-slate-500 dark:text-gray-400">{seesWholeCompany ? 'Employees' : 'Team members'}</p><p className="mt-1 text-4xl font-bold">{teamStats.total}</p></div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-4 py-3 text-sm text-slate-600 dark:text-gray-300">Present today: {teamStats.present} · Absent: {teamStats.absent}</div>
              </div>
            )}
          </section>
          {canSelfClock && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <section className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Clock-in methods</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Choose a secure way to record attendance</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveClockMethod('face')}
                  disabled={!myShift || Boolean(todayRecord?.checkIn)}
                  className={`rounded-xl border p-4 text-center transition ${
                    activeClockMethod === 'face'
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-400/10 ring-1 ring-blue-200'
                      : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-blue-300 hover:bg-blue-50/50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300">
                    <MdFace className="text-xl" />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    Clock in with Face
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">
                    Open camera
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveClockMethod('qr')}
                  disabled={!myShift || Boolean(todayRecord?.checkIn)}
                  className={`rounded-xl border p-4 text-center transition ${
                    activeClockMethod === 'qr'
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-400/10 ring-1 ring-blue-200'
                      : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 hover:border-blue-300 hover:bg-blue-50/50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-gray-200">
                    <MdQrCode2 className="text-xl" />
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    Clock in with QR
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">
                    Open scanner
                  </p>
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-gray-400">Choose Face scan or QR code below. Check-in is recorded only after the server confirms successful verification.</p>
            </section>
            <section className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Today at a glance</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-400/10 p-3"><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{todayRecord?.checkIn ? '✓' : '—'}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">Clock in</p><p className="mt-1 text-xs font-medium text-slate-700 dark:text-gray-200">{timeLabel(todayRecord?.checkIn)}</p></div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 p-3"><p className="text-xl font-bold text-amber-700 dark:text-amber-300">{todayRecord?.breakMinutes ?? 0}<span className="text-xs">m</span></p><p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">Break taken</p><p className="mt-1 text-xs font-medium text-slate-700 dark:text-gray-200">{isOnBreak ? 'In progress' : todayRecord?.breakEnd ? 'Completed' : 'Not started'}</p></div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-400/10 p-3"><p className="text-xl font-bold text-blue-700 dark:text-blue-300">{todayRecord?.checkOut ? '✓' : '—'}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">Clock out</p><p className="mt-1 text-xs font-medium text-slate-700 dark:text-gray-200">{timeLabel(todayRecord?.checkOut)}</p></div>
              </div>
            </section>
          </div>
          )}
        </div>
      </header>

      {canSelfClock && activeClockMethod && !todayRecord?.checkIn && <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/70 dark:bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setActiveClockMethod(null); }}><section role="dialog" aria-modal="true" aria-labelledby="attendance-scan-title" className="my-auto w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-4 text-slate-900 dark:text-white shadow-2xl sm:p-6"><div className="mb-3 flex items-center justify-between gap-4"><div><h2 id="attendance-scan-title" className="text-lg font-bold">{activeClockMethod === 'face' ? 'Clock in with Face Scan' : 'Clock in with QR Code'}</h2><p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{activeClockMethod === 'qr' ? 'Camera opens here. If this device has no camera, upload a QR image instead. Attendance is recorded only after verification.' : 'Camera opens here. Attendance is recorded only after verification.'}</p></div><button type="button" aria-label="Close attendance scanner" onClick={() => setActiveClockMethod(null)} className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50">Close</button></div>{activeClockMethod === 'face' ? <FaceAttendanceTools employees={employees} canManage={false} autoStart onSuccess={load} /> : <AttendanceQrTools employees={employees} canManage={false} autoStart onSuccess={load} />}</section></div>}

      {(error || notice) && (
        <div
          role="status"
          className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-sm ${
            error
              ? 'border-red-200 bg-red-50 dark:bg-red-400/10 text-red-800 dark:text-red-200 '
              : 'border-green-200 bg-green-50 dark:bg-green-400/10 text-green-800 dark:text-green-200 '
          }`}
        >
          <span>{error || notice}</span>
          {error && (
            <button
              onClick={() => void load()}
              className="shrink-0 font-semibold underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {canSelfClock && role === 'employee' && todayRecord?.checkIn && (
        <section
          className={`rounded-2xl border p-4 ${
            overtimeStatus === 'APPROVED'
              ? 'border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-900/20'
              : overtimeStatus === 'PENDING'
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-900/20'
                : overtimeStatus === 'REJECTED'
                  ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-900/20'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-900/20'
          }`}
        >
          {overtimeStatus === 'APPROVED' && !todayRecord.checkOut ? (
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Overtime approved. You may continue working and check out when you finish.
            </p>
          ) : overtimeStatus === 'PENDING' && !todayRecord.checkOut ? (
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Overtime request is waiting for HR, Admin, or your Manager. Without approval, attendance will end automatically at 9 net working hours.
            </p>
          ) : overtimeStatus === 'REJECTED' && !todayRecord.checkOut ? (
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Overtime was declined. You can finish by 9 net working hours; attendance will then check out automatically.
            </p>
          ) : overtimeStatus === 'REJECTED' ? (
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Overtime was declined and your attendance has ended.
            </p>
          ) : canRequestOvertime ? (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100">
                  8 net working hours completed
                </h2>
                <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                  Request approval to continue. If it is not approved by 9 net working hours, attendance will check out automatically.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void requestOvertime()}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <MdPendingActions />
                {busy ? 'Sending…' : 'Request overtime approval'}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {canViewTeam && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Overtime approval requests</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                Review requests from {seesWholeCompany ? 'employees' : 'your team'}.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
              {overtimeRequests.length} pending
            </span>
          </div>
          {overtimeRequests.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-navy-900 dark:text-gray-400">
              No pending overtime requests.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-navy-700">
              {overtimeRequests.map((request) => (
                <li key={request.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {request.employee?.name || request.employee?.email || `Employee #${request.employeeId}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                      {dateLabel(request.date)} · Requested {request.overtimeRequestedAt ? timeLabel(request.overtimeRequestedAt) : 'today'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={reviewingOvertimeId !== null}
                      onClick={() => void reviewOvertime(request.id, 'approve')}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <MdCheckCircle />
                      {reviewingOvertimeId === request.id ? 'Saving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingOvertimeId !== null}
                      onClick={() => void reviewOvertime(request.id, 'reject')}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <MdClose />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {(canViewTeam
          ? [
              {
                label: 'Present today',
                value: teamStats.present,
                icon: MdCheckCircle,
                tone: 'text-green-600 bg-green-50 dark:bg-green-400/10 ',
              },
              {
                label: 'Absent today',
                value: teamStats.absent,
                icon: MdPersonOff,
                tone: 'text-red-600 bg-red-50 dark:bg-red-400/10 ',
              },
              {
                label: seesWholeCompany ? 'Total employees' : 'Team members',
                value: teamStats.total,
                icon: MdGroup,
                tone: 'text-blue-600 bg-blue-50 dark:bg-blue-400/10 ',
              },
            ]
          : [
              {
                label: 'Days recorded',
                value: stats.days,
                icon: MdCalendarMonth,
                tone: 'text-blue-600 bg-blue-50 dark:bg-blue-400/10 ',
              },
              {
                label: 'Present days',
                value: stats.present,
                icon: MdCheckCircle,
                tone: 'text-green-600 bg-green-50 dark:bg-green-400/10 ',
              },
              {
                label: 'Hours recorded',
                value: stats.hours.toFixed(1),
                icon: MdAccessTime,
                tone: 'text-violet-600 bg-violet-50 ',
              },
            ]
        ).map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-gray-100 dark:border-navy-700 bg-white dark:bg-navy-800 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md "
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-11 w-11 place-items-center rounded-xl text-xl ${item.tone}`}
              >
                <item.icon />
              </span>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 ">
                  {item.label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-navy-700 dark:text-white ">
                  {item.value}
                </p>
              </div>
            </div>
          </article>
        ))}
      </section>

      {seesWholeCompany && <AttendanceMonthlyExport />}

      <section className="overflow-hidden rounded-2xl border border-gray-100 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-sm ">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-100 dark:border-navy-700 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-navy-700 dark:text-white ">
              {canViewTeam ? 'Team attendance' : 'Attendance history'}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 ">
              {canViewTeam
                ? seesWholeCompany
                  ? 'Today: who is present and who is absent.'
                  : 'Today: who from your team is present and who is absent.'
                : 'Your recent attendance records.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!canViewTeam && (
              <label className="relative">
                <span className="sr-only">Filter by date</span>
                <MdCalendarMonth className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  aria-label="Filter by date"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-10 rounded-xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 pl-9 pr-3 text-sm text-navy-700 dark:text-white outline-none focus:border-indigo-500 "
                />
              </label>
            )}
            {canViewTeam && (
              <label className="relative">
                <span className="sr-only">Search attendance</span>
                <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people…"
                  className="h-10 w-44 rounded-xl border border-gray-200 dark:border-navy-600 bg-white dark:bg-navy-800 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 "
                />
              </label>
            )}
            {canViewTeam && (
              <button
                onClick={exportCsv}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 dark:border-navy-600 px-3 text-sm font-medium text-navy-700 dark:text-white transition hover:bg-gray-50 dark:hover:bg-navy-700 "
              >
                <MdDownload />
                Export
              </button>
            )}
            <button
              aria-label="Refresh attendance"
              onClick={() => void load()}
              className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 dark:border-navy-600 text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-navy-700 "
            >
              <MdRefresh className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 dark:bg-navy-900 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 ">
              <tr>
                {canViewTeam && <th className="px-5 py-3">Employee</th>}
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Shift</th>
                <th className="px-5 py-3">Check in</th>
                <th className="px-5 py-3">Break started</th>
                <th className="px-5 py-3">Break ended</th>
                <th className="px-5 py-3">Break (min)</th>
                <th className="px-5 py-3">Check out</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700 ">
              {loading ? (
                <tr>
                  <td
                    colSpan={canViewTeam ? 11 : 10}
                    className="px-5 py-14 text-center text-gray-500 dark:text-gray-400"
                  >
                    Loading attendance…
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canViewTeam ? 11 : 10}
                    className="px-5 py-14 text-center"
                  >
                    <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gray-50 dark:bg-navy-900 text-2xl text-gray-400 ">
                      <MdCalendarMonth />
                    </span>
                    <p className="font-semibold text-navy-700 dark:text-white ">
                      No attendance records found
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {canViewTeam
                        ? 'No people to show right now.'
                        : dateFilter
                          ? 'Try changing the date filter.'
                          : 'Your check-in will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr
                    key={row.key}
                    className="transition hover:bg-gray-50/70 dark:hover:bg-navy-700/40 "
                  >
                    {canViewTeam && (
                      <td className="px-5 py-4 font-medium text-navy-700 dark:text-white ">
                        {row.name}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-5 py-4 text-navy-700 dark:text-white ">
                      {dateLabel(row.date)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          statusStyles[row.status]
                        }`}
                      >
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{row.shiftName ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {timeLabel(row.checkIn)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {timeLabel(row.breakStart)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {timeLabel(row.breakEnd)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {row.breakStart
                        ? `${
                            row.breakMinutes ??
                            (row.breakEnd ? '—' : 'In progress')
                          }`
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {timeLabel(row.checkOut)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300 ">
                      {row.workingHours == null
                        ? '—'
                        : `${Number(row.workingHours).toFixed(2)} h`}
                    </td>
                    <td
                      className="max-w-48 truncate px-5 py-4 text-gray-500 dark:text-gray-400 "
                      title={row.remarks ?? ''}
                    >
                      {row.remarks || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 dark:border-navy-700 px-5 py-3 text-xs text-gray-500 dark:text-gray-400 ">
          Showing {displayRows.length} of {canViewTeam ? teamStats.total : stats.days} {canViewTeam ? (seesWholeCompany ? 'employees' : 'team members') : 'records'}
        </div>
      </section>
    </main>
  );
}
