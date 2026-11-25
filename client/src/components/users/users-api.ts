import { apiFetch } from '@/lib/api';

export type UserRole = 'admin' | 'hr' | 'manager' | 'employee';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: boolean;
}

export type UpdateUserData = Pick<User, 'name' | 'email' | 'role' | 'status'> & {
  password?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return (body?.data ?? body) as T;
}

export async function getUsers(): Promise<User[]> {
  const data = await readResponse<unknown>(await apiFetch('/users'));
  if (Array.isArray(data)) return data as User[];
  if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    return data.items as User[];
  }
  return [];
}

export function updateUser(id: number, data: UpdateUserData): Promise<User> {
  return apiFetch(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then(readResponse<User>);
}

export function deleteUser(id: number): Promise<{ message: string }> {
  return apiFetch(`/users/${id}`, {
    method: 'DELETE',
  }).then(readResponse<{ message: string }>);
}
