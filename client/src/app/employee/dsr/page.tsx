'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from 'components/card';
import { MdAccessTime } from 'react-icons/md';
import DsrHeader from './DsrHeader';
import DsrForm from './DsrForm';
import DsrHistory from './DsrHistory';
import DsrTable from './DsrTable';
import {
  createDsr,
  type CreateDsrDto,
  deleteDsr,
  type Dsr,
  getDsrBusinessDate,
  getMyDsr,
  updateDsr,
} from './dsr-api';
import { dsrDurationToMinutes } from './dsr-time';

export default function EmployeeDsrPage() {
  const [dsrs, setDsrs] = useState<Dsr[]>([]);
  const [editingDsr, setEditingDsr] = useState<Dsr | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = getDsrBusinessDate();
  const todaysDsrs = dsrs.filter((dsr) => dsr.date.slice(0, 10) === today);
  const historyDsrs = dsrs
    .filter((dsr) => dsr.date.slice(0, 10) < today)
    .sort((first, second) => second.date.localeCompare(first.date));
  const totalWorkMinutes = todaysDsrs.reduce(
    (total, dsr) => total + dsrDurationToMinutes(dsr.hoursWorked),
    0,
  );
  const totalWorkHours = Math.floor(totalWorkMinutes / 60);
  const remainingWorkMinutes = totalWorkMinutes % 60;
  const dateBeingEdited = editingDsr?.date.slice(0, 10) ?? today;
  const minutesAlreadyLogged = dsrs
    .filter((dsr) => dsr.date.slice(0, 10) === dateBeingEdited && dsr.id !== editingDsr?.id)
    .reduce((total, dsr) => total + dsrDurationToMinutes(Number(dsr.hoursWorked || 0)), 0);
  const remainingMinutes = Math.max(0, 24 * 60 - minutesAlreadyLogged);

  const loadDsrs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDsrs(await getMyDsr());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load DSRs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDsrs();
  }, [loadDsrs]);

  const handleSubmit = async (data: CreateDsrDto) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      if (editingDsr) {
        await updateDsr(editingDsr.id, data);
        setEditingDsr(null);
        setSuccess('DSR updated successfully.');
      } else {
        await createDsr(data);
        setSuccess('DSR created successfully.');
      }
      await loadDsrs();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save DSR.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this DSR?')) return;
    try {
      setError('');
      setSuccess('');
      await deleteDsr(id);
      setSuccess('DSR deleted successfully.');
      await loadDsrs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete DSR.');
    }
  };

  const handleEdit = (dsr: Dsr) => {
    setError('');
    setSuccess('');
    setEditingDsr(dsr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setEditingDsr(null);
    setError('');
    setSuccess('');
  };

  const handleAdd = () => {
    setEditingDsr(null);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="mt-5 flex flex-col gap-5">
      <DsrHeader onAdd={handleAdd} />
      <Card extra="w-full px-5 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lightPrimary text-brand-500 dark:bg-navy-700 dark:text-white">
            <MdAccessTime className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Work Hours</p>
            <p className="mt-1 text-2xl font-bold text-navy-700 dark:text-white">
              {loading ? 'Loading…' : totalWorkHours + 'Hrs: ' + String(remainingWorkMinutes).padStart(2, '0') + 'm'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Across all your reports submitted today.</p>
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700 dark:border-green-900/60 dark:bg-green-900/20 dark:text-green-300">
          {success}
        </div>
      )}

      <DsrForm editingDsr={editingDsr} saving={saving} onSubmit={handleSubmit} onCancel={handleCancel} remainingMinutes={remainingMinutes} today={today} />
      <DsrTable dsrs={todaysDsrs} loading={loading} onEdit={handleEdit} onDelete={handleDelete} onRetry={loadDsrs} />
      <DsrHistory dsrs={historyDsrs} loading={loading} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  );
}
