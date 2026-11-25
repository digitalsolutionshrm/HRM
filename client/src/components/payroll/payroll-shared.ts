import { apiFetch } from '@/lib/api';

export type PayrollStatus = 'PENDING' | 'PROCESSED' | 'PAID';

export interface PayrollRecord {
  id: number;
  employeeId: number;
  employee?: {
    id: number;
    employeeCode?: string;
    firstName?: string;
    lastName?: string;
    designation?: string | null;
    department?: string | null;
  };
  month: number;
  year: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  overtime: number;
  overtimeHours: number;
  grossSalary: number;
  pf: number;
  esi: number;
  tax: number;
  attendanceDeductions: number;
  leaveDeductions: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  attendanceDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  status: PayrollStatus;
  paymentDate: string | null;
  isApproved: boolean;
  approvedAt: string | null;
  approvedByUserId: number | null;
}

export interface IncrementEmployee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department: string | null;
  salary: number;
}

export interface PayrollIncrement {
  id: number;
  employeeId: number;
  employeeName: string;
  department: string | null;
  previousSalary: number;
  newSalary: number;
  increaseAmount: number;
  increasePercent: number;
  effectiveDate: string;
  note: string | null;
  createdByUserId: number;
  createdAt: string;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'HRM';

export const PAYROLL_STATUSES: PayrollStatus[] = ['PENDING', 'PROCESSED', 'PAID'];

export function formatCurrency(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
  return `₹${Math.round(amount)}`;
}

export function periodLabel(record: Pick<PayrollRecord, 'month' | 'year'>): string {
  return `${MONTH_NAMES[record.month - 1] ?? record.month} ${record.year}`;
}

export function employeeName(record: PayrollRecord): string {
  const name = [record.employee?.firstName, record.employee?.lastName].filter(Boolean).join(' ');
  return name || `Employee #${record.employeeId}`;
}

export function statusStyle(status: PayrollStatus): string {
  if (status === 'PAID') return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (status === 'PROCESSED') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

export function statusLabel(status: PayrollStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function unwrap<T>(result: any): T {
  return (result?.data ?? result) as T;
}

export async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message ?? result?.error ?? fallback;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return unwrap<T>(result);
}

export async function request<T>(endpoint: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await apiFetch(endpoint, init);
  return readResponse<T>(response, fallback);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const payrollApi = {
  getAll: () => request<PayrollRecord[]>('/payroll', { method: 'GET' }, 'Could not load payroll.'),
  getManaged: () => request<PayrollRecord[]>('/payroll/managed', { method: 'GET' }, 'Could not load your team payroll.'),
  getMine: () => request<PayrollRecord[]>('/payroll/my', { method: 'GET' }, 'Could not load your payroll.'),
  processAll: (month: number, year: number) =>
    request<{ month: number; year: number; created: number; existing: number; skipped: number; payrolls: PayrollRecord[] }>(
      '/payroll/process', json('POST', { month, year }), 'Could not process payroll.',
    ),
  setStatus: (id: number, status: PayrollStatus) =>
    request<PayrollRecord>(`/payroll/${id}/status`, json('PATCH', { status }), 'Could not update the payroll status.'),
  approvePayslip: (id: number) =>
    request<PayrollRecord>(`/payroll/${id}/approval`, json('PATCH'), 'Could not approve this payslip.'),
  recalculate: (id: number) =>
    request<PayrollRecord>(`/payroll/${id}`, json('PATCH', { recalculate: true }), 'Could not recalculate this payroll.'),
  setBonus: (id: number, bonus: number) =>
    request<PayrollRecord>(`/payroll/${id}/bonus`, json('PATCH', { bonus }), 'Could not update this bonus.'),
  getIncrementEmployees: () => request<IncrementEmployee[]>('/payroll/increment-employees', { method: 'GET' }, 'Could not load employees.'),
  getIncrements: () => request<PayrollIncrement[]>('/payroll/increments', { method: 'GET' }, 'Could not load increment history.'),
  getEmployeeIncrements: (employeeId: number) => request<PayrollIncrement[]>(`/payroll/increments/employee/${employeeId}`, { method: 'GET' }, 'Could not load this employee history.'),
  createIncrement: (payload: { employeeId: number; increaseAmount: number; effectiveDate: string; note?: string }) =>
    request<PayrollIncrement>('/payroll/increments', json('POST', payload), 'Could not save this increment.'),
  remove: async (id: number) => {
    const response = await apiFetch(`/payroll/${id}`, { method: 'DELETE' });
    if (response.status !== 204) await readResponse<unknown>(response, 'Could not delete this payroll.');
  },
};

/** Dynamically loads the PDF renderer (browser only) and downloads the payslip. */
export async function downloadPayslip(record: PayrollRecord): Promise<void> {
  if (!record.isApproved) throw new Error('This payslip is waiting for HR/Admin approval.');
  const { generatePayslipPdf } = await import('./payslip-pdf');
  const blob = await generatePayslipPdf({
    companyName: COMPANY_NAME,
    employeeName: employeeName(record),
    employeeCode: record.employee?.employeeCode ?? String(record.employeeId),
    department: record.employee?.department ?? '—',
    designation: record.employee?.designation ?? '',
    month: MONTH_NAMES[record.month - 1] ?? String(record.month),
    year: record.year,
    basicSalary: record.basicSalary,
    hra: record.hra,
    bonus: record.bonus,
    allowances: record.allowances,
    overtime: record.overtime,
    overtimeHours: record.overtimeHours,
    grossSalary: record.grossSalary,
    pf: record.pf,
    esi: record.esi,
    tax: record.tax ?? 0,
    attendanceDeductions: record.attendanceDeductions,
    leaveDeductions: record.leaveDeductions,
    otherDeductions: record.otherDeductions,
    totalDeductions: record.totalDeductions,
    netSalary: record.netSalary,
    attendanceDays: record.attendanceDays,
    absentDays: record.absentDays,
    halfDays: record.halfDays,
    leaveDays: record.leaveDays,
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Payslip_${employeeName(record).replace(/\s+/g, '_')}_${MONTH_SHORT[record.month - 1]}_${record.year}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
