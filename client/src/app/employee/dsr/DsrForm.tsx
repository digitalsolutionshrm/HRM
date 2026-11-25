'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MdClose, MdDescription, MdSave } from 'react-icons/md';
import Card from 'components/card';
import type { Dsr, CreateDsrDto } from './dsr-api';
import { joinDsrDuration, splitDsrDuration } from './dsr-time';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="min-h-40 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-400 dark:border-navy-600 dark:bg-navy-900">Loading editor…</div>,
});

interface DsrFormProps {
  editingDsr: Dsr | null;
  saving: boolean;
  onSubmit: (data: CreateDsrDto) => void;
  onCancel: () => void;
  remainingMinutes: number;
  today: string;
}

const emptyForm: CreateDsrDto = {
  date: '',
  title: '',
  description: '',
  hoursWorked: 0,
  tasksStatus: 'In Progress',
  status: 'SUBMITTED',
};

export default function DsrForm({ editingDsr, saving, onSubmit, onCancel, remainingMinutes, today }: DsrFormProps) {
  const [form, setForm] = useState<CreateDsrDto>({ ...emptyForm, date: today });
  const [workedHours, setWorkedHours] = useState(0);
  const [workedMinutes, setWorkedMinutes] = useState(0);
  const [durationError, setDurationError] = useState('');

  useEffect(() => {
    const nextForm = editingDsr ? {
      date: editingDsr.date.substring(0, 10),
      title: editingDsr.title,
      description: editingDsr.description,
      tasksStatus: editingDsr.tasksStatus === 'In Progress' || editingDsr.tasksStatus === 'Done' || editingDsr.tasksStatus === 'On Hold' ? editingDsr.tasksStatus : 'In Progress',
      hoursWorked: Number(editingDsr.hoursWorked),
      status: editingDsr.status,
    } : { ...emptyForm, date: today };
    const duration = splitDsrDuration(nextForm.hoursWorked);
    setForm(nextForm);
    setWorkedHours(duration.hours);
    setWorkedMinutes(duration.minutes);
    setDurationError('');
  }, [editingDsr, today]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: name === 'hoursWorked' ? Number(value) : value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.description.replace(/<[^>]*>/g, '').trim()) return;
    const durationMinutes = workedHours * 60 + workedMinutes;
    if (durationMinutes <= 0 || durationMinutes > remainingMinutes) {
      setDurationError(
        remainingMinutes <= 0
          ? 'You have already logged the maximum hours for this date.'
          : 'Choose a duration within the remaining hours for this date.',
      );
      return;
    }
    setDurationError('');
    onSubmit(form);
  };

  const updateDuration = (hours: number, minutes: number) => {
    setWorkedHours(hours);
    setWorkedMinutes(minutes);
    setDurationError('');
    setForm((current) => ({ ...current, hoursWorked: joinDsrDuration(hours, minutes) }));
  };

  return (
    <Card extra="w-full px-5 pb-6 pt-5 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lightPrimary text-brand-500 dark:bg-navy-700 dark:text-white">
          <MdDescription className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-navy-700 dark:text-white">
            {editingDsr ? 'Edit Daily Status Report' : 'Create Daily Status Report'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Record the work you completed.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white">
            Date
            <input type="date" name="date" value={form.date} onChange={handleChange} max={today} disabled={!!editingDsr} required
              className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-navy-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white">
            Task / Project
            <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="e.g. HRM Development" required
              className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-navy-700 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white">
            Task Status
            <select name="tasksStatus" value={form.tasksStatus} onChange={handleChange} required
              className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-navy-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white">
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="On Hold">On Hold</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white">
            Hours Worked
            <div className="grid grid-cols-2 gap-3">
              <select aria-label="Hours worked" value={workedHours} onChange={(event) => updateDuration(Number(event.target.value), workedHours === 24 ? 0 : workedMinutes)}
                className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-navy-700 dark:bg-navy-900 dark:text-white">
                {Array.from({ length: 25 }, (_, hour) => <option key={hour} value={hour} disabled={hour * 60 > remainingMinutes}>{hour} {hour === 1 ? 'hour' : 'hours'}</option>)}
              </select>
              <select aria-label="Minutes worked" value={workedMinutes} disabled={workedHours === 24} onChange={(event) => updateDuration(workedHours, Number(event.target.value))}
                className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-navy-700 dark:bg-navy-900 dark:text-white">
                {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={minute} disabled={workedHours * 60 + minute > remainingMinutes}>{String(minute).padStart(2, '0')} min</option>)}
              </select>
            </div>
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Select hours and minutes, for example 2 hours 15 minutes.</span>
            {durationError && <span role="alert" className="text-xs font-medium text-red-500">{durationError}</span>}
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-navy-700 dark:text-white md:col-span-2 xl:col-span-3">
            Work Description
            <RichTextEditor value={form.description} onChange={(description) => setForm((current) => ({ ...current, description }))} placeholder="Start typing your work update here…" ariaLabel="Work description" minHeight="min-h-40" />
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Select text to format it, or add a link.</span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" disabled={saving}
            className="flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60">
            <MdSave className="h-5 w-5" />
            {saving ? 'Saving...' : editingDsr ? 'Update DSR' : 'Submit DSR'}
          </button>
          {editingDsr && (
            <button type="button" onClick={onCancel} disabled={saving}
              className="flex h-11 items-center gap-2 rounded-xl bg-lightPrimary px-5 text-sm font-bold text-navy-700 transition hover:bg-gray-200 disabled:opacity-60 dark:bg-navy-700 dark:text-white dark:hover:bg-navy-600">
              <MdClose className="h-5 w-5" /> Cancel
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
