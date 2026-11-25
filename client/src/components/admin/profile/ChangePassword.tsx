'use client';

import { useState } from 'react';
import { MdLockReset } from 'react-icons/md';
import Card from 'components/card';
import { apiFetch } from '@/lib/api';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ChangePassword() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null) as
        | { message?: string | string[]; error?: string }
        | null;
      if (!response.ok) {
        const message = body?.message ?? body?.error ?? 'Could not change your password.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }

      setForm(EMPTY_FORM);
      setSuccess('Password changed successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  const update = (field: keyof PasswordForm) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  return (
    <Card extra="w-full p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <MdLockReset className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-navy-700 dark:text-white">Change password</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Enter your current password. No OTP is required.</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300">{success}</p>}

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-navy-700 dark:text-gray-200">
          Old password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.currentPassword}
            onChange={update('currentPassword')}
            className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none focus:border-brand-500 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-navy-700 dark:text-gray-200">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={form.newPassword}
              onChange={update('newPassword')}
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none focus:border-brand-500 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-navy-700 dark:text-gray-200">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-navy-700 outline-none focus:border-brand-500 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
            />
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          New password needs at least 6 characters, including uppercase, lowercase, a number, and a special character.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Changing password…' : 'Change password'}
        </button>
      </form>
    </Card>
  );
}
