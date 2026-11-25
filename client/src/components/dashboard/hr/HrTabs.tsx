'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { MdCheckCircle, MdClose, MdDownload, MdRadioButtonUnchecked, MdSearch } from 'react-icons/md';
import BarChart from 'components/charts/BarChart';
import { formatCurrency } from '@/components/payroll/payroll-shared';
import {
  HrData, HrModel, PROBATION_DAYS, ONBOARDING_WINDOW_DAYS, day, deptName, downloadCsv, empName, num, pretty, percent,
} from './hr-model';
import { Avatar, BarList, Empty, NotConnected, Pill, PersonRow, SegmentBar, Section, Stat, chartBase, type Tone } from './HrUi';

export type TabProps = { m: HrModel; data: HrData; loading: boolean };

const dateShort = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${day(value)}T00:00:00`)) : '—';
const dayMonth = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${day(value)}T00:00:00`)) : '—';
const inDaysLabel = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);
const grid2 = 'grid grid-cols-1 gap-5 xl:grid-cols-2';
const Stack = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-5">{children}</div>;
const L = ({ loading, children }: { loading: boolean; children: ReactNode }) => (loading ? <Empty>Loading…</Empty> : <>{children}</>);

/* ============================ 1. Overview ============================ */
export function OverviewTab({ m, data, loading }: TabProps) {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [limit, setLimit] = useState(8);
  const depts = useMemo(() => Array.from(new Set(data.employees.map((e) => deptName(e)))).sort(), [data.employees]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.employees.filter((e) =>
      (status === 'all' || (status === 'active' ? e.status !== false : e.status === false)) &&
      (dept === 'all' || deptName(e) === dept) &&
      (!q || [empName(e), e.employeeCode, e.designation, deptName(e), e.user?.email].some((v) => v?.toLowerCase().includes(q))));
  }, [data.employees, query, dept, status]);

  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total employees" value={loading ? '—' : data.employees.length} />
        <Stat label="Active" value={loading ? '—' : m.active.length} tone="good" />
        <Stat label="Inactive" value={loading ? '—' : m.inactive.length} tone={m.inactive.length ? 'warn' : 'neutral'} note="Deactivated profiles" />
        <Stat label="New joinees · 30 days" value={loading ? '—' : m.joined30.length} tone="info" />
        <Stat label="Active departments" value={loading ? '—' : m.activeDepartments} />
      </div>
      <div className={grid2}>
        <Section title="Department-wise headcount" subtitle="Active employees" href="/hr/departments"><L loading={loading}><BarList items={m.deptCounts} /></L></Section>
        <Section title="Location-wise headcount" subtitle="Based on the city in each employee's address"><L loading={loading}><BarList items={m.locationCounts} barClass="bg-sky-500" /></L></Section>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Section title="Gender ratio"><L loading={loading}><SegmentBar items={m.genderCounts} /></L></Section>
        <Section title="Age groups"><L loading={loading}><BarList items={m.ageBands} barClass="bg-pink-500" /></L></Section>
        <Section title="Experience with company" subtitle="Tenure since joining date"><L loading={loading}><BarList items={m.tenureBands} barClass="bg-amber-500" /></L></Section>
      </div>
      <Section title="Headcount trend · last 6 months" subtitle="Based on joining dates of current employees">
        <L loading={loading}><div className="h-[240px] w-full"><BarChart chartData={[{ name: 'Headcount', data: m.headcountTrend.map((x) => x.value) }, { name: 'Joined', data: m.joinsByMonth.map((x) => x.value) }]} chartOptions={{ ...chartBase(m.headcountTrend.map((x) => x.label), ['#422AFB', '#22c55e'], false), plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } } }} /></div></L>
      </Section>
      <Section title="Employee directory" subtitle={`${rows.length} of ${data.employees.length} employees`} href="/hr/employees" hrefLabel="Open employees">
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-400 dark:border-navy-600 dark:bg-navy-900"><MdSearch className="h-5 w-5 shrink-0" /><input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(8); }} placeholder="Search name, ID, email…" className="min-w-0 flex-1 bg-transparent text-sm text-navy-700 outline-none placeholder:text-gray-400 dark:text-white" /></label>
          <select value={dept} onChange={(e) => { setDept(e.target.value); setLimit(8); }} aria-label="Filter by department" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 dark:border-navy-600 dark:bg-navy-900 dark:text-white"><option value="all">All departments</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setLimit(8); }} aria-label="Filter by status" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 dark:border-navy-600 dark:bg-navy-900 dark:text-white"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>
        </div>
        {rows.length === 0 ? <Empty>No employees match these filters.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead><tr className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><th className="pb-3">Employee</th><th className="pb-3">ID</th><th className="pb-3">Department</th><th className="pb-3">Joined</th><th className="pb-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                {rows.slice(0, limit).map((e) => (
                  <tr key={e.id} className="text-sm text-navy-700 dark:text-gray-200">
                    <td className="py-3"><div className="flex items-center gap-3"><Avatar employee={e} /><div className="min-w-0"><p className="truncate font-semibold">{empName(e)}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{e.designation || '—'}</p></div></div></td>
                    <td className="py-3 font-mono text-xs">{e.employeeCode || '—'}</td><td className="py-3">{deptName(e)}</td><td className="py-3">{dateShort(e.joiningDate)}</td>
                    <td className="py-3"><Pill tone={e.status === false ? 'neutral' : 'good'}>{e.status === false ? 'Inactive' : 'Active'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > limit && <button type="button" onClick={() => setLimit((n) => n + 10)} className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-navy-700">Show more ({rows.length - limit} remaining)</button>}
          </div>
        )}
      </Section>
    </Stack>
  );
}

/* ============================ 2. Hiring ============================ */
export function HiringTab({ m, loading }: TabProps) {
  return (
    <Stack>
      <NotConnected title="Recruitment pipeline" needs="The backend has no recruitment module yet (no jobs, candidates or interviews tables), so nothing is shown instead of made-up numbers."
        shows={['Open positions and applicants per role', 'Pipeline: Applied → Screening → Interview → Offer → Joined', 'Interview schedule and feedback', 'Time-to-hire and cost-per-hire', 'Offer letter sending and tracking']} />
      <Section title="Recently joined" subtitle="Last 30 days — the end of your hiring pipeline" href="/hr/employees/new" hrefLabel="Add employee">
        <L loading={loading}>{m.joined30.length === 0 ? <Empty>Nobody joined in the last 30 days.</Empty> : <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{m.joined30.map((e) => <PersonRow key={e.id} employee={e} detail={`${e.designation || deptName(e)} · joined ${dateShort(e.joiningDate)}`} />)}</ul>}</L>
      </Section>
    </Stack>
  );
}

/* ============================ 3. Onboarding & offboarding ============================ */
export function OnboardingTab({ m, loading }: TabProps) {
  return (
    <Stack>
      <Section title="Onboarding checklist" subtitle={`Employees who joined in the last ${ONBOARDING_WINDOW_DAYS} days, checked against real profile data`}>
        <L loading={loading}>{m.onboarding.length === 0 ? <Empty>No recent joiners to onboard.</Empty> : (
          <ul className="space-y-3">
            {m.onboarding.map(({ employee, steps, doneCount }) => (
              <li key={employee.id} className="rounded-xl bg-gray-50 p-4 dark:bg-navy-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><Avatar employee={employee} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{empName(employee)}</p><p className="text-xs text-gray-500 dark:text-gray-400">Joined {dateShort(employee.joiningDate)}</p></div></div>
                  <Pill tone={doneCount === steps.length ? 'good' : 'warn'}>{doneCount}/{steps.length} done</Pill>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-navy-700"><div className="h-full rounded-full bg-brand-500" style={{ width: `${percent(doneCount, steps.length)}%` }} /></div>
                <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">{steps.map((s) => <li key={s.label} className={`flex items-center gap-1.5 ${s.done ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>{s.done ? <MdCheckCircle className="shrink-0" /> : <MdRadioButtonUnchecked className="shrink-0" />}{s.label}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}</L>
      </Section>
      <div className={grid2}>
        <Section title="Probation ending soon" subtitle={`Next 30 days · assumes a ${PROBATION_DAYS}-day probation from joining date`}>
          <L loading={loading}>{m.probationEnding.length === 0 ? <Empty>No probation periods ending in the next 30 days.</Empty> : <ul className="space-y-2">{m.probationEnding.map((x) => <PersonRow key={x.employee.id} employee={x.employee} detail={`Ends ${dateShort(x.endsOn)}`} right={<Pill tone={x.inDays <= 7 ? 'warn' : 'info'}>{inDaysLabel(x.inDays)}</Pill>} />)}</ul>}</L>
        </Section>
        <Section title="Inactive profiles" subtitle="Employees marked inactive" href="/hr/employees">
          <L loading={loading}>{m.inactive.length === 0 ? <Empty>No inactive employees.</Empty> : <ul className="space-y-2">{m.inactive.slice(0, 6).map((e) => <PersonRow key={e.id} employee={e} detail={`${e.designation || deptName(e)} · joined ${dateShort(e.joiningDate)}`} right={<Pill>Inactive</Pill>} />)}</ul>}</L>
        </Section>
      </div>
      <NotConnected title="Offboarding" needs="Deleting an employee currently removes their record completely, and there is no resignation or exit workflow, so exits cannot be tracked yet."
        shows={['Resignation requests and notice period', 'Exit interviews', 'Full & final settlement status', 'Clearance checklist (laptop, ID card, access)']} />
    </Stack>
  );
}

/* ============================ 4. Attendance & leave ============================ */
export function AttendanceLeaveTab({ m, loading, onApprove, onReject, busyId }: TabProps & { onApprove: (id: number) => void; onReject: (id: number, reason: string) => void; busyId: number | null }) {
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const total = m.active.length;
  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
        <Stat label="Present today" value={loading ? '—' : `${m.attToday.present + m.attToday.late + m.attToday.shortLeave + m.attToday.halfDay}/${total}`} tone="good" />
        <Stat label="Late" value={loading ? '—' : m.attToday.late} tone={m.attToday.late ? 'warn' : 'neutral'} />
        <Stat label="Short leave" value={loading ? '—' : m.attToday.shortLeave} tone={m.attToday.shortLeave ? 'warn' : 'neutral'} />
        <Stat label="Half-day" value={loading ? '—' : m.attToday.halfDay} tone={m.attToday.halfDay ? 'warn' : 'neutral'} />
        <Stat label="Absent" value={loading ? '—' : m.attToday.absent} tone={m.attToday.absent ? 'bad' : 'neutral'} />
        <Stat label="On leave" value={loading ? '—' : m.attToday.onLeave} tone="info" />
        <Stat label="Not marked yet" value={loading ? '—' : m.notMarked.length} tone={m.notMarked.length ? 'warn' : 'neutral'} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Company attendance · last 7 days" subtitle={`Absenteeism ${m.absenteeismRate}% · late ${m.lateRate}% of records`} href="/hr/attendance" hrefLabel="Attendance">
          <L loading={loading}><div className="h-[260px] w-full"><BarChart chartData={m.attSeries} chartOptions={chartBase(m.last7.map((d) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric' }).format(new Date(`${d}T00:00:00`))), ['#22c55e', '#f59e0b', '#f97316', '#0ea5e9', '#ef4444'])} /></div></L>
        </Section>
        <Section title="Late and absent · last 7 days" subtitle="Most frequent">
          <L loading={loading}>{m.lateLeaders.length + m.absentLeaders.length === 0 ? <Empty>No late or absent records this week.</Empty> : (
            <ul className="space-y-2">
              {m.lateLeaders.map((x) => <PersonRow key={`l${x.employee!.id}`} employee={x.employee} detail={deptName(x.employee)} right={<Pill tone="warn">{x.count}× late</Pill>} />)}
              {m.absentLeaders.map((x) => <PersonRow key={`a${x.employee!.id}`} employee={x.employee} detail={deptName(x.employee)} right={<Pill tone="bad">{x.count}× absent</Pill>} />)}
            </ul>
          )}</L>
        </Section>
      </div>
      <div className={grid2}>
        <Section id="leave-approvals" title="Pending leave approvals" subtitle={`${m.pendingLeaves.length} waiting`} href="/hr/leaves">
          <L loading={loading}>{m.pendingLeaves.length === 0 ? <div className="flex flex-col items-center gap-2 py-6 text-center"><MdCheckCircle className="h-8 w-8 text-green-500" /><p className="text-sm font-semibold text-navy-700 dark:text-white">All caught up</p></div> : (
            <ul className="space-y-3">
              {m.pendingLeaves.slice(0, 5).map((leave) => {
                const busy = busyId === leave.id;
                return (
                  <li key={leave.id} className="rounded-xl bg-gray-50 p-3 dark:bg-navy-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{empName(leave.employee)}</p><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{pretty(leave.leaveType)} · {dayMonth(leave.startDate)}{day(leave.endDate) !== day(leave.startDate) ? ` – ${dayMonth(leave.endDate)}` : ''}</p>{leave.reason && <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">“{leave.reason}”</p>}</div>
                    </div>
                    {rejecting === leave.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason for rejection (required)" className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-navy-700 outline-none focus:border-brand-400 dark:border-navy-600 dark:bg-navy-800 dark:text-white" />
                        <div className="flex gap-2"><button type="button" disabled={busy || !reason.trim()} onClick={() => { onReject(leave.id, reason.trim()); setRejecting(null); setReason(''); }} className="h-8 flex-1 rounded-lg bg-red-500 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50">Reject leave</button><button type="button" onClick={() => { setRejecting(null); setReason(''); }} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 dark:border-navy-600 dark:text-gray-300">Cancel</button></div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => onApprove(leave.id)} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-green-500 text-xs font-bold text-white hover:bg-green-600 disabled:opacity-50"><MdCheckCircle /> {busy ? 'Saving…' : 'Approve'}</button><button type="button" disabled={busy} onClick={() => { setRejecting(leave.id); setReason(''); }} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"><MdClose /> Reject</button></div>
                    )}
                  </li>
                );
              })}
              {m.pendingLeaves.length > 5 && <p className="text-center text-xs text-gray-500 dark:text-gray-400">+{m.pendingLeaves.length - 5} more on the Leaves page.</p>}
            </ul>
          )}</L>
        </Section>
        <Section title="Leave this month" subtitle="By type (approved and pending)"><L loading={loading}><BarList items={m.leaveTypeCounts} barClass="bg-sky-500" empty="No leave requests this month." /></L></Section>
      </div>
      <div className={grid2}>
        <Section title="Upcoming approved leave" subtitle="Next 14 days"><L loading={loading}>{m.upcomingLeaves.length === 0 ? <Empty>No approved leave coming up.</Empty> : <ul className="space-y-2">{m.upcomingLeaves.slice(0, 6).map((l) => <PersonRow key={l.id} employee={l.employee} detail={`${pretty(l.leaveType)} · ${dayMonth(l.startDate)}${day(l.endDate) !== day(l.startDate) ? ` – ${dayMonth(l.endDate)}` : ''}`} />)}</ul>}</L></Section>
        <Section title="Overtime records" subtitle="This month's payroll" href="/hr/payroll" hrefLabel="Payroll"><L loading={loading}>{m.overtimeLeaders.length === 0 ? <Empty>No overtime recorded this month.</Empty> : <ul className="space-y-2">{m.overtimeLeaders.map((r) => <li key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm dark:bg-navy-900"><span className="truncate font-semibold text-navy-700 dark:text-white">{[r.employee?.firstName, r.employee?.lastName].filter(Boolean).join(' ') || 'Employee'}</span><span className="text-xs text-gray-500 dark:text-gray-400">{num(r.overtimeHours)} h · {formatCurrency(r.overtime)}</span></li>)}</ul>}</L></Section>
      </div>
      <NotConnected title="Leave policy, holidays and shifts" needs="No leave-balance, holiday or shift tables exist in the backend yet."
        shows={['Leave balance per employee and leave policy', 'Holiday calendar', 'Shift and roster management', 'Early-leaving tracking against shift end time']} />
    </Stack>
  );
}

/* ============================ 5. Payroll ============================ */
export function PayrollTab({ m, loading }: TabProps) {
  const t = m.payrollTotals; const s = m.payrollStatus;
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(m.year, m.month - 1, 1));
  return (
    <Stack>
      <Section title={`Payroll · ${monthLabel}`} subtitle="Status of this month's payroll records" href="/hr/payroll" hrefLabel="Open payroll"
        action={<Link href="/hr/payroll" className="inline-flex h-8 items-center rounded-lg bg-brand-500 px-3 text-xs font-bold text-white hover:bg-brand-600">Generate payslips</Link>}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Pending" value={loading ? '—' : s.pending} tone={s.pending ? 'warn' : 'neutral'} />
          <Stat label="Processed" value={loading ? '—' : s.processed} tone="info" />
          <Stat label="Paid" value={loading ? '—' : s.paid} tone="good" />
          <Stat label="Net payroll" value={loading ? '—' : formatCurrency(t.net)} />
          <Stat label="Without payroll" value={loading ? '—' : m.withoutPayroll} tone={m.withoutPayroll ? 'warn' : 'good'} note="Active employees with no record yet" />
        </div>
      </Section>
      <div className={grid2}>
        <Section title="Statutory summary" subtitle="Deductions in this month's records">
          <div className="grid grid-cols-2 gap-3"><Stat label="Gross salary" value={loading ? '—' : formatCurrency(t.gross)} /><Stat label="PF" value={loading ? '—' : formatCurrency(t.pf)} /><Stat label="ESI" value={loading ? '—' : formatCurrency(t.esi)} /><Stat label="TDS / tax" value={loading ? '—' : formatCurrency(t.tax)} /></div>
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">Professional tax is not tracked as a separate field in payroll.</p>
        </Section>
        <Section title="Salary cost by department" subtitle="Net payroll this month"><L loading={loading}><BarList items={m.deptCost} barClass="bg-green-500" empty="No payroll records for this month." /></L></Section>
      </div>
      <div className={grid2}>
        <Section title="Bonus records" subtitle={`Total ${formatCurrency(t.bonus)} this month`}><L loading={loading}>{m.bonusRecords.length === 0 ? <Empty>No bonuses this month.</Empty> : <ul className="space-y-2">{m.bonusRecords.map((r) => <li key={r.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm dark:bg-navy-900"><span className="truncate font-semibold text-navy-700 dark:text-white">{[r.employee?.firstName, r.employee?.lastName].filter(Boolean).join(' ') || 'Employee'}</span><span className="font-mono text-xs text-green-600 dark:text-green-400">{formatCurrency(r.bonus)}</span></li>)}</ul>}</L></Section>
        <Section title="Recent increments" href="/hr/payroll" hrefLabel="History"><L loading={loading}>{m.recentIncrements.length === 0 ? <Empty>No increments recorded yet.</Empty> : <ul className="space-y-2">{m.recentIncrements.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900"><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{i.employeeName}</p><p className="text-xs text-gray-500 dark:text-gray-400">Effective {dateShort(i.effectiveDate)}</p></div><span className="text-right text-xs font-semibold text-green-600 dark:text-green-400">+{formatCurrency(i.increaseAmount)}<br />{Number(i.increasePercent).toFixed(1)}%</span></li>)}</ul>}</L></Section>
      </div>
    </Stack>
  );
}

/* ============================ 6. Performance ============================ */
export function PerformanceTab({ m, loading }: TabProps) {
  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Average performance" value={loading ? '—' : m.scoredCount ? `${m.avgPerformance}%` : '—'} tone="info" note="From the Performance % on profiles" />
        <Stat label="Outstanding (90+)" value={loading ? '—' : m.perfBands[0].value} tone="good" />
        <Stat label="Needs support (<60)" value={loading ? '—' : m.perfBands[3].value} tone={m.perfBands[3].value ? 'bad' : 'neutral'} />
        <Stat label="Scored employees" value={loading ? '—' : `${m.scoredCount}/${m.active.length}`} />
      </div>
      <div className={grid2}>
        <Section title="Rating distribution" subtitle="Performance % saved on each active employee profile"><L loading={loading}><BarList items={m.perfBands} total={Math.max(1, m.scoredCount)} barClass="bg-brand-500" empty="No performance scores saved yet." /></L></Section>
        <Section title="Top performers"><L loading={loading}>{m.topPerformers.length === 0 ? <Empty>No scores yet.</Empty> : <ul className="space-y-2">{m.topPerformers.map((e) => <PersonRow key={e.id} employee={e} detail={deptName(e)} right={<Pill tone="good">{num(e.performance)}%</Pill>} />)}</ul>}</L></Section>
      </div>
      <div className={grid2}>
        <Section title="Needs support" subtitle="Below 60%"><L loading={loading}>{m.needSupport.length === 0 ? <Empty>Nobody is below 60%.</Empty> : <ul className="space-y-2">{m.needSupport.map((e) => <PersonRow key={e.id} employee={e} detail={deptName(e)} right={<Pill tone="bad">{num(e.performance)}%</Pill>} />)}</ul>}</L></Section>
        <Section title="Increment candidates to review" subtitle="85%+, with the company 1+ year, no increment in 12 months"><L loading={loading}>{m.incrementCandidates.length === 0 ? <Empty>No suggestions right now.</Empty> : <ul className="space-y-2">{m.incrementCandidates.map((e) => <PersonRow key={e.id} employee={e} detail={deptName(e)} right={<Pill tone="info">{num(e.performance)}%</Pill>} />)}</ul>}</L><p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">A starting point based only on the performance score; it is not a decision.</p></Section>
      </div>
      <NotConnected title="Appraisal cycles, goals and 360° feedback" needs="Only a single Performance % exists per employee. There are no appraisal, KPI or feedback tables yet."
        shows={['Appraisal cycle status', 'KPI and goal tracking', '360-degree feedback', 'Promotion recommendations from reviews']} />
    </Stack>
  );
}

/* ============================ 7. Training ============================ */
export function TrainingTab() {
  return (
    <NotConnected title="Training & development" needs="The backend has no training module yet (no courses, enrollments, certificates or budget tables)."
      shows={['Training calendar and enrollment', 'Completion status and certificates', 'Skill-gap analysis', 'Budget vs spent on training']} />
  );
}

/* ============================ 8. Engagement ============================ */
export function EngagementTab({ m, loading, announcements }: TabProps & { announcements: Array<{ id: number; title: string; message: string; createdAt: string }> }) {
  return (
    <Stack>
      <div className={grid2}>
        <Section title="Birthdays" subtitle="Next 30 days"><L loading={loading}>{m.birthdays.length === 0 ? <Empty>No birthdays coming up (or dates of birth not filled in).</Empty> : <ul className="space-y-2">{m.birthdays.slice(0, 8).map((x) => <PersonRow key={x.employee.id} employee={x.employee} detail={dayMonth(x.employee.personalDetails?.dateOfBirth)} right={<Pill tone={x.inDays === 0 ? 'good' : 'neutral'}>{inDaysLabel(x.inDays)}</Pill>} />)}</ul>}</L></Section>
        <Section title="Work anniversaries" subtitle="Next 30 days"><L loading={loading}>{m.anniversaries.length === 0 ? <Empty>No work anniversaries coming up.</Empty> : <ul className="space-y-2">{m.anniversaries.slice(0, 8).map((x) => <PersonRow key={x.employee.id} employee={x.employee} detail={`${x.years} year${x.years === 1 ? '' : 's'} · ${dayMonth(x.employee.joiningDate)}`} right={<Pill tone={x.inDays === 0 ? 'good' : 'neutral'}>{inDaysLabel(x.inDays)}</Pill>} />)}</ul>}</L></Section>
      </div>
      <Section title="Company announcements" subtitle="Latest announcements sent to staff" href="/hr/notifications" hrefLabel="Notifications">
        {announcements.length === 0 ? <Empty>No announcements yet.</Empty> : <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{announcements.slice(0, 4).map((n) => <li key={n.id} className="rounded-xl bg-gray-50 p-3 dark:bg-navy-900"><p className="text-sm font-semibold text-navy-700 dark:text-white">{n.title}</p><p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.message}</p><p className="mt-2 text-[10px] text-gray-400">{dateShort(n.createdAt)}</p></li>)}</ul>}
      </Section>
      <NotConnected title="Surveys, grievances and recognition" needs="No survey, grievance or rewards tables exist in the backend yet."
        shows={['Employee satisfaction survey results', 'Grievance / complaint tracking', 'Rewards & recognition (Employee of the Month)', 'Policy publishing']} />
    </Stack>
  );
}

/* ============================ 9. Compliance ============================ */
export function ComplianceTab({ m, loading }: TabProps) {
  const docRow = (x: { doc: { id: number; employeeName: string; documentType: string; documentName: string; expiryDate?: string | null }; inDays: number }, tone: Tone) => (
    <li key={x.doc.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-navy-900">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-700 dark:text-white">{x.doc.employeeName || 'Employee'}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{x.doc.documentType} · {x.doc.documentName}</p></div>
      <div className="shrink-0 text-right"><Pill tone={tone}>{x.inDays < 0 ? `Expired ${Math.abs(x.inDays)}d ago` : inDaysLabel(x.inDays)}</Pill><p className="mt-1 text-[10px] text-gray-400">{dateShort(x.doc.expiryDate)}</p></div>
    </li>
  );
  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Expired documents" value={loading ? '—' : m.expired.length} tone={m.expired.length ? 'bad' : 'good'} />
        <Stat label="Expiring in 30 days" value={loading ? '—' : m.expiring30.length} tone={m.expiring30.length ? 'warn' : 'good'} />
        <Stat label="Expiring in 31–60 days" value={loading ? '—' : m.expiring60.length} tone="info" />
        <Stat label="Employees with no documents" value={loading ? '—' : m.noDocs.length} tone={m.noDocs.length ? 'warn' : 'good'} />
      </div>
      <div className={grid2}>
        <Section title="Expiry alerts" subtitle="Expired and expiring within 30 days"><L loading={loading}>{m.expired.length + m.expiring30.length === 0 ? <Empty>No documents are expired or expiring this month.</Empty> : <ul className="space-y-2">{m.expired.slice(0, 4).map((x) => docRow(x, 'bad'))}{m.expiring30.slice(0, 6).map((x) => docRow(x, 'warn'))}</ul>}</L></Section>
        <Section title="Required document coverage" subtitle="Active employees who have the document on file">
          <L loading={loading}><ul className="space-y-4">{m.docCoverage.map((c) => <li key={c.label}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-navy-700 dark:text-gray-200">{c.label}</span><span className="text-gray-500 dark:text-gray-400">{c.have}/{m.active.length} · {c.missing.length} missing</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-navy-900"><div className="h-full rounded-full bg-green-500" style={{ width: `${percent(c.have, m.active.length)}%` }} /></div></li>)}</ul></L>
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">Matched on the document type or name containing “Aadhaar” or “PAN”.</p>
        </Section>
      </div>
      <Section title="Employees with no documents uploaded" subtitle={`${m.noDocs.length} employee(s)`}><L loading={loading}>{m.noDocs.length === 0 ? <Empty>Everyone has at least one document.</Empty> : <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{m.noDocs.slice(0, 8).map((e) => <PersonRow key={e.id} employee={e} detail={deptName(e)} />)}</ul>}</L></Section>
      <NotConnected title="Labour-law compliance, policies and audits" needs="No compliance checklist, policy or audit-report tables exist yet. (Document numbers such as Aadhaar/PAN are intentionally not sent to this dashboard.)"
        shows={['Labour-law compliance checklist', 'Policy acknowledgement status', 'Audit reports']} />
    </Stack>
  );
}

/* ============================ 10. Analytics ============================ */
export function AnalyticsTab({ m, data, loading }: TabProps) {
  const reports: Array<{ title: string; detail: string; run: () => void }> = [
    { title: 'Employee directory', detail: 'Name, ID, department, status, joining date', run: () => downloadCsv(`employees-${m.today}.csv`, ['Employee ID', 'Name', 'Designation', 'Department', 'Status', 'Joining date', 'Work email', 'City', 'Gender'],
      data.employees.map((e) => [e.employeeCode, empName(e), e.designation, deptName(e), e.status === false ? 'Inactive' : 'Active', day(e.joiningDate), e.user?.email, e.addresses?.find((a) => a.city)?.city, e.personalDetails?.gender])) },
    { title: 'Attendance · last 7 days', detail: 'Daily present / late / on leave / absent', run: () => downloadCsv(`attendance-summary-${m.today}.csv`, ['Date', ...m.attSeries.map((s) => s.name)], m.last7.map((d, i) => [d, ...m.attSeries.map((s) => s.data[i])])) },
    { title: 'Payroll summary', detail: 'This month by department (net payroll)', run: () => downloadCsv(`payroll-by-department-${m.year}-${String(m.month).padStart(2, '0')}.csv`, ['Department', 'Net payroll (INR)'], m.deptCost.map((x) => [x.label, x.value])) },
    { title: 'Document expiry', detail: 'Expired and expiring within 60 days', run: () => downloadCsv(`document-expiry-${m.today}.csv`, ['Employee', 'Document type', 'Document name', 'Expiry date', 'Days left'], [...m.expired, ...m.expiring30, ...m.expiring60].map((x) => [x.doc.employeeName, x.doc.documentType, x.doc.documentName, day(x.doc.expiryDate), x.inDays])) },
  ];
  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inactive share" value={loading ? '—' : `${m.inactiveShare}%`} tone={m.inactiveShare > 15 ? 'warn' : 'neutral'} note="Inactive ÷ all profiles. Not a true attrition rate" />
        <Stat label="Absenteeism · 7 days" value={loading ? '—' : `${m.absenteeismRate}%`} tone={m.absenteeismRate > 10 ? 'bad' : 'neutral'} note="Absent records ÷ all records" />
        <Stat label="Late rate · 7 days" value={loading ? '—' : `${m.lateRate}%`} tone={m.lateRate > 15 ? 'warn' : 'neutral'} />
        <Stat label="Largest department" value={loading ? '—' : m.topDept ? `${m.topDept.label}` : '—'} note={m.topDept ? `${m.topDept.value} people` : undefined} />
      </div>
      <div className={grid2}>
        <Section title="Diversity · gender"><L loading={loading}><SegmentBar items={m.genderCounts} /></L></Section>
        <Section title="Diversity · age groups"><L loading={loading}><BarList items={m.ageBands} barClass="bg-pink-500" /></L></Section>
      </div>
      <Section title="Downloadable reports" subtitle="CSV files generated in your browser; nothing is uploaded">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reports.map((r) => <button key={r.title} type="button" disabled={loading} onClick={r.run} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/50 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-800 dark:hover:border-brand-500/50"><span><span className="block text-sm font-semibold text-navy-700 dark:text-white">{r.title}</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{r.detail}</span></span><MdDownload className="h-5 w-5 shrink-0 text-brand-500" /></button>)}
        </div>
      </Section>
      <NotConnected title="Attrition reasons and headcount forecast" needs="Exits are not recorded (deleted employees disappear) and there is no hiring plan, so reasons for leaving and a forecast cannot be calculated honestly yet."
        shows={['Attrition rate over time and reasons for leaving', 'Headcount forecast from the hiring plan']} />
    </Stack>
  );
}
