'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MdAdd,
  MdCalendarMonth,
  MdDelete,
  MdEdit,
  MdRefresh,
  MdSave,
} from 'react-icons/md';
import { apiFetch } from '@/lib/api';

type WorkSettings = {
  officeStartTime: string;
  officeEndTime: string;
  graceMinutes: number;
  standardWorkHours: number | string;
  paidLeavesPerMonth: number;
  weeklyOffDays: number[];
};

type Holiday = {
  id: number;
  name: string;
  date: string;
  description?: string | null;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyHolidayForm = { name: '', date: '', description: '' };

function unwrap<T>(body: any): T {
  return (body?.data ?? body) as T;
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? 'The request failed.';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return unwrap<T>(body);
}

/** "09:30:00" -> "09:30" so it can be shown in an <input type="time">. */
function toTimeInput(value: string) {
  return String(value ?? '').slice(0, 5);
}

function dateLabel(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<WorkSettings | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [workSettings, holidayList] = await Promise.all([
        read<WorkSettings>(await apiFetch('/settings/work')),
        read<Holiday[]>(await apiFetch(`/settings/holidays?year=${year}`)),
      ]);
      setSettings({
        ...workSettings,
        officeStartTime: toTimeInput(workSettings.officeStartTime),
        officeEndTime: toTimeInput(workSettings.officeEndTime),
        graceMinutes: Number(workSettings.graceMinutes ?? 0),
        standardWorkHours: Number(workSettings.standardWorkHours ?? 8),
        paidLeavesPerMonth: Number(workSettings.paidLeavesPerMonth ?? 0),
        weeklyOffDays: (workSettings.weeklyOffDays ?? []).map(Number),
      });
      setHolidays(Array.isArray(holidayList) ? holidayList : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateSetting<K extends keyof WorkSettings>(key: K, value: WorkSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleWeekday(day: number) {
    setSettings((current) => {
      if (!current) return current;
      const has = current.weeklyOffDays.includes(day);
      return {
        ...current,
        weeklyOffDays: has
          ? current.weeklyOffDays.filter((item) => item !== day)
          : [...current.weeklyOffDays, day].sort((a, b) => a - b),
      };
    });
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setError('');
    setNotice('');
    try {
      const saved = await read<WorkSettings>(
        await apiFetch('/settings/work', {
          method: 'PATCH',
          body: JSON.stringify({
            officeStartTime: settings.officeStartTime,
            officeEndTime: settings.officeEndTime,
            graceMinutes: Number(settings.graceMinutes),
            standardWorkHours: Number(settings.standardWorkHours),
            paidLeavesPerMonth: Number(settings.paidLeavesPerMonth),
            weeklyOffDays: settings.weeklyOffDays,
          }),
        }),
      );
      setSettings((current) =>
        current
          ? {
              ...current,
              ...saved,
              officeStartTime: toTimeInput(saved.officeStartTime),
              officeEndTime: toTimeInput(saved.officeEndTime),
            }
          : current,
      );
      setNotice('Attendance rules saved. New check-ins will use these timings.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be saved.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingHoliday(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: holidayForm.name.trim(),
        date: holidayForm.date,
        description: holidayForm.description.trim() || undefined,
      };
      if (editingId) {
        const updated = await read<Holiday>(
          await apiFetch(`/settings/holidays/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),
        );
        setHolidays((current) =>
          current
            .map((item) => (item.id === editingId ? updated : item))
            .sort((a, b) => a.date.localeCompare(b.date)),
        );
        setNotice(`${updated.name} was updated.`);
      } else {
        const created = await read<Holiday>(
          await apiFetch('/settings/holidays', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        );
        setHolidays((current) =>
          [...current.filter((item) => item.id !== created.id), created].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
        setNotice(`${created.name} was added to the holiday calendar.`);
      }
      setEditingId(null);
      setHolidayForm(emptyHolidayForm);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Holiday could not be saved.');
    } finally {
      setSavingHoliday(false);
    }
  }

  async function deleteHoliday(holiday: Holiday) {
    if (!window.confirm(`Delete ${holiday.name} (${dateLabel(holiday.date)})?`)) return;
    setDeletingId(holiday.id);
    setError('');
    setNotice('');
    try {
      await read(await apiFetch(`/settings/holidays/${holiday.id}`, { method: 'DELETE' }));
      setHolidays((current) => current.filter((item) => item.id !== holiday.id));
      if (editingId === holiday.id) {
        setEditingId(null);
        setHolidayForm(emptyHolidayForm);
      }
      setNotice(`${holiday.name} was removed.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Holiday could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  }

  function startEditHoliday(holiday: Holiday) {
    setEditingId(holiday.id);
    setHolidayForm({
      name: holiday.name,
      date: holiday.date.slice(0, 10),
      description: holiday.description ?? '',
    });
    setError('');
    setNotice('');
  }

  const fieldClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]';
  const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-gray-200';

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-1 pb-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-600">Attendance</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Attendance settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Set office timings, weekly offs, the monthly paid-leave allowance and company holidays. These rules drive
          late/half-day marking and payroll leave deductions.
        </p>
      </header>

      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-400/10 dark:text-green-200">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">
            Retry
          </button>
        </p>
      )}

      {loading || !settings ? (
        <p className="p-8 text-center text-sm text-slate-500 dark:text-gray-400">Loading settings…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Work timing rules</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              A check-in after the start time plus the grace period is marked late.
            </p>
            <form onSubmit={saveSettings} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Office start time
                <input
                  required
                  type="time"
                  value={settings.officeStartTime}
                  onChange={(event) => updateSetting('officeStartTime', event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Office end time
                <input
                  required
                  type="time"
                  value={settings.officeEndTime}
                  onChange={(event) => updateSetting('officeEndTime', event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Grace period (minutes)
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={settings.graceMinutes}
                  onChange={(event) => updateSetting('graceMinutes', Number(event.target.value))}
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Standard work hours per day
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={settings.standardWorkHours}
                  onChange={(event) => updateSetting('standardWorkHours', Number(event.target.value))}
                  className={fieldClass}
                />
                <span className="mt-1 block text-xs font-normal text-slate-400 dark:text-gray-400">
                  Below half of this is recorded as a half day.
                </span>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Paid leaves per month
                <input
                  type="number"
                  min={0}
                  max={31}
                  value={settings.paidLeavesPerMonth}
                  onChange={(event) => updateSetting('paidLeavesPerMonth', Number(event.target.value))}
                  className={fieldClass}
                />
                <span className="mt-1 block text-xs font-normal text-slate-400 dark:text-gray-400">
                  Leave days beyond this allowance are cut from the monthly salary at the per-day rate.
                </span>
              </label>
              <div className={`${labelClass} sm:col-span-2`}>
                Weekly off days
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAYS.map((day, index) => {
                    const active = settings.weeklyOffDays.includes(index);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(index)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-900 dark:text-gray-300'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <MdSave /> {savingSettings ? 'Saving…' : 'Save rules'}
                </button>
              </div>
            </form>
          </section>

          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Holidays</h2>
              <div className="flex items-center gap-2">
                <label className="relative">
                  <MdCalendarMonth className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                    aria-label="Holiday year"
                    className="h-10 w-28 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Refresh holidays"
                  onClick={() => void load()}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:text-gray-300"
                >
                  <MdRefresh className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              Holidays are excluded from attendance and are never counted as leave.
            </p>

            <form onSubmit={saveHoliday} className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Holiday name
                <input
                  required
                  value={holidayForm.name}
                  onChange={(event) => setHolidayForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="e.g. Diwali"
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                Date
                <input
                  required
                  type="date"
                  value={holidayForm.date}
                  onChange={(event) => setHolidayForm((current) => ({ ...current, date: event.target.value }))}
                  className={fieldClass}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Description <span className="font-normal text-slate-400">(optional)</span>
                <input
                  value={holidayForm.description}
                  onChange={(event) => setHolidayForm((current) => ({ ...current, description: event.target.value }))}
                  className={fieldClass}
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <MdAdd /> {savingHoliday ? 'Saving…' : editingId ? 'Update holiday' : 'Add holiday'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setHolidayForm(emptyHolidayForm);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-navy-700">
              {holidays.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500 dark:text-gray-400">
                  No holidays set for {year}.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-navy-900 dark:text-gray-400">
                    <tr>
                      <th className="p-3">Holiday</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                    {holidays.map((holiday) => (
                      <tr key={holiday.id}>
                        <td className="p-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{holiday.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                            {dateLabel(holiday.date)}
                            {holiday.description ? ` · ${holiday.description}` : ''}
                          </p>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditHoliday(holiday)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                            >
                              <MdEdit /> Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === holiday.id}
                              onClick={() => void deleteHoliday(holiday)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              <MdDelete /> {deletingId === holiday.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
