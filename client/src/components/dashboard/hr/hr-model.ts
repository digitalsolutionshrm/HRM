import { apiFetch } from '@/lib/api';
import { PayrollIncrement, PayrollRecord, payrollApi } from '@/components/payroll/payroll-shared';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Emp = {
  id: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  designation?: string | null;
  status?: boolean;
  joiningDate?: string | null;
  salary?: number | string | null;
  performance?: number | string | null;
  profileImage?: string | null;
  faceConsentAt?: string | null;
  department?: { id: number; name: string } | string | null;
  manager?: { id?: number; firstName?: string; lastName?: string } | null;
  user?: { id?: number; email?: string; status?: boolean };
  personalDetails?: { dateOfBirth?: string | null; gender?: string | null } | null;
  addresses?: Array<{ city?: string | null; state?: string | null; country?: string | null }>;
};
export type Att = { employeeId: number; date: string; status: string; checkIn?: string | null; checkOut?: string | null };
export type Leave = { id: number; employeeId: number; status: string; leaveType?: string; leaveDuration?: string; startDate: string; endDate: string; reason?: string; createdAt?: string; employee?: Emp };
export type Dept = { id: number; name: string; status?: boolean };
export type Doc = { id: number; employeeId: number; employeeCode?: string; employeeName: string; documentType: string; documentName: string; issueDate?: string | null; expiryDate?: string | null; status?: boolean };

export type HrData = {
  employees: Emp[];
  departments: Dept[];
  attendance: Att[]; // last 7 days, whole company
  leaves: Leave[];
  payroll: PayrollRecord[];
  increments: PayrollIncrement[];
  documents: Doc[];
};
export const EMPTY_HR_DATA: HrData = { employees: [], departments: [], attendance: [], leaves: [], payroll: [], increments: [], documents: [] };

/** Assumption: probation lasts 90 days from joining date (no probation field exists in the backend yet). */
export const PROBATION_DAYS = 90;
export const ONBOARDING_WINDOW_DAYS = 60;

/* ------------------------------------------------------------------ */
/* Date + string helpers                                               */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const day = (value?: string | null) => (value ? String(value).slice(0, 10) : '');
export const addDays = (base: string, offset: number) => { const d = new Date(`${base}T00:00:00`); d.setDate(d.getDate() + offset); return ymd(d); };
export const diffDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000);
export const norm = (value?: string | null) => (value ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
export const pretty = (value?: string | null) => norm(value).replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) || '—';
export const empName = (e?: { firstName?: string; lastName?: string } | null) => [e?.firstName, e?.lastName].filter(Boolean).join(' ') || 'Employee';
export const deptName = (e?: Emp | null) => (typeof e?.department === 'string' ? e.department : e?.department?.name) || 'Unassigned';
export const initials = (e?: Emp | null) => empName(e).split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const num = (v?: number | string | null) => Number(v ?? 0) || 0;
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Days until the next yearly occurrence of a date's month/day (0 = today). */
export function daysUntilAnnual(dateValue: string, today: string): number {
  const [ty] = today.split('-').map(Number);
  const [, m, d] = day(dateValue).split('-').map(Number);
  const build = (year: number, dd: number) => `${year}-${pad(m)}-${pad(dd)}`;
  const safeDiff = (year: number) => {
    // 29 Feb in a non-leap year: Date silently rolls over to 1 Mar, so fall back to 28 Feb.
    const valid = new Date(year, m - 1, d).getMonth() === m - 1;
    return diffDays(today, build(year, valid ? d : d - 1));
  };
  const thisYear = safeDiff(ty);
  return thisYear >= 0 ? thisYear : safeDiff(ty + 1);
}

export function yearsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`); const b = new Date(`${to}T00:00:00`);
  let years = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) years -= 1;
  return years;
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
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

export async function loadHrData(): Promise<{ data: HrData; failed: string[] }> {
  const failed: string[] = [];
  const safe = async <T,>(label: string, task: Promise<T>, fallback: T): Promise<T> => {
    try { return await task; } catch { failed.push(label); return fallback; }
  };
  const today = ymd(new Date());
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const [employees, departments, leaves, payroll, increments, documents, attendanceDays] = await Promise.all([
    safe('employees', getList<Emp>('/employees'), [] as Emp[]),
    safe('departments', getList<Dept>('/departments'), [] as Dept[]),
    safe('leaves', getList<Leave>('/leaves'), [] as Leave[]),
    safe('payroll', payrollApi.getAll(), [] as PayrollRecord[]),
    safe('increments', payrollApi.getIncrements(), [] as PayrollIncrement[]),
    safe('documents', getList<Doc>('/employees/documents/overview'), [] as Doc[]),
    Promise.all(dates.map((d) => safe('attendance', getList<Att>(`/attendance/date/${d}`), [] as Att[]))),
  ]);
  return {
    data: { employees, departments, leaves, payroll, increments, documents, attendance: attendanceDays.flat().map((row) => ({ ...row, date: day(row.date) })) },
    failed: Array.from(new Set(failed)),
  };
}

/* ------------------------------------------------------------------ */
/* Derived model                                                       */
/* ------------------------------------------------------------------ */

export type Count = { label: string; value: number };
const tally = (labels: string[]): Count[] => {
  const map = new Map<string, number>();
  labels.forEach((l) => map.set(l, (map.get(l) ?? 0) + 1));
  return Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
const inOrder = (counts: Count[], order: string[]): Count[] => order.map((label) => ({ label, value: counts.find((c) => c.label === label)?.value ?? 0 }));

const PRESENT_SET = ['PRESENT', 'LATE', 'SHORT_LEAVE', 'HALF_DAY'];
const REQUIRED_DOCS: Array<{ label: string; match: RegExp }> = [
  { label: 'Aadhaar', match: /\baadhaa?r\b/i },
  { label: 'PAN', match: /\bpan\b/i },
];

export function buildHrModel(data: HrData, today = ymd(new Date())) {
  const { employees, attendance, leaves, payroll, increments, documents, departments } = data;
  const month = Number(today.slice(5, 7)); const year = Number(today.slice(0, 4));
  const active = employees.filter((e) => e.status !== false);
  const inactive = employees.filter((e) => e.status === false);
  const userToEmp = new Map(employees.filter((e) => e.user?.id).map((e) => [e.user!.id as number, e]));
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  /* ---- overview ---- */
  const joined30 = active.filter((e) => e.joiningDate && diffDays(day(e.joiningDate), today) >= 0 && diffDays(day(e.joiningDate), today) <= 30)
    .sort((a, b) => day(b.joiningDate).localeCompare(day(a.joiningDate)));
  const deptCounts = tally(active.map((e) => deptName(e)));
  const locationCounts = tally(active.map((e) => e.addresses?.find((a) => a.city)?.city?.trim() || 'Not set'));
  const genderCounts = inOrder(tally(active.map((e) => {
    const g = norm(e.personalDetails?.gender);
    return g.startsWith('M') ? 'Male' : g.startsWith('F') ? 'Female' : g ? 'Other' : 'Not set';
  })), ['Male', 'Female', 'Other', 'Not set']);
  const ageOf = (e: Emp) => (e.personalDetails?.dateOfBirth ? yearsBetween(day(e.personalDetails.dateOfBirth), today) : null);
  const ageBands = inOrder(tally(active.map((e) => {
    const a = ageOf(e);
    return a === null ? 'Not set' : a < 25 ? 'Under 25' : a < 35 ? '25–34' : a < 45 ? '35–44' : a < 55 ? '45–54' : '55+';
  })), ['Under 25', '25–34', '35–44', '45–54', '55+', 'Not set']);
  const tenureBands = inOrder(tally(active.map((e) => {
    if (!e.joiningDate) return 'Not set';
    const y = yearsBetween(day(e.joiningDate), today);
    return y < 1 ? '< 1 year' : y < 3 ? '1–3 years' : y < 5 ? '3–5 years' : y < 10 ? '5–10 years' : '10+ years';
  })), ['< 1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years', 'Not set']);

  // Headcount trend: employees who joined on/before each month end (leavers are not in the data, so this is an approximation).
  const monthEnds = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i) + 1, 0);
    return { label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d), end: ymd(d) };
  });
  const headcountTrend = monthEnds.map((m) => ({ label: m.label, value: active.filter((e) => !e.joiningDate || day(e.joiningDate) <= m.end).length }));
  const joinsByMonth = monthEnds.map((m) => {
    const start = `${m.end.slice(0, 8)}01`;
    return { label: m.label, value: active.filter((e) => day(e.joiningDate) >= start && day(e.joiningDate) <= m.end).length };
  });

  /* ---- onboarding ---- */
  const docsByEmp = new Map<number, Doc[]>();
  documents.forEach((d) => docsByEmp.set(d.employeeId, [...(docsByEmp.get(d.employeeId) ?? []), d]));
  const onboarding = active
    .filter((e) => e.joiningDate && diffDays(day(e.joiningDate), today) >= 0 && diffDays(day(e.joiningDate), today) <= ONBOARDING_WINDOW_DAYS)
    .sort((a, b) => day(b.joiningDate).localeCompare(day(a.joiningDate)))
    .map((e) => {
      const steps = [
        { label: 'Documents uploaded', done: (docsByEmp.get(e.id)?.length ?? 0) > 0 },
        { label: 'Department assigned', done: deptName(e) !== 'Unassigned' },
        { label: 'Reporting manager set', done: Boolean(e.manager) },
        { label: 'Salary configured', done: num(e.salary) > 0 },
        { label: 'Face attendance enrolled', done: Boolean(e.faceConsentAt) },
      ];
      return { employee: e, steps, doneCount: steps.filter((s) => s.done).length };
    });
  const probationEnding = active
    .filter((e) => e.joiningDate)
    .map((e) => ({ employee: e, endsOn: addDays(day(e.joiningDate), PROBATION_DAYS) }))
    .map((x) => ({ ...x, inDays: diffDays(today, x.endsOn) }))
    .filter((x) => x.inDays >= 0 && x.inDays <= 30)
    .sort((a, b) => a.inDays - b.inDays);

  /* ---- attendance ---- */
  const todayRows = attendance.filter((r) => r.date === today);
  const approvedLeaveToday = (empId: number) => leaves.some((l) => l.employeeId === empId && norm(l.status) === 'APPROVED' && day(l.startDate) <= today && day(l.endDate) >= today);
  const onLeaveIds = new Set(active.filter((e) => approvedLeaveToday(e.id)).map((e) => e.id));
  const attToday = {
    present: todayRows.filter((r) => norm(r.status) === 'PRESENT').length,
    late: todayRows.filter((r) => norm(r.status) === 'LATE').length,
    shortLeave: todayRows.filter((r) => norm(r.status) === 'SHORT_LEAVE').length,
    halfDay: todayRows.filter((r) => norm(r.status) === 'HALF_DAY').length,
    absent: todayRows.filter((r) => norm(r.status) === 'ABSENT').length,
    onLeave: Math.max(todayRows.filter((r) => norm(r.status) === 'ON_LEAVE').length, onLeaveIds.size),
  };
  const markedUserIds = new Set(todayRows.map((r) => r.employeeId));
  const notMarked = active.filter((e) => e.user?.id && !markedUserIds.has(e.user.id) && !onLeaveIds.has(e.id));
  const attSeries = [
    { name: 'Present', data: last7.map((d) => attendance.filter((r) => r.date === d && ['PRESENT', 'HALF_DAY'].includes(norm(r.status))).length) },
    { name: 'Late', data: last7.map((d) => attendance.filter((r) => r.date === d && norm(r.status) === 'LATE').length) },
    { name: 'Short leave', data: last7.map((d) => attendance.filter((r) => r.date === d && norm(r.status) === 'SHORT_LEAVE').length) },
    { name: 'On leave', data: last7.map((d) => attendance.filter((r) => r.date === d && norm(r.status) === 'ON_LEAVE').length) },
    { name: 'Absent', data: last7.map((d) => attendance.filter((r) => r.date === d && norm(r.status) === 'ABSENT').length) },
  ];
  const weekRows = attendance.length;
  const absenteeismRate = percent(attendance.filter((r) => norm(r.status) === 'ABSENT').length, weekRows);
  const lateRate = percent(attendance.filter((r) => norm(r.status) === 'LATE').length, weekRows);
  const lateLeaders = tally(attendance.filter((r) => norm(r.status) === 'LATE').map((r) => String(r.employeeId)))
    .slice(0, 5).map((c) => ({ employee: userToEmp.get(Number(c.label)), count: c.value })).filter((x) => x.employee);
  const absentLeaders = tally(attendance.filter((r) => norm(r.status) === 'ABSENT').map((r) => String(r.employeeId)))
    .slice(0, 5).map((c) => ({ employee: userToEmp.get(Number(c.label)), count: c.value })).filter((x) => x.employee);
  const earlyLeavers = todayRows.filter((r) => r.checkOut && PRESENT_SET.includes(norm(r.status))).length;

  const pendingLeaves = leaves.filter((l) => norm(l.status) === 'PENDING').sort((a, b) => day(a.startDate).localeCompare(day(b.startDate)));
  const monthStart = `${today.slice(0, 7)}-01`;
  const leaveTypeCounts = tally(leaves.filter((l) => day(l.startDate) >= monthStart && ['APPROVED', 'PENDING'].includes(norm(l.status))).map((l) => pretty(l.leaveType)));
  const upcomingLeaves = leaves.filter((l) => norm(l.status) === 'APPROVED' && day(l.endDate) >= today && day(l.startDate) <= addDays(today, 14))
    .sort((a, b) => day(a.startDate).localeCompare(day(b.startDate)));

  /* ---- payroll ---- */
  const cur = payroll.filter((r) => r.month === month && r.year === year);
  const sum = (key: keyof PayrollRecord) => cur.reduce((t, r) => t + num(r[key] as number), 0);
  const payrollStatus = { pending: cur.filter((r) => norm(r.status) === 'PENDING').length, processed: cur.filter((r) => norm(r.status) === 'PROCESSED').length, paid: cur.filter((r) => norm(r.status) === 'PAID').length };
  const deptCost = (() => {
    const map = new Map<string, number>();
    cur.forEach((r) => { const k = r.employee?.department || 'Unassigned'; map.set(k, (map.get(k) ?? 0) + num(r.netSalary)); });
    return Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();
  const payrollTotals = {
    gross: sum('grossSalary'), net: sum('netSalary'), pf: sum('pf'), esi: sum('esi'), tax: sum('tax'),
    bonus: sum('bonus'), overtime: sum('overtime'), overtimeHours: sum('overtimeHours'),
  };
  const overtimeLeaders = [...cur].filter((r) => num(r.overtimeHours) > 0).sort((a, b) => num(b.overtimeHours) - num(a.overtimeHours)).slice(0, 5);
  const bonusRecords = [...cur].filter((r) => num(r.bonus) > 0).sort((a, b) => num(b.bonus) - num(a.bonus)).slice(0, 5);
  const withoutPayroll = active.filter((e) => !cur.some((r) => r.employeeId === e.id)).length;
  const recentIncrements = [...increments].sort((a, b) => day(b.effectiveDate).localeCompare(day(a.effectiveDate))).slice(0, 5);

  /* ---- performance (uses the "Performance %" saved on each employee profile) ---- */
  const scored = active.filter((e) => e.performance !== null && e.performance !== undefined && e.performance !== '');
  const perfBands = [
    { label: 'Outstanding (90+)', value: scored.filter((e) => num(e.performance) >= 90).length },
    { label: 'Strong (75–89)', value: scored.filter((e) => num(e.performance) >= 75 && num(e.performance) < 90).length },
    { label: 'Meets (60–74)', value: scored.filter((e) => num(e.performance) >= 60 && num(e.performance) < 75).length },
    { label: 'Needs support (<60)', value: scored.filter((e) => num(e.performance) < 60).length },
  ];
  const topPerformers = [...scored].sort((a, b) => num(b.performance) - num(a.performance)).slice(0, 5);
  const needSupport = [...scored].filter((e) => num(e.performance) < 60).sort((a, b) => num(a.performance) - num(b.performance)).slice(0, 5);
  const recentlyIncremented = new Set(increments.filter((i) => diffDays(day(i.effectiveDate), today) <= 365).map((i) => i.employeeId));
  const incrementCandidates = scored
    .filter((e) => num(e.performance) >= 85 && !recentlyIncremented.has(e.id) && e.joiningDate && diffDays(day(e.joiningDate), today) >= 365)
    .sort((a, b) => num(b.performance) - num(a.performance)).slice(0, 5);
  const avgPerformance = scored.length ? Math.round(scored.reduce((t, e) => t + num(e.performance), 0) / scored.length) : 0;

  /* ---- engagement ---- */
  const birthdays = active.filter((e) => e.personalDetails?.dateOfBirth)
    .map((e) => ({ employee: e, inDays: daysUntilAnnual(day(e.personalDetails!.dateOfBirth), today) }))
    .filter((x) => x.inDays <= 30).sort((a, b) => a.inDays - b.inDays);
  const anniversaries = active.filter((e) => e.joiningDate && yearsBetween(day(e.joiningDate), addDays(today, 30)) >= 1)
    .map((e) => ({ employee: e, inDays: daysUntilAnnual(day(e.joiningDate), today), years: 0 }))
    .map((x) => ({ ...x, years: yearsBetween(day(x.employee.joiningDate), addDays(today, x.inDays)) }))
    .filter((x) => x.inDays <= 30 && x.years >= 1).sort((a, b) => a.inDays - b.inDays);

  /* ---- compliance ---- */
  const docWithDays = documents.filter((d) => d.expiryDate).map((d) => ({ doc: d, inDays: diffDays(today, day(d.expiryDate)) }));
  const expired = docWithDays.filter((x) => x.inDays < 0).sort((a, b) => b.inDays - a.inDays);
  const expiring30 = docWithDays.filter((x) => x.inDays >= 0 && x.inDays <= 30).sort((a, b) => a.inDays - b.inDays);
  const expiring60 = docWithDays.filter((x) => x.inDays > 30 && x.inDays <= 60).sort((a, b) => a.inDays - b.inDays);
  const typesOf = (empId: number) => (docsByEmp.get(empId) ?? []).map((d) => `${d.documentType} ${d.documentName}`);
  const docCoverage = REQUIRED_DOCS.map((req) => {
    const missing = active.filter((e) => !typesOf(e.id).some((t) => req.match.test(t)));
    return { label: req.label, have: active.length - missing.length, missing };
  });
  const noDocs = active.filter((e) => !(docsByEmp.get(e.id)?.length));

  /* ---- analytics ---- */
  const inactiveShare = percent(inactive.length, employees.length);
  const topDept = deptCounts[0];

  return {
    today, month, year, active, inactive, joined30, deptCounts, locationCounts, genderCounts, ageBands, tenureBands, headcountTrend, joinsByMonth,
    activeDepartments: departments.filter((d) => d.status !== false).length,
    onboarding, probationEnding,
    attToday, notMarked, attSeries, last7, absenteeismRate, lateRate, lateLeaders, absentLeaders, earlyLeavers, pendingLeaves, leaveTypeCounts, upcomingLeaves, onLeaveIds,
    cur, payrollStatus, payrollTotals, deptCost, overtimeLeaders, bonusRecords, withoutPayroll, recentIncrements,
    scoredCount: scored.length, perfBands, topPerformers, needSupport, incrementCandidates, avgPerformance,
    birthdays, anniversaries,
    expired, expiring30, expiring60, docCoverage, noDocs,
    inactiveShare, topDept,
  };
}
export type HrModel = ReturnType<typeof buildHrModel>;

/* ------------------------------------------------------------------ */
/* CSV export (runs entirely in the browser)                           */
/* ------------------------------------------------------------------ */

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formulas in user-entered text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
