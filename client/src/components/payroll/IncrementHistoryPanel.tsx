'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdAdd, MdClose, MdHistory, MdSearch, MdVisibility } from 'react-icons/md';
import Card from 'components/card';
import {
  IncrementEmployee, MONTH_NAMES, PayrollIncrement, formatCurrency, payrollApi,
} from './payroll-shared';

const localToday = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const dateLabel = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function IncrementHistoryPanel({ onClose, initialMonth, initialYear }: { onClose: () => void; initialMonth?: number; initialYear?: number }) {
  const [employees, setEmployees] = useState<IncrementEmployee[]>([]);
  const [history, setHistory] = useState<PayrollIncrement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [note, setNote] = useState('');
  const [viewEmployee, setViewEmployee] = useState<IncrementEmployee | null>(null);
  const [viewHistory, setViewHistory] = useState<PayrollIncrement[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(initialMonth ? String(initialMonth) : 'all');
  const [yearFilter, setYearFilter] = useState(initialYear ? String(initialYear) : 'all');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [employeeList, records] = await Promise.all([
        payrollApi.getIncrementEmployees(),
        payrollApi.getIncrements(),
      ]);
      setEmployees(employeeList);
      setHistory(records);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load increment information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedEmployee = employees.find((employee) => String(employee.id) === employeeId);
  const increaseAmount = Number(amount || 0);
  const increasePercent = selectedEmployee && selectedEmployee.salary > 0
    ? (increaseAmount / selectedEmployee.salary) * 100
    : 0;
  const departments = useMemo(() => Array.from(new Set(history.map((record) => record.department).filter((value): value is string => Boolean(value)))).sort(), [history]);
  const years = useMemo(() => Array.from(new Set(history.map((record) => record.effectiveDate.slice(0, 4)))).sort((a, b) => b.localeCompare(a)), [history]);
  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => `${employee.firstName} ${employee.lastName} ${employee.employeeCode} ${employee.department ?? ''}`.toLowerCase().includes(query));
  }, [employeeSearch, employees]);
  const visibleHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...history]
      .filter((record) => departmentFilter === 'all' || record.department === departmentFilter)
      .filter((record) => monthFilter === 'all' || Number(record.effectiveDate.slice(5, 7)) === Number(monthFilter))
      .filter((record) => yearFilter === 'all' || record.effectiveDate.startsWith(yearFilter))
      .filter((record) => !query || `${record.employeeName} ${record.department ?? ''}`.toLowerCase().includes(query))
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id);
  }, [departmentFilter, history, monthFilter, searchTerm, yearFilter]);
  const employeeCount = useMemo(() => new Set(history.map((record) => record.employeeId)).size, [history]);
  const openHistory = async (record: PayrollIncrement) => {
    const employee = employees.find((item) => item.id === record.employeeId) ?? {
      id: record.employeeId,
      employeeCode: '',
      firstName: record.employeeName,
      lastName: '',
      department: record.department,
      salary: record.newSalary,
    };
    setViewEmployee(employee);
    setViewHistory([]);
    setViewLoading(true);
    try {
      const records = await payrollApi.getEmployeeIncrements(record.employeeId);
      setViewHistory(records.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.id - a.id));
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : 'Could not load this employee history.');
      setViewEmployee(null);
    } finally {
      setViewLoading(false);
    }
  };

  const save = async () => {
    if (!selectedEmployee) {
      setError('Select an employee.');
      return;
    }
    if (!Number.isFinite(increaseAmount) || increaseAmount <= 0) {
      setError('Enter an increment amount greater than zero.');
      return;
    }
    if (!effectiveDate) {
      setError('Select the effective date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await payrollApi.createIncrement({
        employeeId: selectedEmployee.id,
        increaseAmount,
        effectiveDate,
        note: note.trim() || undefined,
      });
      setNotice(`${created.employeeName} salary increased by ${formatCurrency(created.increaseAmount)} (${created.increasePercent.toFixed(2)}%). New monthly salary: ${formatCurrency(created.newSalary)}.`);
      setOpen(false);
      setEmployeeId('');
      setAmount('');
      setNote('');
      setEffectiveDate('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this increment.');
    } finally {
      setSaving(false);
    }
  };

  const incrementRows = (rows: PayrollIncrement[]) => rows.map((record) => <div key={record.id} className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-gray-100 p-4 text-sm dark:border-navy-700 sm:grid-cols-3">
    <div><p className="text-xs text-gray-500 dark:text-gray-400">Effective date</p><p className="font-semibold text-navy-700 dark:text-white">{dateLabel(record.effectiveDate)}</p></div>
    <div><p className="text-xs text-gray-500 dark:text-gray-400">Previous salary</p><p>{formatCurrency(record.previousSalary)}</p></div>
    <div><p className="text-xs text-gray-500 dark:text-gray-400">New salary</p><p className="font-semibold">{formatCurrency(record.newSalary)}</p></div>
    <div><p className="text-xs text-gray-500 dark:text-gray-400">Increase amount</p><p className="font-semibold text-green-600 dark:text-green-400">+{formatCurrency(record.increaseAmount)}</p></div>
    <div><p className="text-xs text-gray-500 dark:text-gray-400">Increase percent</p><p className="font-semibold text-green-600 dark:text-green-400">{record.increasePercent.toFixed(2)}%</p></div>
    {record.note && <div className="col-span-2 sm:col-span-3"><p className="text-xs text-gray-500 dark:text-gray-400">Note</p><p>{record.note}</p></div>}
  </div>);

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-navy-900/60 p-2 sm:p-5 lg:p-8" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !open && !viewEmployee) onClose(); }}>
  <section role="dialog" aria-modal="true" aria-labelledby="increment-history-title" className="mx-auto my-2 flex min-h-[80vh] max-w-7xl flex-col gap-4 rounded-2xl bg-gray-50 p-3 shadow-2xl dark:bg-navy-900 sm:my-4 sm:p-6">
    <header className="flex items-start justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-navy-800 sm:p-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Payroll management</p><h1 id="increment-history-title" className="mt-1 text-2xl font-bold text-navy-700 dark:text-white sm:text-3xl">Salary increments</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search employees, add increments, and review each employee’s complete salary history.</p></div>
      <button type="button" aria-label="Close increment page" onClick={onClose} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-navy-700 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button>
    </header>
    <Card extra="w-full overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-navy-700 sm:flex-row sm:items-center">
        <div><h2 className="flex items-center gap-2 font-bold text-navy-700 dark:text-white"><MdHistory className="h-5 w-5" /> Increment history</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Latest increments appear first. Select View for the complete employee history.</p></div>
        <button type="button" onClick={() => { setError(''); setNotice(''); setEffectiveDate(localToday()); setOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600"><MdAdd className="h-5 w-5" /> Add increment</button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5"><div className="rounded-xl bg-brand-50 p-3 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Total increment records</p><p className="mt-1 text-xl font-bold text-navy-700 dark:text-white">{history.length}</p></div><div className="rounded-xl bg-green-50 p-3 dark:bg-navy-900"><p className="text-xs text-gray-500 dark:text-gray-400">Employees with increments</p><p className="mt-1 text-xl font-bold text-navy-700 dark:text-white">{employeeCount}</p></div><div className="col-span-2 rounded-xl bg-violet-50 p-3 dark:bg-navy-900 sm:col-span-1"><p className="text-xs text-gray-500 dark:text-gray-400">Employees available</p><p className="mt-1 text-xl font-bold text-navy-700 dark:text-white">{employees.length}</p></div></div>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_150px_130px] sm:px-5">
        <label className="relative"><span className="sr-only">Search employee or department</span><MdSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employee or department" className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
        <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]"><option value="all">All departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select>
        <select aria-label="Filter by month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]"><option value="all">All months</option>{MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select>
        <select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]"><option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
      </div>
      {notice && <div role="status" className="mx-5 mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">{notice}</div>}
      {error && <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      {loading ? <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading increments…</p>
        : visibleHistory.length === 0 ? <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{history.length ? 'No increments match these filters.' : 'No increments have been recorded yet.'}</p>
          : <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-navy-900 dark:text-gray-400">{['Employee', 'Department', 'Previous salary', 'New salary', 'Increase %', 'Increase amount', 'Effective date', ''].map((label, index) => <th key={`${label}-${index}`} className="px-5 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-navy-700">{visibleHistory.map((record) => <tr key={record.id} className="text-sm text-navy-700 dark:text-gray-200"><td className="px-5 py-4 font-semibold">{record.employeeName}</td><td className="px-5 py-4">{record.department ?? '—'}</td><td className="px-5 py-4 font-mono">{formatCurrency(record.previousSalary)}</td><td className="px-5 py-4 font-mono font-semibold">{formatCurrency(record.newSalary)}</td><td className="px-5 py-4 font-semibold text-green-600 dark:text-green-400">{record.increasePercent.toFixed(2)}%</td><td className="px-5 py-4 font-mono text-green-600 dark:text-green-400">+{formatCurrency(record.increaseAmount)}</td><td className="px-5 py-4">{dateLabel(record.effectiveDate)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => void openHistory(record)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-navy-700 dark:hover:bg-navy-700"><MdVisibility className="h-4 w-4" /> View</button></td></tr>)}</tbody></table></div>
            <div className="flex flex-col gap-3 p-4 md:hidden">{visibleHistory.map((record) => <article key={record.id} className="rounded-xl border border-gray-100 p-4 dark:border-navy-700"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-navy-700 dark:text-white">{record.employeeName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{record.department ?? '—'}</p></div><button type="button" onClick={() => void openHistory(record)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold dark:border-navy-700"><MdVisibility className="h-4 w-4" /> View</button></div><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gray-500 dark:text-gray-400">Increase</p><p className="font-semibold text-green-600 dark:text-green-400">{record.increasePercent.toFixed(2)}% · +{formatCurrency(record.increaseAmount)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Effective</p><p>{dateLabel(record.effectiveDate)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Previous salary</p><p>{formatCurrency(record.previousSalary)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">New salary</p><p className="font-semibold">{formatCurrency(record.newSalary)}</p></div></div></article>)}</div>
          </>}
    </Card>

    {open && <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="add-increment-title" className="my-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-800 sm:p-7">
      <div className="flex items-start justify-between gap-3"><div><h2 id="add-increment-title" className="text-xl font-bold text-navy-700 dark:text-white">Add salary increment</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The new monthly salary and increase percent are calculated automatically.</p></div><button type="button" aria-label="Close" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button></div>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold text-navy-700 dark:text-white">Search employee<input value={employeeSearch} onChange={(event) => { setEmployeeSearch(event.target.value); setEmployeeId(''); }} placeholder="Name, employee ID or department" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
        <label className="grid gap-1.5 text-sm font-semibold text-navy-700 dark:text-white">Employee<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white dark:[color-scheme:dark]"><option value="">Select employee ({filteredEmployees.length} matches)</option>{filteredEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeCode} · {employee.department ?? 'No department'}</option>)}</select></label>
        {selectedEmployee && <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-navy-900"><div><p className="text-xs text-gray-500 dark:text-gray-400">Current monthly salary</p><p className="font-bold text-navy-700 dark:text-white">{formatCurrency(selectedEmployee.salary)}</p></div><div><p className="text-xs text-gray-500 dark:text-gray-400">Increment percentage</p><p className="font-bold text-green-600 dark:text-green-400">{increasePercent.toFixed(2)}%</p></div></div>}
        <label className="grid gap-1.5 text-sm font-semibold text-navy-700 dark:text-white">Increment amount (₹)<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 10000" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
        {selectedEmployee && Number(amount) > 0 && <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">New monthly salary: <strong>{formatCurrency(selectedEmployee.salary + increaseAmount)}</strong></p>}
        <label className="grid gap-1.5 text-sm font-semibold text-navy-700 dark:text-white">Effective date<input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
        <label className="grid gap-1.5 text-sm font-semibold text-navy-700 dark:text-white">Note (optional)<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900 dark:text-white" /></label>
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Saving updates the employee’s monthly salary immediately. Recalculate any payroll already generated for the effective month.</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-10 rounded-xl bg-gray-100 px-4 text-sm font-semibold text-navy-700 dark:bg-navy-700 dark:text-white">Cancel</button><button type="button" disabled={saving || !selectedEmployee || Number(amount) <= 0} onClick={() => void save()} className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save increment'}</button></div>
    </section></div>}

    {viewEmployee && <div className="fixed inset-0 z-[91] flex items-center justify-center overflow-y-auto bg-navy-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewEmployee(null); }}><section role="dialog" aria-modal="true" aria-labelledby="employee-increment-history-title" className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-navy-800 sm:p-7">
      <div className="flex items-start justify-between gap-3"><div><h2 id="employee-increment-history-title" className="text-xl font-bold text-navy-700 dark:text-white">{viewEmployee.firstName} {viewEmployee.lastName}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{viewEmployee.department ?? '—'} · complete increment history</p></div><button type="button" aria-label="Close history" onClick={() => setViewEmployee(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-700"><MdClose className="h-5 w-5" /></button></div>
      <div className="mt-5 flex flex-col gap-3">{viewLoading ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading employee history…</p> : viewHistory.length === 0 ? <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No increment history for this employee.</p> : incrementRows(viewHistory)}</div>
    </section></div>}
  </section>
  </div>;
}
