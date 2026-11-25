'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Person = Record<string, any>;
type Props = { employee: any; onClose: () => void; onSaved: () => void };
async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) { const message = body?.message ?? 'Update failed'; throw new Error(Array.isArray(message) ? message.join(', ') : message); }
  return body?.data ?? body;
}

export default function EditEmployeeAccount({ employee, onClose, onSaved }: Props) {
  const address = employee.addresses?.find((item: Person) => item.isPrimary) ?? employee.addresses?.[0] ?? {};
  const details = employee.personalDetails ?? {};
  const [form, setForm] = useState({
    firstName: employee.firstName ?? '', lastName: employee.lastName ?? '', officeEmail: employee.user?.email ?? '', password: '',
    employeeCode: employee.employeeCode ?? '',
    designation: employee.designation ?? '', roleId: String(employee.jobRole?.id ?? ''), departmentId: String(employee.department?.id ?? ''), managerId: String(employee.manager?.id ?? ''),
    phone: employee.phone ?? '', countryCode: employee.phoneCountryCode ?? '+91', joiningDate: employee.joiningDate?.slice?.(0, 10) ?? '',
    salary: String(employee.salary ?? 0), performance: String(employee.performance ?? 80), status: employee.status === false ? 'inactive' : 'active',
    personalEmail: details.personalEmail ?? '', dateOfBirth: details.dateOfBirth?.slice?.(0, 10) ?? '', gender: details.gender ?? '',
    maritalStatus: details.maritalStatus ?? '', bloodGroup: details.bloodGroup ?? '', alternatePhone: details.alternatePhone ?? '',
    fatherName: details.fatherName ?? '', motherName: details.motherName ?? '', emergencyContactName: details.emergencyContactName ?? '',
    emergencyContactPhone: details.emergencyContactPhone ?? '', emergencyContactRelation: details.emergencyContactRelation ?? '',
    addressLine1: address.addressLine1 ?? '', addressLine2: address.addressLine2 ?? '', city: address.city ?? '', state: address.state ?? '', country: address.country ?? '', postalCode: address.postalCode ?? '',
  });
  const [departments, setDepartments] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Person[]>([]);
  const [managers, setManagers] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = useCallback((key: keyof typeof form, value: string) => setForm(old => ({ ...old, [key]: value })), []);
  const isManagerRole = /\bmanager\b/i.test(form.designation);
  const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:focus:ring-blue-400/20 dark:[color-scheme:dark]';
  const label = 'grid gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-300';
  useEffect(() => {
    void Promise.all([
      apiFetch('/departments').then(readJson).then(data => setDepartments(Array.isArray(data) ? data : data?.items ?? [])).catch(() => { }),
      apiFetch('/employees').then(readJson).then(data => setManagers(Array.isArray(data) ? data : data?.items ?? [])).catch(() => { }),
      apiFetch('/roles').then(readJson).then(data => {
        const availableRoles = Array.isArray(data) ? data : data?.items ?? [];
        setRoles(availableRoles);
        if (employee.designation) {
          const currentRole = availableRoles.find((item: Person) => item.name?.trim().toLowerCase() === employee.designation.trim().toLowerCase());
          if (currentRole) update('roleId', String(currentRole.id));
        }
      }).catch(() => setError('Employee roles could not be loaded.')),
    ]);
  }, [employee.designation, update]);
  const managerOptions = managers.filter(item => item.id !== employee.id && (item.user?.role === 'manager' || /\bmanager\b/i.test(item.designation ?? '')));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const department = departments.find(item => String(item.id) === form.departmentId);
      await readJson(await apiFetch(`/employees/${employee.id}`, {
        method: 'PATCH', body: JSON.stringify({
          firstName: form.firstName.trim(), lastName: form.lastName.trim(), officeEmail: form.officeEmail.trim(),
          ...(form.password ? { password: form.password } : {}), roleId: Number(form.roleId), designation: form.designation,
          ...(department ? { departmentId: Number(department.id) } : {}), departmentName: department ? undefined : employee.department?.name,
          employeeCode: form.employeeCode.trim(),
          phone: form.phone, countryCode: form.countryCode, joiningDate: form.joiningDate || undefined,
          salary: Number(form.salary || 0), performance: Number(form.performance || 0), status: form.status === 'active',
          managerId: !isManagerRole && form.managerId ? Number(form.managerId) : undefined, clearManager: isManagerRole || !form.managerId,
          personalEmail: form.personalEmail || undefined, dateOfBirth: form.dateOfBirth || undefined,
          personalDetails: {
            gender: form.gender || undefined, maritalStatus: form.maritalStatus || undefined, bloodGroup: form.bloodGroup || undefined,
            alternatePhone: form.alternatePhone || undefined, fatherName: form.fatherName || undefined, motherName: form.motherName || undefined,
            emergencyContactName: form.emergencyContactName || undefined, emergencyContactPhone: form.emergencyContactPhone || undefined,
            emergencyContactRelation: form.emergencyContactRelation || undefined,
          },
          addresses: [...(employee.addresses ?? []).filter((item: Person) => item.id !== address.id).map((item: Person) => ({
            addressType: item.addressType, addressLine1: item.addressLine1, addressLine2: item.addressLine2,
            city: item.city, state: item.state, country: item.country, postalCode: item.postalCode, isPrimary: item.isPrimary,
          })), {
            addressType: address.addressType ?? 'CURRENT', addressLine1: form.addressLine1 || undefined,
            addressLine2: form.addressLine2 || undefined, city: form.city || undefined, state: form.state || undefined,
            country: form.country || undefined, postalCode: form.postalCode || undefined, isPrimary: true
          }],
        })
      }));
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Employee could not be updated.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="edit-employee-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-navy-800 dark:text-white"><header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-navy-700 dark:bg-navy-800 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Employee profile</p><h2 id="edit-employee-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Edit {employee.firstName} {employee.lastName}</h2></div><button type="button" aria-label="Close" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 dark:hover:text-white">×</button></header>
    <form onSubmit={submit} className="p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2">
      <label className={label}>First name<input required value={form.firstName} onChange={e => update('firstName', e.target.value)} className={field} /></label><label className={label}>Last name<input required value={form.lastName} onChange={e => update('lastName', e.target.value)} className={field} /></label>
      <label className={label}>Office email (login)<input required type="email" value={form.officeEmail} onChange={e => update('officeEmail', e.target.value)} className={field} /></label><label className={label}>New password (optional)<input minLength={8} type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Leave blank to keep current" className={field} /></label>
      <label className={label}>Employee ID<input required maxLength={50} value={form.employeeCode} onChange={e => update('employeeCode', e.target.value)} className={field} /></label>
      <label className={label}>Designation<input required value={form.designation} onChange={e => update('designation', e.target.value)} className={field} /></label>
      <label className={label}>Role<select required value={form.roleId} onChange={e => { const selectedRole = roles.find(item => String(item.id) === e.target.value); update('roleId', e.target.value); update('designation', selectedRole?.name ?? ''); }} className={field}><option value="">Select role</option>{roles.filter(item => item.status !== false || String(item.id) === form.roleId).map(item => <option key={item.id} value={item.id}>{item.name}{item.status === false ? ' (inactive)' : ''}</option>)}</select></label>
      <label className={label}>Department<select required value={form.departmentId} onChange={e => update('departmentId', e.target.value)} className={field}><option value="">Select department</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{employee.department && !departments.some(item => item.id === employee.department.id) && <option value={employee.department.id}>{employee.department.name}</option>}</select></label>
      {!isManagerRole && <label className={label}>Manager<select value={form.managerId} onChange={e => update('managerId', e.target.value)} className={field}><option value="">No manager</option>{managerOptions.map(item => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} ({(item.designation ?? 'Manager').replace(/\bManager\b/i, 'M')}){item.department?.name ? ` · ${item.department.name}` : ''}</option>)}</select></label>}
      <label className={label}>Phone<input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={field} /></label><label className={label}>Country code<input value={form.countryCode} onChange={e => update('countryCode', e.target.value)} className={field} /></label>
      <label className={label}>Joining date<input type="date" value={form.joiningDate} onChange={e => update('joiningDate', e.target.value)} className={field} /></label><label className={label}>Status<select value={form.status} onChange={e => update('status', e.target.value)} className={field}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className={label}>Monthly Salary (₹)<input type="number" min="0" step="0.01" value={form.salary} onChange={e => update('salary', e.target.value)} className={field} /><span className="text-[10px] font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">Basic 40% · HRA 16% · Allowances 44%. Payroll deductions are calculated separately.</span></label><label className={label}>Performance %<input type="number" min="0" max="100" value={form.performance} onChange={e => update('performance', e.target.value)} className={field} /></label>
      <label className={label}>Personal email<input type="email" value={form.personalEmail} onChange={e => update('personalEmail', e.target.value)} className={field} /></label><label className={label}>Date of birth<input type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} className={field} /></label>
      <label className={label}>Gender<input value={form.gender} onChange={e => update('gender', e.target.value)} className={field} /></label><label className={label}>Marital status<input value={form.maritalStatus} onChange={e => update('maritalStatus', e.target.value)} className={field} /></label>
      <label className={label}>Blood group<input value={form.bloodGroup} onChange={e => update('bloodGroup', e.target.value)} className={field} /></label><label className={label}>Alternate phone<input type="tel" value={form.alternatePhone} onChange={e => update('alternatePhone', e.target.value)} className={field} /></label>
      <label className={label}>Address line 1<input value={form.addressLine1} onChange={e => update('addressLine1', e.target.value)} className={field} /></label><label className={label}>Address line 2<input value={form.addressLine2} onChange={e => update('addressLine2', e.target.value)} className={field} /></label>
      <label className={label}>City<input value={form.city} onChange={e => update('city', e.target.value)} className={field} /></label><label className={label}>State<input value={form.state} onChange={e => update('state', e.target.value)} className={field} /></label>
      <label className={label}>Country<input value={form.country} onChange={e => update('country', e.target.value)} className={field} /></label><label className={label}>Postal code<input value={form.postalCode} onChange={e => update('postalCode', e.target.value)} className={field} /></label>
      <label className={label}>Father name<input value={form.fatherName} onChange={e => update('fatherName', e.target.value)} className={field} /></label><label className={label}>Mother name<input value={form.motherName} onChange={e => update('motherName', e.target.value)} className={field} /></label>
      <label className={label}>Emergency contact name<input value={form.emergencyContactName} onChange={e => update('emergencyContactName', e.target.value)} className={field} /></label><label className={label}>Emergency contact phone<input value={form.emergencyContactPhone} onChange={e => update('emergencyContactPhone', e.target.value)} className={field} /></label>
      <label className={`${label} sm:col-span-2`}>Emergency contact relation<input value={form.emergencyContactRelation} onChange={e => update('emergencyContactRelation', e.target.value)} className={field} /></label>
    </div>{error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}<footer className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-navy-700"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-navy-600 dark:text-gray-300 dark:hover:bg-navy-700">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button></footer></form>
  </section></div>;
}
