'use client';

import { useCallback, useEffect, useState } from 'react';
import EditUserDialog from './EditUserDialog';
import UsersList from './UsersList';
import { deleteUser, getUsers, updateUser, type UpdateUserData, type User } from './users-api';
import { useAuth } from '@/contexts/AuthContext';

export default function UsersDirectory() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await getUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function saveUser(data: UpdateUserData) {
    if (!selectedUser) return;
    const updatedUser = await updateUser(selectedUser.id, data);
    setUsers((current) => current.map((user) => user.id === selectedUser.id ? { ...user, ...updatedUser } : user));
    setNotice(`${data.name}’s details were updated.`);
    setSelectedUser(null);
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Delete ${user.name || user.email}? Their profile and login account will be permanently removed.`)) return;
    setDeletingId(user.id);
    setError('');
    setNotice('');
    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setNotice(`${user.name || user.email} was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'User could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Administration</p><h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Users</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">View accounts and edit user details.</p></div>
        <input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or role" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </header>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">Total users</p><p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{loading ? '—' : users.length}</p></div>
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}<button type="button" onClick={() => void loadUsers()} className="ml-3 font-semibold underline">Retry</button></p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" aria-label="Users list">
        <UsersList users={users} loading={loading} search={search} onEdit={setSelectedUser} onDelete={removeUser} deletingId={deletingId} currentUserId={currentUser?.id} />
      </section>
      {selectedUser && <EditUserDialog user={selectedUser} onClose={() => setSelectedUser(null)} onSave={saveUser} />}
    </main>
  );
}
