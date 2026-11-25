'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  personalEmail: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  maritalStatus: string;
  bloodGroup: string;
  alternatePhone: string;
  fatherName: string;
  motherName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
};

const emptyForm: ProfileForm = {
  firstName: '', lastName: '', phone: '', countryCode: '+91', personalEmail: '',
  dateOfBirth: '', gender: '', nationality: '', maritalStatus: '', bloodGroup: '',
  alternatePhone: '', fatherName: '', motherName: '', emergencyContactName: '',
  emergencyContactPhone: '', emergencyContactRelation: '', address: '',
  addressLine2: '', city: '', state: '', country: 'India', postalCode: '',
};

export default function ProfileCompletionGate({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => {
    const names = user?.name?.trim().split(/\s+/) ?? [];
    return { ...emptyForm, firstName: names[0] ?? '', lastName: names.slice(1).join(' ') };
  });
  const [state, setState] = useState<'loading' | 'form' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const checkProfile = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const response = await apiFetch('/employees/profile');
      if (response.ok) {
        const body = await response.json().catch(() => null);
        const profile = body?.data ?? body;
        setState(profile?.id ? 'ready' : 'form');
      } else if (response.status === 404) {
        setState('form');
      } else {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Could not check your employee profile.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check your employee profile.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void checkProfile();
  }, [checkProfile]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          countryCode: form.countryCode || undefined,
          personalEmail: form.personalEmail || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          personalDetails: {
            dateOfBirth: form.dateOfBirth || undefined,
            gender: form.gender || undefined,
            nationality: form.nationality || undefined,
            maritalStatus: form.maritalStatus || undefined,
            bloodGroup: form.bloodGroup || undefined,
            personalEmail: form.personalEmail || undefined,
            alternatePhone: form.alternatePhone || undefined,
            fatherName: form.fatherName || undefined,
            motherName: form.motherName || undefined,
            emergencyContactName: form.emergencyContactName || undefined,
            emergencyContactPhone: form.emergencyContactPhone || undefined,
            emergencyContactRelation: form.emergencyContactRelation || undefined,
          },
          addresses: form.address || form.addressLine2 || form.city || form.state || form.postalCode
            ? [{
                addressType: 'CURRENT',
                addressLine1: form.address || undefined,
                addressLine2: form.addressLine2 || undefined,
                city: form.city || undefined,
                state: form.state || undefined,
                country: form.country || undefined,
                postalCode: form.postalCode || undefined,
                isPrimary: true,
              }]
            : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.message;
        throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Could not create your profile.');
      }

      await refreshUser();
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'ready') return <>{children}</>;
  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your employee profile…</div>;
  }
  if (state === 'error') {
    return (
      <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center dark:border-navy-700 dark:bg-navy-800">
        <h1 className="text-xl font-bold text-navy-700 dark:text-white">Unable to check profile</h1>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void checkProfile()} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Try again</button>
      </section>
    );
  }

  const field = (key: keyof ProfileForm, label: string, type = 'text', required = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600 dark:text-gray-300">
      {label}
      <input
        type={type}
        required={required}
        value={form[key]}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
      />
    </label>
  );

  return (
    <main className="mx-auto max-w-4xl px-2 py-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-navy-700 dark:bg-navy-800 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-700 dark:text-white">Complete your employee profile</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">Add your personal details to continue to HRM.</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          {field('firstName', 'First name', 'text', true)}
          {field('lastName', 'Last name', 'text', true)}
          {field('phone', 'Phone number', 'tel')}
          {field('countryCode', 'Phone country code')}
          {field('personalEmail', 'Personal email', 'email')}
          {field('dateOfBirth', 'Date of birth', 'date')}
          {field('gender', 'Gender')}
          {field('nationality', 'Nationality')}
          {field('maritalStatus', 'Marital status')}
          {field('bloodGroup', 'Blood group')}
          {field('alternatePhone', 'Alternate phone', 'tel')}
          {field('fatherName', 'Father name')}
          {field('motherName', 'Mother name')}
          {field('emergencyContactName', 'Emergency contact name')}
          {field('emergencyContactPhone', 'Emergency contact phone', 'tel')}
          {field('emergencyContactRelation', 'Emergency contact relation')}
          {field('address', 'Address')}
          {field('addressLine2', 'Address line 2')}
          {field('city', 'City')}
          {field('state', 'State')}
          {field('country', 'Country')}
          {field('postalCode', 'Postal code')}
          <div className="sm:col-span-2">
            <button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving profile…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
