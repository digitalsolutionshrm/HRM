'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  MdCampaign,
  MdDeleteOutline,
  MdDoneAll,
  MdNotificationsNone,
  MdSend,
} from 'react-icons/md';
import api from '@/lib/api';
import { deleteNotification } from './notifications-api';
import { useNotificationRealtime } from '@/contexts/NotificationRealtimeContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  emailSent?: boolean;
  url?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  announcementAuthorRole?: string | null;
};

function authorRoleLabel(role?: string | null) {
  if (role?.toLowerCase() === 'admin') return 'Admin';
  if (role?.toLowerCase() === 'hr') return 'HR';
  if (role?.toLowerCase() === 'manager') return 'Manager';
  return 'Unknown sender';
}

function getItems(responseData: any): NotificationItem[] {
  const payload = responseData?.data ?? responseData;
  return Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : [];
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementNotice, setAnnouncementNotice] = useState('');
  const realtime = useNotificationRealtime();
  const canPostAnnouncement = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const audienceLabel = user?.role === 'manager' ? 'Your direct reports only' : 'Everyone in the company';

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications', {
        params: { page: 1, limit: 50 },
      });
      setItems(getItems(response.data));
    } catch {
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (realtime.connected) setItems(realtime.notifications);
  }, [realtime.connected, realtime.notifications]);

  const markAsRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
    } catch {
      setError('Could not update this notification. Please try again.');
    }
  };

  const removeNotification = async (notification: NotificationItem) => {
    setRemovingId(notification.id);
    setError('');
    try {
      await deleteNotification(notification.id);
      setItems((current) =>
        current.filter((item) => item.id !== notification.id),
      );
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'Could not remove this notification. Please try again.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      setError('Could not mark notifications as read. Please try again.');
    }
  };

  const postAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostingAnnouncement(true);
    setError('');
    setAnnouncementNotice('');
    try {
      const response = await api.post('/notifications/announcements', {
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
      });
      const result = response.data?.data ?? response.data;
      const created = Number(result?.created ?? 0);
      setAnnouncementNotice(`Announcement sent to ${created} ${created === 1 ? 'person' : 'people'}.`);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    } catch (postError: any) {
      const message = postError?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Could not post announcement. Please try again.');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const unreadCount = realtime.connected
    ? realtime.unreadCount
    : items.filter((item) => !item.isRead).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-1 pb-10">
      <header className="border-slate-200 rounded-2xl border bg-white p-6 shadow-sm dark:border-navy-700 dark:bg-navy-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-700 dark:text-white">
              Notifications
            </h1>
            <p className="text-slate-500 mt-1 text-sm dark:text-gray-400">
              Leave requests, DSR submissions, and attendance updates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
              {unreadCount} unread
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-400/10"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>
      </header>

      {canPostAnnouncement && (
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-800 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"><MdCampaign className="h-5 w-5" /></span>
              <div><h2 className="text-lg font-bold text-navy-700 dark:text-white">Create announcement</h2><p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Share an update with the right people.</p></div>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">Audience · {audienceLabel}</span>
          </div>
          <form onSubmit={(event) => void postAnnouncement(event)} className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium text-navy-700 dark:text-gray-200">Title<input required maxLength={160} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Announcement title" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-navy-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-navy-700 dark:text-gray-200">Message<textarea required maxLength={4000} rows={3} value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} placeholder="Write the details for your announcement" className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-navy-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-gray-400">{user?.role === 'manager' ? 'Only active employees reporting directly to you will receive this.' : 'All active company users will receive this announcement.'}</p><button type="submit" disabled={postingAnnouncement || !announcementTitle.trim() || !announcementMessage.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><MdSend />{postingAnnouncement ? 'Sending…' : 'Send announcement'}</button></div>
          </form>
          {announcementNotice && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:bg-green-400/10 dark:text-green-200">{announcementNotice}</p>}
        </section>
      )}

      {!realtime.connected && !loading && (
        <p role="status" className="text-slate-500 text-sm dark:text-gray-400">
          Live updates are reconnecting. Saved notifications remain available.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <section className="border-slate-200 overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-navy-700 dark:bg-navy-800">
        {loading ? (
          <p className="text-slate-500 p-8 text-center text-sm dark:text-gray-400">
            Loading notifications…
          </p>
        ) : items.length === 0 ? (
          <div className="text-slate-500 flex flex-col items-center gap-2 p-12 text-center dark:text-gray-400">
            <MdNotificationsNone className="text-4xl" />
            <p className="font-semibold">You’re all caught up</p>
            <p className="text-sm">New HRM updates will appear here.</p>
          </div>
        ) : (
          <ul className="divide-slate-100 divide-y dark:divide-navy-700">
            {items.map((item) => (
              <li key={item.id}>
                <div
                  className={`flex items-start gap-3 p-4 sm:gap-4 sm:p-5 ${
                    item.isRead ? '' : 'bg-blue-50/50 dark:bg-blue-400/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void markAsRead(item)}
                    aria-label={`Mark ${item.title} as read`}
                    className="flex min-w-0 flex-1 items-start gap-4 text-left"
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.isRead
                          ? 'bg-slate-300 dark:bg-navy-500'
                          : 'bg-blue-600'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-navy-700 dark:text-white">
                          {item.title}
                        </span>
                        <time
                          className="text-slate-500 text-xs dark:text-gray-400"
                          dateTime={item.createdAt}
                        >
                          {new Date(item.createdAt).toLocaleString()}
                        </time>
                      </span>
                      <span className="text-slate-600 mt-1 block whitespace-pre-line text-sm dark:text-gray-300">
                        {item.message}
                      </span>
                      {item.relatedEntityType === 'ANNOUNCEMENT' && (
                        <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
                          Posted by {authorRoleLabel(item.announcementAuthorRole ?? item.relatedEntityId)}
                        </span>
                      )}
                      <span className="text-slate-400 mt-2 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide dark:text-gray-500">
                        {item.type.replaceAll('_', ' ')}
                        {item.isRead && <MdDoneAll aria-label="Read" />}
                        {item.emailSent && <span>· Email sent</span>}
                      </span>
                    </span>
                  </button>
                  {item.url && (
                    <Link
                      href={item.url}
                      onClick={() => void markAsRead(item)}
                      className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline dark:text-blue-200"
                    >
                      View details
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeNotification(item)}
                    disabled={removingId === item.id}
                    aria-label={`Remove ${item.title}`}
                    title="Remove notification"
                    className="text-slate-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                  >
                    <MdDeleteOutline className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
