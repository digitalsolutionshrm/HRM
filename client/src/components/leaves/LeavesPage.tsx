'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MdAdd, MdCheck, MdClose, MdDeleteOutline, MdEdit, MdRefresh, MdTimeToLeave } from 'react-icons/md';
import Card from 'components/card';
import { apiFetch } from '@/lib/api';
import { hasRichTextMarkup, sanitizeRichTextHtml } from '@/components/rich-text-utils';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="min-h-40 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-400 dark:border-navy-600 dark:bg-navy-900">Loading editor…</div>,
});

type LeaveType = 'CASUAL' | 'SICK' | 'ANNUAL' | 'UNPAID' | 'OTHER';
type LeaveDuration = 'FULL_DAY' | 'HALF_DAY' | 'SHORT_LEAVE';
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface Employee { id: number; employeeCode?: string; firstName?: string; lastName?: string; }
interface Leave {
  id: number; employeeId: number; employee?: Employee;
  leaveType: LeaveType; leaveDuration: LeaveDuration;
  startDate: string; endDate: string; startTime?: string | null; endTime?: string | null;
  reason: string; status: LeaveStatus; rejectionReason?: string | null;
}

interface Draft {
  employeeId: string; leaveType: LeaveType; leaveDuration: LeaveDuration;
  startDate: string; endDate: string; startTime: string; endTime: string; reason: string;
}

const EMPTY_DRAFT: Draft = {
  employeeId: '', leaveType: 'CASUAL', leaveDuration: 'FULL_DAY',
  startDate: '', endDate: '', startTime: '', endTime: '', reason: '',
};

function unwrap<T>(result: any): T {
  return (result?.data ?? result) as T;
}

async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message ?? result?.error ?? fallback;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return unwrap<T>(result);
}

function formatDate(value: string): string {
  const parts = value.slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(parts[0], parts[1] - 1, parts[2]));
}

function formatTime(value?: string | null): string {
  if (!value) return '—';
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    .format(new Date(2000, 0, 1, hour, minute));
}

function employeeName(employee?: Employee, id?: number): string {
  const name = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ');
  return name ? `${name}${employee?.employeeCode ? ` · ${employee.employeeCode}` : ''}` : `Employee #${id ?? '—'}`;
}

function statusStyle(status: LeaveStatus): string {
  if (status === 'APPROVED') return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (status === 'REJECTED') return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

const inputClass = 'h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]';
const labelClass = 'flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white';

export default function LeavesPage({ role }: { role: 'admin' | 'hr' | 'manager' | 'employee' }) {
  const canManageAll = role === 'admin' || role === 'hr';
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Leave | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [dialog, setDialog] = useState<{ kind: 'delete' | 'reject'; leave: Leave } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManageAll) {
        const [leaveResponse, employeeResponse] = await Promise.all([
          apiFetch('/leaves'), apiFetch('/employees'),
        ]);
        const [leaveData, employeeData] = await Promise.all([
          readResponse<Leave[] | { items?: Leave[] }>(leaveResponse, 'Could not load leave requests.'),
          readResponse<Employee[] | { items?: Employee[] }>(employeeResponse, 'Could not load employees.'),
        ]);
        setLeaves(Array.isArray(leaveData) ? leaveData : leaveData.items ?? []);
        setEmployees(Array.isArray(employeeData) ? employeeData : employeeData.items ?? []);
      } else {
        const profileResponse = await apiFetch('/employees/profile');
        const profile = await readResponse<Employee>(profileResponse, 'Could not load your employee profile.');
        setMyEmployeeId(profile.id);
        const leaveResponse = await apiFetch(`/leaves/employee/${profile.id}`);
        const leaveData = await readResponse<Leave[] | { items?: Leave[] }>(leaveResponse, 'Could not load your leave requests.');
        setLeaves(Array.isArray(leaveData) ? leaveData : leaveData.items ?? []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  }, [canManageAll]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const totals = useMemo(() => ({
    all: leaves.length,
    pending: leaves.filter((leave) => leave.status === 'PENDING').length,
    approved: leaves.filter((leave) => leave.status === 'APPROVED').length,
  }), [leaves]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT, employeeId: canManageAll ? '' : String(myEmployeeId ?? '') });
    setFormOpen(true);
  };

  const openEdit = (leave: Leave) => {
    setEditing(leave);
    setDraft({
      employeeId: String(leave.employeeId), leaveType: leave.leaveType,
      leaveDuration: leave.leaveDuration, startDate: leave.startDate.slice(0, 10),
      endDate: leave.endDate.slice(0, 10), startTime: leave.startTime?.slice(0, 5) ?? '',
      endTime: leave.endTime?.slice(0, 5) ?? '', reason: leave.reason,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.startDate || !draft.endDate || !draft.reason.replace(/<[^>]*>/g, '').trim()) return;
    if (draft.leaveDuration !== 'SHORT_LEAVE' && draft.endDate < draft.startDate) {
      setNotice({ kind: 'error', message: 'End date must be on or after the start date.' });
      return;
    }
    if (draft.leaveDuration === 'SHORT_LEAVE') {
      if (!draft.startTime || !draft.endTime || draft.startTime >= draft.endTime) {
        setNotice({ kind: 'error', message: 'Choose a valid start and end time for short leave.' });
        return;
      }
      const [sh, sm] = draft.startTime.split(':').map(Number);
      const [eh, em] = draft.endTime.split(':').map(Number);
      if ((eh * 60 + em) - (sh * 60 + sm) > 240) {
        setNotice({ kind: 'error', message: 'Short leave cannot be longer than 4 hours.' });
        return;
      }
    }

    const payload = {
      ...(editing ? {} : { employeeId: Number(draft.employeeId) }),
      leaveType: draft.leaveType,
      leaveDuration: draft.leaveDuration,
      startDate: draft.startDate,
      endDate: draft.leaveDuration === 'SHORT_LEAVE' || draft.leaveDuration === 'HALF_DAY' ? draft.startDate : draft.endDate,
      startTime: draft.leaveDuration === 'SHORT_LEAVE' ? draft.startTime : null,
      endTime: draft.leaveDuration === 'SHORT_LEAVE' ? draft.endTime : null,
      reason: draft.reason.trim(),
    };

    setSaving(true);
    try {
      const response = await apiFetch(editing ? `/leaves/${editing.id}` : '/leaves', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readResponse<Leave>(response, editing ? 'Could not update the leave request.' : 'Could not submit the leave request.');
      setFormOpen(false);
      setNotice({ kind: 'success', message: editing ? 'Leave request updated.' : 'Leave request submitted.' });
      await load();
    } catch (saveError) {
      setNotice({ kind: 'error', message: saveError instanceof Error ? saveError.message : 'Could not save the leave request.' });
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!dialog) return;
    if (dialog.kind === 'reject' && !rejectionReason.trim()) {
      setNotice({ kind: 'error', message: 'Enter a reason for rejecting this request.' });
      return;
    }
    setSaving(true);
    try {
      const response = dialog.kind === 'delete'
        ? await apiFetch(`/leaves/${dialog.leave.id}`, { method: 'DELETE' })
        : await apiFetch(`/leaves/${dialog.leave.id}/reject`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
        });
      if (response.status !== 204) await readResponse<unknown>(response, `Could not ${dialog.kind} the leave request.`);
      setNotice({ kind: 'success', message: dialog.kind === 'delete' ? 'Leave request deleted.' : 'Leave request rejected.' });
      setDialog(null);
      setRejectionReason('');
      await load();
    } catch (actionError) {
      setNotice({ kind: 'error', message: actionError instanceof Error ? actionError.message : 'The action could not be completed.' });
    } finally {
      setSaving(false);
    }
  };

  const approve = async (leave: Leave) => {
    setSaving(true);
    try {
      const response = await apiFetch(`/leaves/${leave.id}/approve`, { method: 'PATCH' });
      await readResponse<Leave>(response, 'Could not approve this request.');
      setNotice({ kind: 'success', message: 'Leave request approved.' });
      await load();
    } catch (actionError) {
      setNotice({ kind: 'error', message: actionError instanceof Error ? actionError.message : 'Could not approve this request.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-700 dark:text-white md:text-3xl">{canManageAll ? 'Leave Management' : 'My Leaves'}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Submit and track leave requests with clear dates and times.</p>
        </div>
        <button type="button" onClick={openCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600">
          <MdAdd className="h-5 w-5" /> New leave request
        </button>
      </header>

      {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`fixed right-5 top-5 z-[80] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${notice.kind === 'success' ? 'border-green-200 bg-white text-green-800 dark:border-green-800 dark:bg-navy-800 dark:text-green-200' : 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-navy-800 dark:text-red-200'}`}>
        {notice.kind === 'success' ? <MdCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <MdClose className="mt-0.5 h-5 w-5 shrink-0" />}
        <span>{notice.message}</span>
        <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)} className="ml-2 text-current opacity-70 hover:opacity-100"><MdClose className="h-4 w-4" /></button>
      </div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: 'Total requests', count: totals.all, tone: 'text-brand-500' },
          { title: 'Pending review', count: totals.pending, tone: 'text-amber-500' },
          { title: 'Approved', count: totals.approved, tone: 'text-green-600' },
        ].map((item) => <Card key={item.title} extra="flex items-center gap-4 px-5 py-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-lightPrimary dark:bg-navy-700 ${item.tone}`}><MdTimeToLeave className="h-6 w-6" /></div>
          <div><p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p><p className="text-xl font-bold text-navy-700 dark:text-white">{item.count}</p></div>
        </Card>)}
      </div>

      <Card extra="w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-navy-700">
          <div><h2 className="font-bold text-navy-700 dark:text-white">Leave requests</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Dates use your local date format; time fields use 24-hour input.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh leave requests" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-navy-700"><MdRefresh className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        {error && <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-navy-900 dark:text-gray-400">
              {canManageAll && <th className="px-5 py-3">Employee</th>}
              <th className="px-5 py-3">Leave</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Time</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
              {loading ? <tr><td className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={canManageAll ? 7 : 6}>Loading leave requests…</td></tr>
                : leaves.length === 0 ? <tr><td className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={canManageAll ? 7 : 6}>No leave requests yet. Select “New leave request” to get started.</td></tr>
                  : leaves.map((leave) => {
                    const pending = leave.status === 'PENDING';
                    const canEdit = canManageAll || pending;
                    const canDelete = canManageAll || pending;
                    return <tr key={leave.id} className="align-top text-sm text-navy-700 dark:text-gray-200">
                      {canManageAll && <td className="px-5 py-4 font-medium">{employeeName(leave.employee, leave.employeeId)}</td>}
                      <td className="px-5 py-4"><span className="font-semibold">{leave.leaveType.replace('_', ' ')}</span><span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{leave.leaveDuration.replace('_', ' ')}</span></td>
                      <td className="whitespace-nowrap px-5 py-4">{formatDate(leave.startDate)}{leave.endDate.slice(0, 10) !== leave.startDate.slice(0, 10) && <> <span className="text-gray-400">to</span> {formatDate(leave.endDate)}</>}</td>
                      <td className="whitespace-nowrap px-5 py-4">{leave.leaveDuration === 'SHORT_LEAVE' ? `${formatTime(leave.startTime)} – ${formatTime(leave.endTime)}` : '—'}</td>
                      <td className="max-w-xs px-5 py-4"><p className="line-clamp-2" title={leave.reason}>{hasRichTextMarkup(leave.reason) ? <span dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(leave.reason) }} /> : leave.reason}</p>{leave.rejectionReason && <p className="mt-1 text-xs text-red-600 dark:text-red-300">Reason: {leave.rejectionReason}</p>}</td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle(leave.status)}`}>{leave.status}</span></td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1">
                        {canManageAll && pending && <>
                          <button type="button" title="Approve" aria-label="Approve leave" disabled={saving} onClick={() => void approve(leave)} className="rounded-lg p-2 text-green-600 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-900/20"><MdCheck className="h-5 w-5" /></button>
                          <button type="button" title="Reject" aria-label="Reject leave" disabled={saving} onClick={() => { setRejectionReason(''); setDialog({ kind: 'reject', leave }); }} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"><MdClose className="h-5 w-5" /></button>
                        </>}
                        {canEdit && <button type="button" title="Edit" aria-label="Edit leave" onClick={() => openEdit(leave)} className="rounded-lg p-2 text-brand-500 hover:bg-lightPrimary dark:hover:bg-navy-700"><MdEdit className="h-5 w-5" /></button>}
                        {canDelete && <button type="button" title="Delete" aria-label="Delete leave" onClick={() => setDialog({ kind: 'delete', leave })} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><MdDeleteOutline className="h-5 w-5" /></button>}
                      </div></td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="leave-form-title" className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-800 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="leave-form-title" className="text-xl font-bold text-navy-700 dark:text-white">{editing ? 'Update leave request' : 'New leave request'}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter dates in the calendar fields and times in 24-hour format.</p></div><button type="button" aria-label="Close" disabled={saving} onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canManageAll && !editing && <label className={`${labelClass} sm:col-span-2`}>Employee<select required className={inputClass} value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeName(employee, employee.id)}</option>)}</select></label>}
            <label className={labelClass}>Leave type<select className={inputClass} value={draft.leaveType} onChange={(event) => setDraft({ ...draft, leaveType: event.target.value as LeaveType })}><option value="CASUAL">Casual</option><option value="SICK">Sick</option><option value="ANNUAL">Annual</option><option value="UNPAID">Unpaid</option><option value="OTHER">Other</option></select></label>
            <label className={labelClass}>Duration<select className={inputClass} value={draft.leaveDuration} onChange={(event) => setDraft({ ...draft, leaveDuration: event.target.value as LeaveDuration })}><option value="FULL_DAY">Full day</option><option value="HALF_DAY">Half day</option><option value="SHORT_LEAVE">Short leave</option></select></label>
            <label className={labelClass}>Start date<input type="date" required className={inputClass} value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value, ...(draft.leaveDuration !== 'FULL_DAY' ? { endDate: event.target.value } : {}) })} /></label>
            {draft.leaveDuration === 'FULL_DAY' ? <label className={labelClass}>End date<input type="date" required min={draft.startDate || undefined} className={inputClass} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label> : <div className="flex items-end text-xs text-gray-500 dark:text-gray-400">{draft.leaveDuration === 'HALF_DAY' ? 'Half day is recorded on the selected date.' : 'Short leave is recorded on the selected date and must not exceed 4 hours.'}</div>}
            {draft.leaveDuration === 'SHORT_LEAVE' && <><label className={labelClass}>Start time<input type="time" required className={inputClass} value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label className={labelClass}>End time<input type="time" required className={inputClass} value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></>}
            <div className={`${labelClass} sm:col-span-2`}><label>Reason</label><RichTextEditor value={draft.reason} onChange={(reason) => setDraft((current) => ({ ...current, reason }))} placeholder="Start typing the reason for your leave request…" ariaLabel="Leave request reason" minHeight="min-h-40" /><span className="text-xs font-normal text-gray-500 dark:text-gray-400">Select text to format it, or add a link.</span></div>
            <div className="flex justify-end gap-3 pt-1 sm:col-span-2"><button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600">Cancel</button><button type="submit" disabled={saving} className="h-10 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Submit request'}</button></div>
          </form>
        </section>
      </div>}

      {dialog && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-navy-900/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-navy-800">
        <h2 id="leave-confirm-title" className="text-lg font-bold text-navy-700 dark:text-white">{dialog.kind === 'delete' ? 'Delete leave request?' : 'Reject leave request?'}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{dialog.kind === 'delete' ? 'This request will be removed. This action cannot be undone.' : `Reject ${employeeName(dialog.leave.employee, dialog.leave.employeeId)}’s ${dialog.leave.leaveType.toLowerCase()} leave request?`}</p>
        {dialog.kind === 'reject' && <label className={`${labelClass} mt-4`}>Rejection reason<textarea rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-navy-700 dark:bg-navy-900" placeholder="Explain why this request is rejected" /></label>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setDialog(null)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold dark:bg-navy-700">Cancel</button><button type="button" disabled={saving} onClick={() => void confirmAction()} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{saving ? 'Working…' : dialog.kind === 'delete' ? 'Delete request' : 'Reject request'}</button></div>
      </section></div>}
    </div>
  );
}
