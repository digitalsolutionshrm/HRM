'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdBusiness, MdGroups, MdRefresh, MdSearch } from 'react-icons/md';
import { apiFetch } from '@/lib/api';
import { getMediaUrl } from '@/lib/media-url';

type TeamMember = {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  joiningDate?: string | null;
  phone?: string | null;
  profileImage?: string | null;
  department?: { id: number; name: string } | null;
  user?: { email?: string };
};

async function readTeam(response: Response): Promise<TeamMember[]> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? 'Could not load your team.';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  const data = body?.data ?? body;
  return Array.isArray(data) ? data : [];
}

const memberName = (member: TeamMember) => [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Team member';
const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ManagerTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMembers(await readTeam(await apiFetch('/employees/team')));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const departments = useMemo(() => new Set(members.map((member) => member.department?.name).filter(Boolean)).size, [members]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return members;
    return members.filter((member) => [memberName(member), member.employeeCode, member.designation, member.department?.name, member.user?.email, member.phone].some((value) => value?.toLowerCase().includes(search)));
  }, [members, query]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-1 pb-10">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800 sm:flex-row sm:items-center sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">People management</p><h1 className="mt-2 text-2xl font-bold text-navy-700 dark:text-white sm:text-3xl">My Team</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your active direct reports and their team details.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-700 sm:self-auto"><MdRefresh className={loading ? 'animate-spin' : ''} />Refresh</button>
      </header>

      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200">{error}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800"><span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><MdGroups className="h-6 w-6" /></span><div><p className="text-sm text-gray-500 dark:text-gray-400">Direct team members</p><p className="mt-1 text-2xl font-bold text-navy-700 dark:text-white">{loading ? '—' : members.length}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800"><span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><MdBusiness className="h-6 w-6" /></span><div><p className="text-sm text-gray-500 dark:text-gray-400">Departments represented</p><p className="mt-1 text-2xl font-bold text-navy-700 dark:text-white">{loading ? '—' : departments}</p></div></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-navy-700 dark:bg-navy-800">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-4 dark:border-navy-700 sm:flex-row sm:items-center sm:px-5">
          <div><h2 className="font-bold text-navy-700 dark:text-white">Team directory</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading team members…' : `${filtered.length} of ${members.length} team members`}</p></div>
          <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-400 dark:border-navy-600 dark:bg-navy-900 sm:max-w-sm"><MdSearch className="h-5 w-5 shrink-0" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, ID, department…" className="min-w-0 flex-1 bg-transparent text-sm text-navy-700 outline-none placeholder:text-gray-400 dark:text-white" /></label>
        </div>

        {loading ? <p className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading team members…</p> : filtered.length === 0 ? <div className="p-10 text-center"><p className="font-semibold text-navy-700 dark:text-white">{members.length ? 'No matching team members' : 'No direct reports yet'}</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{members.length ? 'Try another name, employee ID, or department.' : 'Employees assigned to you as manager will appear here.'}</p></div> : <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-navy-900 dark:text-gray-400"><tr><th className="px-5 py-3">Employee</th><th className="px-4 py-3">Employee ID</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Work email</th><th className="px-4 py-3">Joined</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-navy-700">{filtered.map((member) => <tr key={member.id} className="text-sm text-navy-700 dark:text-gray-200"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{member.profileImage ? <img src={getMediaUrl(member.profileImage)} alt="" className="h-full w-full object-cover" /> : memberName(member).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="font-semibold">{memberName(member)}</span></div></td><td className="px-4 py-4 font-mono text-xs">{member.employeeCode || '—'}</td><td className="px-4 py-4">{member.department?.name || 'Unassigned'}</td><td className="px-4 py-4">{member.designation || '—'}</td><td className="px-4 py-4">{member.user?.email || '—'}</td><td className="px-4 py-4">{dateLabel(member.joiningDate)}</td></tr>)}</tbody></table></div>
          <div className="divide-y divide-gray-100 md:hidden dark:divide-navy-700">{filtered.map((member) => <article key={member.id} className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{member.profileImage ? <img src={getMediaUrl(member.profileImage)} alt="" className="h-full w-full object-cover" /> : memberName(member).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div className="min-w-0"><h3 className="truncate text-sm font-bold text-navy-700 dark:text-white">{memberName(member)}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{member.employeeCode || 'No employee ID'} · {member.designation || 'No designation'}</p></div></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-gray-400">Department</p><p className="mt-0.5 font-medium text-navy-700 dark:text-gray-200">{member.department?.name || 'Unassigned'}</p></div><div><p className="text-gray-400">Joined</p><p className="mt-0.5 font-medium text-navy-700 dark:text-gray-200">{dateLabel(member.joiningDate)}</p></div><div className="col-span-2 min-w-0"><p className="text-gray-400">Work email</p><p className="mt-0.5 break-all font-medium text-navy-700 dark:text-gray-200">{member.user?.email || '—'}</p></div></div></article>)}</div>
        </>}
      </section>
    </main>
  );
}
