'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type EmployeeRole = {
  id: number;
  name: string;
  description?: string | null;
  status: boolean;
  employeeCount?: number;
};

type RoleForm = { name: string; description: string; status: boolean };
const emptyForm: RoleForm = { name: '', description: '', status: true };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as T;
}

export default function EmployeeRolesDirectory() {
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [editing, setEditing] = useState<EmployeeRole | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readResponse<unknown>(await apiFetch('/roles'));
      setRoles(Array.isArray(data) ? data as EmployeeRole[] : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Employee roles could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(false);
    setFormError('');
  }

  function startEdit(role: EmployeeRole) {
    setEditing(role);
    setForm({ name: role.name, description: role.description ?? '', status: role.status });
    setFormOpen(true);
    setFormError('');
    setError('');
    setNotice('');
  }

  async function saveRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
      };
      const saved = await readResponse<EmployeeRole>(await apiFetch(
        editing ? `/roles/${editing.id}` : '/roles',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      ));
      if (editing) {
        setRoles(current => current.map(role => role.id === saved.id ? { ...role, ...saved, employeeCount: role.employeeCount } : role));
        setNotice(`${saved.name} was updated.`);
      } else {
        setRoles(current => [saved, ...current]);
        setNotice(`${saved.name} was created.`);
      }
      resetForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Employee role could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: EmployeeRole) {
    if (!window.confirm(`Delete ${role.name}? Roles assigned to employees cannot be deleted.`)) return;
    setBusyId(role.id);
    setError('');
    setNotice('');
    try {
      await readResponse(await apiFetch(`/roles/${role.id}`, { method: 'DELETE' }));
      setRoles(current => current.filter(item => item.id !== role.id));
      if (editing?.id === role.id) resetForm();
      setNotice(`${role.name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Employee role could not be deleted.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(role: EmployeeRole) {
    setError('');
    setNotice('');
    try {
      const updated = await readResponse<EmployeeRole>(await apiFetch(`/roles/${role.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: !role.status }),
      }));
      setRoles(current => current.map(item => item.id === updated.id ? { ...item, ...updated, employeeCount: item.employeeCount } : item));
      if (editing?.id === updated.id) {
        setForm(current => ({ ...current, status: updated.status }));
      }
      setNotice(`${updated.name} is now ${updated.status ? 'active' : 'inactive'}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Employee role status could not be changed.');
    }
  }

  const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
  const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200';

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Administration</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Employee Roles</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create job roles and manage their details and availability.</p>
        </div>
        {!formOpen && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setFormError(''); setFormOpen(true); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Add role</button>}
      </header>

      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}<button type="button" onClick={() => void loadRoles()} className="ml-3 font-semibold underline">Retry</button></p>}

      <div className="grid gap-6">
        {formOpen && <section className="mx-auto h-fit w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-label="Employee role editor">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Edit role' : 'Add role'}</h2>
          <p className="mt-1 text-sm text-slate-500">{editing ? 'Update the role details below.' : 'Add a role to your organization.'}</p>
          {formError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{formError}</p>}
          <form onSubmit={saveRole} className="mt-5 space-y-4">
            <label className={labelClass}>Name<input required minLength={2} maxLength={100} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="e.g. Software Engineer" /></label>
            <label className={labelClass}>Description <span className="font-normal text-slate-400">(optional)</span><textarea rows={4} maxLength={1000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className={fieldClass} placeholder="What this role does" /></label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Active role</label>
            <div className="flex gap-3 pt-1"><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create role'}</button><button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button></div>
          </form>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Employee role list">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div><h2 className="font-bold text-slate-900 dark:text-white">All employee roles</h2><p className="text-sm text-slate-500">{roles.length} total</p></div>
            <button type="button" onClick={() => void loadRoles()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Refresh</button>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading employee roles…</p> : roles.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No roles yet. Create one using the form.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-4">Role</th><th className="p-4">Employees</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{roles.map(role => <tr key={role.id}><td className="p-4"><p className="font-semibold text-slate-900 dark:text-white">{role.name}</p><p className="mt-1 max-w-sm truncate text-xs text-slate-500">{role.description || 'No description'}</p></td><td className="p-4"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"><span className="text-sm font-black">{role.employeeCount ?? 0}</span> employee{(role.employeeCount ?? 0) === 1 ? '' : 's'}</span></td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${role.status ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{role.status ? 'Active' : 'Inactive'}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(role)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">Edit</button><button type="button" onClick={() => void toggleStatus(role)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">{role.status ? 'Deactivate' : 'Activate'}</button><button type="button" disabled={busyId === role.id} onClick={() => void deleteRole(role)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{busyId === role.id ? 'Deleting…' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
}
