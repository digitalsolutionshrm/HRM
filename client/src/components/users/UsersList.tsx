import { MdDeleteOutline, MdEdit, MdPeople } from 'react-icons/md';
import type { User } from './users-api';

interface UsersListProps {
  users: User[];
  loading: boolean;
  search: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  deletingId: number | null;
  currentUserId?: number;
}

export default function UsersList({ users, loading, search, onEdit, onDelete, deletingId, currentUserId }: UsersListProps) {
  const query = search.trim().toLowerCase();
  const visibleUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query),
  );

  if (loading) return <p role="status" className="p-8 text-center text-sm text-slate-500">Loading users…</p>;
  if (visibleUsers.length === 0) {
    return <div className="flex flex-col items-center gap-2 p-12 text-center text-slate-500 dark:text-slate-400"><MdPeople className="text-4xl" /><p>{users.length ? 'No matching users.' : 'No users found.'}</p></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr><th scope="col" className="p-4">Name</th><th scope="col" className="p-4">Email</th><th scope="col" className="p-4">Role</th><th scope="col" className="p-4">Status</th><th scope="col" className="p-4 text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {visibleUsers.map((user) => (
            <tr key={user.id}>
              <td className="p-4 font-semibold text-slate-900 dark:text-white">{user.name || '—'}</td>
              <td className="p-4 text-slate-600 dark:text-slate-300">{user.email}</td>
              <td className="p-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold capitalize text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">{user.role}</span></td>
              <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === false ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{user.status === false ? 'Inactive' : 'Active'}</span></td>
              <td className="p-4 text-right"><div className="inline-flex items-center gap-2"><button type="button" onClick={() => onEdit(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-200 dark:hover:bg-blue-950"><MdEdit className="h-4 w-4" /> Edit</button><button type="button" disabled={deletingId !== null || user.id === currentUserId} title={user.id === currentUserId ? 'You cannot delete your own account' : undefined} onClick={() => onDelete(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-400/10"><MdDeleteOutline className="h-4 w-4" /> {deletingId === user.id ? 'Deleting…' : 'Delete'}</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
