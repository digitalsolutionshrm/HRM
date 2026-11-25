import { apiFetch } from '@/lib/api';

export interface Dsr {
  id: number;
  date: string;
  title: string;
  description: string;
  hoursWorked: number | string;
  tasksStatus: string;
  status: string;
  employeeEditAllowed?: boolean;
  employeeEditGrantedAt?: string | null;
  employee?: {
    id: number;
    employeeCode?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface CreateDsrDto {
  date: string;
  title: string;
  description: string;
  hoursWorked: number;
  tasksStatus: string;
  status: string;
}

export function getDsrBusinessDate(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return getPart("year") + "-" + getPart("month") + "-" + getPart("day");
}

export function getEmployeeAccessibleDsrs(dsrs: Dsr[], today = getDsrBusinessDate()): Dsr[] {
  return dsrs.filter((dsr) => {
    const status = dsr.status?.toLowerCase();
    const statusEditable = !status || status === 'pending' || status === 'submitted';
    const reportDate = dsr.date.slice(0, 10);
    const canEdit = reportDate < today
      ? dsr.employeeEditAllowed === true
      : reportDate === today && statusEditable;
    const canDelete = reportDate === today && statusEditable;
    return canEdit || canDelete;
  });
}
async function getResponseData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message ?? result?.error;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || fallback);
  }
  return (result?.data ?? result) as T;
}

export async function getMyDsr(): Promise<Dsr[]> {
  const response = await apiFetch('/dsr/my');
  const data = await getResponseData<Dsr[] | { items?: Dsr[]; data?: Dsr[] }>(response, 'Failed to fetch DSRs.');
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function createDsr(data: CreateDsrDto): Promise<Dsr> {
  const response = await apiFetch('/dsr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return getResponseData<Dsr>(response, 'Failed to create DSR.');
}

export async function updateDsr(id: number, data: CreateDsrDto): Promise<Dsr> {
  const response = await apiFetch(`/dsr/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return getResponseData<Dsr>(response, 'Failed to update DSR.');
}

export async function deleteDsr(id: number): Promise<void> {
  const response = await apiFetch(`/dsr/${id}`, { method: 'DELETE' });
  if (response.status === 204) return;
  await getResponseData<unknown>(response, 'Failed to delete DSR.');
}

export async function getAllDsrs(): Promise<Dsr[]> {
  const response = await apiFetch('/dsr');
  return getResponseData<Dsr[]>(response, 'Failed to load DSRs.');
}

export async function setDsrEmployeeEditPermission(
  id: number,
  allowed: boolean,
): Promise<Dsr> {
  const response = await apiFetch('/dsr/' + id + '/employee-edit-permission', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowed }),
  });
  return getResponseData<Dsr>(response, 'Failed to update DSR edit permission.');
}