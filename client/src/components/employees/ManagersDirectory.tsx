'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import EditEmployeeAccount from './EditEmployeeAccount';

type Manager = Record<string, any> & { id: number; firstName: string; lastName: string; designation?: string };

export default function ManagersDirectory() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Manager | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/employees');
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Managers could not be loaded');
      const rows = body?.data ?? body;
      const all = Array.isArray(rows) ? rows : rows?.items ?? [];
      setManagers(all.filter((item: Manager) => item.user?.role === 'manager' || /\bmanager\b/i.test(item.designation ?? '')));
    } catch (e) { setError(e instanceof Error ? e.message : 'Managers could not be loaded'); }
    finally { setLoading(false); }
  }, []);
  const downloadQr = async (manager: Manager) => {
    setBusyId(manager.id); setError('');
    try {
      const response = await apiFetch(`/employees/${manager.id}/attendance-qr`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Manager QR could not be loaded');
      const payload = body?.data ?? body;
      const QRCode = (await import('qrcode')).default;
      const image = await QRCode.toDataURL(JSON.stringify({ type: 'HRM_ATTENDANCE', qrToken: payload.qrToken }), { width: 420, margin: 2, errorCorrectionLevel: 'H' });
      const link = document.createElement('a'); link.href = image; link.download = `${manager.employeeCode || `EMP-${manager.id}`}-attendance-qr.png`; document.body.appendChild(link); link.click(); link.remove();
    } catch (e) { setError(e instanceof Error ? e.message : 'Manager QR download failed.'); }
    finally { setBusyId(null); }
  };
  const deleteManager = async (manager: Manager) => {
    const name = `${manager.firstName} ${manager.lastName}`.trim();
    if (!window.confirm(`Delete manager ${name}? Their profile and login account will be permanently removed.`)) return;
    setBusyId(manager.id); setError('');
    try {
      const response = await apiFetch(`/employees/${manager.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Manager could not be deleted');
      setManagers(current => current.filter(item => item.id !== manager.id));
      setSelected(current => (current?.id === manager.id ? null : current));
    } catch (e) { setError(e instanceof Error ? e.message : 'Manager delete failed.'); }
    finally { setBusyId(null); }
  };
  useEffect(() => { void load(); }, [load]);
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">People management</p><h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Managers</h1><p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Manager profiles and department assignments.</p></div>
    {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></div>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-300">Loading managers…</div> : managers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-300">No managers found. Add a manager title from the Employees section.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{managers.map(manager => <article key={manager.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-navy-700 dark:bg-navy-800 dark:shadow-none"><div className="flex items-start justify-between gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">{manager.firstName?.[0]}{manager.lastName?.[0]}</div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{manager.status === false ? 'Inactive' : 'Active'}</span></div><h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{manager.firstName} {manager.lastName}</h2><p className="text-sm font-medium text-blue-700 dark:text-blue-300">{manager.designation || 'Manager'}</p><dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-navy-700"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-gray-400">Department</dt><dd className="text-right font-medium text-slate-800 dark:text-gray-200">{manager.department?.name || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-gray-400">Office email</dt><dd className="break-all text-right font-medium text-slate-800 dark:text-gray-200">{manager.user?.email || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-gray-400">Employee ID</dt><dd className="font-medium text-slate-800 dark:text-gray-200">{manager.employeeCode || `EMP-${manager.id}`}</dd></div></dl><div className="mt-5 grid grid-cols-3 gap-2"><button type="button" disabled={busyId !== null} onClick={() => void downloadQr(manager)} className="rounded-lg border border-indigo-200 px-3 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-400/10">{busyId === manager.id ? 'Preparing…' : 'Download QR'}</button><button type="button" onClick={() => setSelected(manager)} className="rounded-lg border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-400/10">Edit</button><button type="button" disabled={busyId !== null} onClick={() => void deleteManager(manager)} className="rounded-lg border border-rose-300 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-400/10">Delete</button></div></article>)}</div>}
    {selected && <EditEmployeeAccount key={selected.id} employee={selected} onClose={() => setSelected(null)} onSaved={() => { void load(); }} />}
  </main>;
}
