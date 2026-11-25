'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Department = {
  id: number;
  name: string;
  description?: string | null;
  status: boolean;
  employeeCount?: number;
};

type DepartmentForm = { name: string; description: string; status: boolean };

const emptyForm: DepartmentForm = { name: '', description: '', status: true };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as T;
}

export default function DepartmentsDirectory() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readResponse<unknown>(await apiFetch('/departments'));
      setDepartments(Array.isArray(data) ? data as Department[] : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Departments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDepartments(); }, [loadDepartments]);

  function startEdit(department: Department) {
    setEditing(department);
    setFormOpen(true);
    setFormError('');
    setForm({ name: department.name, description: department.description ?? '', status: department.status });
    setError('');
    setNotice('');
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(false);
    setFormError('');
  }

  async function saveDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || undefined, status: form.status };
      const response = await apiFetch(editing ? `/departments/${editing.id}` : '/departments', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      const saved = await readResponse<Department>(response);
      if (editing) {
        setDepartments(current => current.map(item => item.id === editing.id ? saved : item));
        setNotice(`${saved.name} was updated.`);
      } else {
        setDepartments(current => [saved, ...current]);
        setNotice(`${saved.name} was created.`);
      }
      resetForm();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Department could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    if (!window.confirm(`Delete ${department.name}? Employees assigned to this department may prevent deletion.`)) return;
    setDeletingId(department.id);
    setError('');
    setNotice('');
    try {
      await readResponse(await apiFetch(`/departments/${department.id}`, { method: 'DELETE' }));
      setDepartments(current => current.filter(item => item.id !== department.id));
      if (editing?.id === department.id) resetForm();
      setNotice(`${department.name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Department could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleStatus(department: Department) {
    setError('');
    setNotice('');
    try {
      const updated = await readResponse<Department>(await apiFetch(`/departments/${department.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: !department.status }),
      }));
      setDepartments(current => current.map(item => item.id === updated.id ? updated : item));
      if (editing?.id === updated.id) setForm(current => ({ ...current, status: updated.status }));
      setNotice(`${updated.name} is now ${updated.status ? 'active' : 'inactive'}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Department status could not be changed.');
    }
  }

  const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
  const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200';

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Administration</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Departments</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create departments and manage their details and availability.</p></div>
        {!formOpen && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setFormError(''); setFormOpen(true); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">Add department</button>}
      </header>

      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}<button type="button" onClick={() => void loadDepartments()} className="ml-3 font-semibold underline">Retry</button></p>}

      <div className="grid gap-6">
        {formOpen && <section className="mx-auto h-fit w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-label="Department editor">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Edit department' : 'Add department'}</h2>
          <p className="mt-1 text-sm text-slate-500">{editing ? 'Update the department details below.' : 'Add a department to your organization.'}</p>
          {formError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{formError}</p>}
          <form onSubmit={saveDepartment} className="mt-5 space-y-4">
            <label className={labelClass}>Name<input required minLength={2} maxLength={100} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="e.g. Engineering" /></label>
            <label className={labelClass}>Description <span className="font-normal text-slate-400">(optional)</span><textarea rows={4} maxLength={1000} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className={fieldClass} placeholder="What this department does" /></label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Active department</label>
            <div className="flex gap-3 pt-1"><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create department'}</button><button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button></div>
          </form>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Department list">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div><h2 className="font-bold text-slate-900 dark:text-white">All departments</h2><p className="text-sm text-slate-500">{departments.length} total</p></div>
            <button type="button" onClick={() => void loadDepartments()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Refresh</button>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading departments…</p> : departments.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No departments yet. Create one using the form.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-4">Department</th><th className="p-4">Employees</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{departments.map(department => <tr key={department.id}><td className="p-4"><p className="font-semibold text-slate-900 dark:text-white">{department.name}</p><p className="mt-1 max-w-sm truncate text-xs text-slate-500">{department.description || 'No description'}</p></td><td className="p-4"><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"><span className="text-sm font-black">{department.employeeCount ?? 0}</span> employee{(department.employeeCount ?? 0) === 1 ? '' : 's'}</span></td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${department.status ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{department.status ? 'Active' : 'Inactive'}</span></td><td className="p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => startEdit(department)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">Edit</button><button type="button" onClick={() => void toggleStatus(department)} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50">{department.status ? 'Deactivate' : 'Activate'}</button><button type="button" disabled={deletingId === department.id} onClick={() => void deleteDepartment(department)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{deletingId === department.id ? 'Deleting…' : 'Delete'}</button></div></td></tr>)}</tbody></table></div>
          )}
        </section>

      </div>
    </main>
  );
}
