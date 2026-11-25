'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type RecordData = Record<string, any>;
type Props = { onClose: () => void; onCreated: () => void };
const initial = {
  firstName: '', lastName: '', officeEmail: '', personalEmail: '', password: '',
  departmentId: '', departmentName: '', roleId: '', designation: '', address: '', country: 'India', countryCode: '+91', phone: '',
  employeeCode: '', joiningDate: new Date().toISOString().slice(0, 10), status: 'active',
  salary: '0', performance: '80', managerId: '', dateOfBirth: '', addressLine2: '', city: '', state: '', postalCode: '',
  gender: '', maritalStatus: '', bloodGroup: '', alternatePhone: '', fatherName: '', motherName: '', husbandName: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
};
const defaultDepartments = ['Engineering', 'Product', 'Design', 'Marketing', 'Human Resources', 'Finance', 'Sales', 'Legal'];

async function readJson(response: Response): Promise<RecordData> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? body?.error ?? 'Request failed.';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as RecordData;
}

export default function CreateEmployeeAccount({ onClose, onCreated }: Props) {
  const [form, setForm] = useState(initial);
  const [departments, setDepartments] = useState<RecordData[]>([]);
  const [roles, setRoles] = useState<RecordData[]>([]);
  const [managers, setManagers] = useState<RecordData[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<RecordData | null>(null);
  const [qr, setQr] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const field = 'min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:focus:ring-blue-400/20 dark:[color-scheme:dark]';
  const label = 'grid min-w-0 gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-300';
  const set = (key: keyof typeof initial, value: string) => setForm(old => ({ ...old, [key]: value }));
  const isManagerRole = /\bmanager\b/i.test(form.designation);
  const departmentNames = Array.from(new Set([...defaultDepartments, ...departments.map(item => item.name).filter(Boolean)])).sort((a, b) => {
    const aDefault = defaultDepartments.indexOf(a); const bDefault = defaultDepartments.indexOf(b);
    if (aDefault >= 0 || bDefault >= 0) return (aDefault < 0 ? 99 : aDefault) - (bDefault < 0 ? 99 : bDefault);
    return a.localeCompare(b);
  });
  const managerEmployees = managers.filter(item => item.user?.role === 'manager' || /\bmanager\b/i.test(item.designation ?? ''));
  useEffect(() => {
    void Promise.all([
      apiFetch('/departments').then(readJson).then(data => setDepartments(Array.isArray(data) ? data : data?.items ?? [])).catch(() => setError('Departments could not be loaded.')),
      apiFetch('/employees').then(readJson).then(data => setManagers(Array.isArray(data) ? data : data?.items ?? [])).catch(() => { }),
      apiFetch('/roles').then(readJson).then(data => setRoles(Array.isArray(data) ? data : data?.items ?? [])).catch(() => setError('Employee roles could not be loaded.')),
    ]);
  }, []);
  const fullName = useMemo(() => `${form.firstName} ${form.lastName}`.trim(), [form.firstName, form.lastName]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const employee = await readJson(await apiFetch('/employees', {
        method: 'POST', body: JSON.stringify({
          officeEmail: form.officeEmail.trim(), personalEmail: form.personalEmail.trim() || undefined,
          password: form.password, firstName: form.firstName.trim(), lastName: form.lastName.trim(),
          employeeCode: form.employeeCode.trim(), roleId: Number(form.roleId),
          departmentId: form.departmentId ? Number(form.departmentId) : undefined,
          departmentName: form.departmentId ? undefined : form.departmentName || undefined,
          designation: form.designation.trim() || undefined, address: form.address.trim() || undefined,
          country: form.country, countryCode: form.countryCode, phone: form.phone.trim() || undefined,
          joiningDate: form.joiningDate || undefined, salary: Number(form.salary || 0),
          performance: Number(form.performance || 0), managerId: !isManagerRole && form.managerId ? Number(form.managerId) : undefined,
          dateOfBirth: form.dateOfBirth || undefined, status: form.status === 'active',
          personalDetails: {
            personalEmail: form.personalEmail.trim() || undefined, dateOfBirth: form.dateOfBirth || undefined,
            gender: form.gender || undefined, maritalStatus: form.maritalStatus || undefined,
            bloodGroup: form.bloodGroup || undefined,
            alternatePhone: form.alternatePhone || undefined, fatherName: form.fatherName || undefined,
            motherName: form.motherName || undefined, husbandName: form.husbandName || undefined,
            emergencyContactName: form.emergencyContactName || undefined,
            emergencyContactPhone: form.emergencyContactPhone || undefined, emergencyContactRelation: form.emergencyContactRelation || undefined,
          },
          addresses: form.address || form.addressLine2 || form.city || form.state || form.postalCode ? [{
            addressType: 'CURRENT', addressLine1: form.address || undefined, addressLine2: form.addressLine2 || undefined,
            city: form.city || undefined, state: form.state || undefined, country: form.country || undefined,
            postalCode: form.postalCode || undefined, isPrimary: true,
          }] : undefined,
        })
      }));
      // Photo and ID proofs are uploaded after the employee record exists.
      const failures: string[] = [];
      if (profilePhoto) {
        try {
          const body = new FormData(); body.append('file', profilePhoto);
          const response = await apiFetch(`/employees/${employee.id}/profile-image`, { method: 'POST', body });
          if (!response.ok) throw new Error();
        } catch { failures.push('profile photo'); }
      }
      for (const [type, file, number] of [
        ['PAN', panFile, panNumber.trim()],
        ['AADHAAR', aadhaarFile, aadhaarNumber.trim()],
      ] as [string, File | null, string][]) {
        if (!file) continue;
        try {
          const body = new FormData();
          body.append('file', file);
          body.append('documentType', type);
          if (number) body.append('documentNumber', number);
          const response = await apiFetch(`/employees/${employee.id}/documents`, { method: 'POST', body });
          if (!response.ok) throw new Error();
        } catch { failures.push(type === 'PAN' ? 'PAN card' : 'Aadhaar card'); }
      }
      setUploadWarning(failures.length ? `Employee created, but these could not be uploaded: ${failures.join(', ')}. You can add them later from the employee profile.` : '');
      const payload = await readJson(await apiFetch(`/employees/${employee.id}/attendance-qr`));
      const QRCode = (await import('qrcode')).default;
      setQr(await QRCode.toDataURL(JSON.stringify({ type: 'HRM_ATTENDANCE', qrToken: payload.qrToken }), { width: 260, margin: 2, errorCorrectionLevel: 'H' }));
      setCreated(employee); onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create employee.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="add-employee-title" className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-navy-700 dark:bg-navy-800 dark:text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-navy-700 dark:bg-navy-800 sm:px-7">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">HR / Admin</p><h2 id="add-employee-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{created ? 'Employee created' : 'Add New Employee or Manager'}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-700 dark:hover:text-white">×</button>
      </header>
      {created ? <div className="p-6 text-center sm:p-8"><p className="font-semibold text-emerald-700 dark:text-emerald-300">{fullName} was created successfully.</p><p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Employee ID: {created.employeeCode} · Login: {created.user?.email ?? form.officeEmail}</p><p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Login with the office email and password set in this form.</p>{uploadWarning && <p role="alert" className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{uploadWarning}</p>}{qr && <div className="mx-auto mt-5 w-fit rounded-xl border border-slate-200 p-3 dark:border-navy-700"><img src={qr} width={220} height={220} alt="Employee attendance QR" /><div className="mt-2 flex justify-center gap-2"><a href={qr} download={`${created.employeeCode}-attendance-qr.png`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Download QR</a><button type="button" onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-navy-600 dark:text-gray-200">Print</button></div></div>}<button type="button" onClick={onClose} className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Done</button></div> : <form onSubmit={submit} className="p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <label className={label}>Full name<div className="grid grid-cols-2 gap-2"><input required placeholder="First name" autoComplete="given-name" value={form.firstName} onChange={e => set('firstName', e.target.value)} className={field} /><input required placeholder="Last name" autoComplete="family-name" value={form.lastName} onChange={e => set('lastName', e.target.value)} className={field} /></div></label>
          <label className={label}>Office email (login)<input required type="email" autoComplete="username" value={form.officeEmail} onChange={e => set('officeEmail', e.target.value)} className={field} /></label>
          <label className={label}>Role<select required value={form.roleId} onChange={e => { const selectedRole = roles.find(role => String(role.id) === e.target.value); set('roleId', e.target.value); set('designation', selectedRole?.name ?? ''); if (/\bmanager\b/i.test(selectedRole?.name ?? '')) set('managerId', ''); }} className={field}><option value="">Select Role</option>{roles.filter(role => role.status !== false).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <label className={label}>Department<select required value={form.departmentId ? `id:${form.departmentId}` : `name:${form.departmentName}`} onChange={e => { const [kind, ...parts] = e.target.value.split(':'); if (kind === 'id') { set('departmentId', parts.join(':')); set('departmentName', ''); } else { set('departmentId', ''); set('departmentName', parts.join(':')); } }} className={field}><option value="name:">Select Department</option>{departmentNames.map(name => { const existing = departments.find(item => item.name.toLowerCase() === name.toLowerCase()); return <option key={name} value={existing ? `id:${existing.id}` : `name:${name}`}>{name}</option>; })}</select></label>
          <label className={`${label} sm:col-span-2`}>Address<textarea rows={2} value={form.address} onChange={e => set('address', e.target.value)} className={field} /></label>
          <label className={label}>Address line 2<input value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} className={field} /></label>
          <label className={label}>City<input value={form.city} onChange={e => set('city', e.target.value)} className={field} /></label>
          <label className={label}>State<input value={form.state} onChange={e => set('state', e.target.value)} className={field} /></label>
          <label className={label}>Postal code<input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} className={field} /></label>
          <label className={label}>Country<select value={form.country} onChange={e => set('country', e.target.value)} className={field}>{['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Other'].map(c => <option key={c}>{c}</option>)}</select></label>
          <div className="grid grid-cols-[95px_1fr] gap-2"><label className={label}>Country code<select value={form.countryCode} onChange={e => set('countryCode', e.target.value)} className={field}>{['+91', '+1', '+44', '+61', '+971', 'Other'].map(c => <option key={c}>{c}</option>)}</select></label><label className={label}>Phone number<input type="tel" autoComplete="tel-national" value={form.phone} onChange={e => set('phone', e.target.value)} className={field} /></label></div>
          <label className={label}>Employee ID<input required minLength={1} maxLength={50} value={form.employeeCode} onChange={e => set('employeeCode', e.target.value)} placeholder="Enter employee ID" className={field} /></label>
          <label className={label}>Join date<input required type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} className={field} /></label>
          <label className={label}>Status<select value={form.status} onChange={e => set('status', e.target.value)} className={field}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className={label}>Monthly Salary (₹)<input type="number" min="0" step="0.01" value={form.salary} onChange={e => set('salary', e.target.value)} className={field} /><span className="text-[10px] font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">Basic 40% · HRA 16% · Allowances 44%. Payroll deductions are calculated separately.</span></label>
          <label className={label}>Performance %<input type="number" min="0" max="100" value={form.performance} onChange={e => set('performance', e.target.value)} className={field} /></label>
          {!isManagerRole && <label className={label}>Manager<select value={form.managerId} onChange={e => set('managerId', e.target.value)} className={field}><option value="">Select Manager</option>{managerEmployees.map(item => { const title = (item.designation ?? 'Manager').replace(/\bManager\b/i, 'M'); const dept = item.department?.name; return <option key={item.id} value={item.id}>{item.firstName} {item.lastName} ({title}){dept ? ` · ${dept}` : ''}</option>; })}</select></label>}
          <label className={label}>Personal email<input type="email" autoComplete="email" value={form.personalEmail} onChange={e => set('personalEmail', e.target.value)} className={field} /></label>
          <label className={label}>Date of birth<input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} className={field} /></label>
          <label className={label}>Gender<select value={form.gender} onChange={e => set('gender', e.target.value)} className={field}><option value="">Select gender</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label>
          <label className={label}>Marital status<select value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} className={field}><option value="">Select status</option><option>Single</option><option>Married</option><option>Other</option></select></label>
          <label className={label}>Blood group<select value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} className={field}><option value="">Select blood group</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => <option key={group}>{group}</option>)}</select></label>
          <label className={label}>Alternate phone<input type="tel" value={form.alternatePhone} onChange={e => set('alternatePhone', e.target.value)} className={field} /></label>
          <label className={label}>Father name<input value={form.fatherName} onChange={e => set('fatherName', e.target.value)} className={field} /></label>
          <label className={label}>Mother name<input value={form.motherName} onChange={e => set('motherName', e.target.value)} className={field} /></label>
          <label className={label}>Husband name<input value={form.husbandName} onChange={e => set('husbandName', e.target.value)} className={field} /></label>
          <label className={label}>Emergency contact name<input value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} className={field} /></label>
          <label className={label}>Emergency contact phone<input type="tel" value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} className={field} /></label>
          <label className={label}>Emergency contact relation<input value={form.emergencyContactRelation} onChange={e => set('emergencyContactRelation', e.target.value)} className={field} /></label>
          <label className={label}>Profile photo <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">(JPG or PNG)</span><input type="file" accept="image/jpeg,image/png" onChange={e => setProfilePhoto(e.target.files?.[0] ?? null)} className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 dark:file:bg-navy-700 dark:file:text-blue-200`} />{profilePhoto && <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500 dark:text-gray-400">{profilePhoto.name}</span>}</label>
          <div className={`${label} sm:col-span-2`}>
            <span>ID proof <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">(PAN / Aadhaar — PDF, JPG or PNG)</span></span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 rounded-lg border border-slate-200 p-3 dark:border-navy-700">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-gray-300">PAN card</span>
                <input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" title="PAN must look like ABCDE1234F" className={field} />
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setPanFile(e.target.files?.[0] ?? null)} className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 dark:file:bg-navy-700 dark:file:text-blue-200`} />
                {panFile && <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500 dark:text-gray-400">{panFile.name}</span>}
              </div>
              <div className="grid gap-1.5 rounded-lg border border-slate-200 p-3 dark:border-navy-700">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-gray-300">Aadhaar card</span>
                <input value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, ''))} placeholder="123412341234" maxLength={12} inputMode="numeric" pattern="\d{12}" title="Aadhaar must be 12 digits" className={field} />
                <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setAadhaarFile(e.target.files?.[0] ?? null)} className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 dark:file:bg-navy-700 dark:file:text-blue-200`} />
                {aadhaarFile && <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500 dark:text-gray-400">{aadhaarFile.name}</span>}
              </div>
            </div>
          </div>
          {/* <label className={`${label} sm:col-span-2`}>Password (for login)<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Set a password for the employee" className={field} /><span className="font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">Employee logs in using the office email and this password.</span></label> */}
       
<label className={`${label} sm:col-span-2`}>
  Password (for login)

  <div className="relative">
    <input
      required
      minLength={8}
      type={showPassword ? "text" : "password"}
      autoComplete="new-password"
      value={form.password}
      onChange={e => set('password', e.target.value)}
      placeholder="Set a password for the employee"
      className={`${field} pr-16`}
    />

    <button
      type="button"
      onClick={() => setShowPassword(prev => !prev)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? "Hide" : "Show"}
    </button>
  </div>

  <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-gray-400">
    Employee logs in using the office email and this password.
  </span>
</label>

       
       
       
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">{error}</p>}
        <footer className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-navy-700 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 dark:border-navy-600 dark:text-gray-300 dark:hover:bg-navy-700 hover:bg-slate-50">Cancel</button><button disabled={busy} type="submit" className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Creating…' : 'Add Employee / Manager'}</button></footer>
      </form>}
    </section>
  </div>;
}
