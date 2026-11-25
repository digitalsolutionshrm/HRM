import { FormEvent, useState } from 'react';
import type { UpdateUserData, User, UserRole } from './users-api';

interface EditUserDialogProps {
  user: User;
  onClose: () => void;
  onSave: (data: UpdateUserData) => Promise<void>;
}

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const labelClass = 'grid gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300';

export default function EditUserDialog({ user, onClose, onSave }: EditUserDialogProps) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [active, setActive] = useState(user.status !== false);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), email: email.trim(), role, status: active, ...(password ? { password } : {}) });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'User details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">User account</p><h2 id="edit-user-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Edit {user.name || user.email}</h2></div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800">×</button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="grid gap-4 p-5">
          <label className={labelClass}>Name<input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Role<select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className={fieldClass}><option value="admin">Admin</option><option value="hr">HR</option><option value="manager">Manager</option><option value="employee">Employee</option></select></label>
          <label className={labelClass}>Status<select value={active ? 'active' : 'inactive'} onChange={(event) => setActive(event.target.value === 'active')} className={fieldClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className={labelClass}>New password (optional)<input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Leave blank to keep current password" className={fieldClass} /></label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}
          <footer className="mt-1 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></footer>
        </form>
      </section>
    </div>
  );
}
