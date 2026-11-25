'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import CreateEmployeeAccount from './CreateEmployeeAccount';
import EditEmployeeAccount from './EditEmployeeAccount';

type Employee = { id: number; employeeCode?: string; firstName: string; lastName: string; phone?: string; designation?: string; user?: { email?: string; name?: string; role?: string }; department?: { name?: string } };
async function readResponse(response: Response) { const body = await response.json().catch(() => null); if (!response.ok) { const message = body?.message ?? 'Request failed'; throw new Error(Array.isArray(message) ? message.join(', ') : message); } return body?.data ?? body; }
export default function EmployeesDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/employees');
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Employees could not be loaded');
      const data = body?.data ?? body;
      const rows: Employee[] = Array.isArray(data) ? data : data?.items ?? [];
      setEmployees(rows.filter(employee => employee.user?.role !== 'manager' && !/\bmanager\b/i.test(employee.designation ?? '')));
    } catch (e) { setError(e instanceof Error ? e.message : 'Employees could not be loaded'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const downloadQr = async (employee: Employee) => {
    setActionId(employee.id); setError(''); setNotice('');
    try {
      const payload = await readResponse(await apiFetch(`/employees/${employee.id}/attendance-qr`));
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(JSON.stringify({ type: 'HRM_ATTENDANCE', qrToken: payload.qrToken }), { width: 420, margin: 2, errorCorrectionLevel: 'H' });
      const link = document.createElement('a'); link.href = dataUrl; link.download = `${employee.employeeCode || `EMP-${employee.id}`}-attendance-qr.png`; document.body.appendChild(link); link.click(); link.remove();
      setNotice(`QR downloaded for ${employee.firstName} ${employee.lastName}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'QR download failed.'); } finally { setActionId(null); }
  };
  const deleteEmployee = async (employee: Employee) => {
    const name = `${employee.firstName} ${employee.lastName}`;
    if (!window.confirm(`Delete employee ${name}? This cannot be undone.`)) return;
    setActionId(employee.id); setError(''); setNotice('');
    try { await readResponse(await apiFetch(`/employees/${employee.id}`, { method: 'DELETE' })); setEmployees(current => current.filter(item => item.id !== employee.id)); setNotice(`${name} was deleted.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Employee delete failed.'); } finally { setActionId(null); }
  };
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-500">People management</p><h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Employees</h1><p className="mt-1 text-sm text-slate-500 dark:text-gray-400">View employee profiles and add new team members.</p></div><button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">+ Add employee</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800"><p className="text-sm text-slate-500 dark:text-gray-400">Total employees</p><p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{loading ? '—' : employees.length}</p></div></div>
    {notice && <div role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</div>}
    {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-slate-800 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-navy-900 dark:text-gray-300"><tr><th className="p-4">Employee</th><th className="p-4">Employee ID</th><th className="p-4">Login email</th><th className="p-4">Department</th><th className="p-4">Designation</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-navy-700">{employees.map(emp => <tr key={emp.id}><td className="p-4 font-semibold text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</td><td className="p-4">{emp.employeeCode || `EMP-${emp.id}`}</td><td className="p-4">{emp.user?.email || '—'}</td><td className="p-4">{emp.department?.name || '—'}</td><td className="p-4">{emp.designation || '—'}</td><td className="p-4"><div className="flex items-center gap-2"><button type="button" onClick={() => setSelectedEmployee(emp)} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-400/10">Edit</button><button type="button" disabled={actionId !== null} onClick={() => void downloadQr(emp)} className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:border-orange-800 dark:text-orange-200 dark:hover:bg-orange-400/10">{actionId === emp.id ? 'Working…' : 'Download QR'}</button><button type="button" disabled={actionId !== null} onClick={() => void deleteEmployee(emp)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-400/10">Delete</button></div></td></tr>)}{!loading && employees.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-gray-400">No employees found. Add your first employee.</td></tr>}</tbody></table></div>
    {showCreate && <CreateEmployeeAccount onClose={() => setShowCreate(false)} onCreated={() => { setNotice('Employee account and attendance QR were created.'); void load(); }} />}
    {selectedEmployee && <EditEmployeeAccount key={selectedEmployee.id} employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSaved={() => { setNotice('Employee details updated.'); void load(); }} />}
  </main>;
}
