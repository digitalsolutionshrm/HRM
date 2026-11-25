import { apiFetch } from '@/lib/api';

export async function deleteNotification(id: number): Promise<void> {
  const response = await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
  if (response.status === 204) return;

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message ?? result?.error;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || 'Could not remove this notification. Please try again.');
  }
}
