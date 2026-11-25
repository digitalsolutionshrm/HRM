'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { refreshAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type NotificationRecord = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  emailSent?: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  announcementAuthorRole?: string | null;
};

type RealtimeState = {
  notifications: NotificationRecord[];
  unreadCount: number;
  connected: boolean;
};

const Context = createContext<RealtimeState>({
  notifications: [],
  unreadCount: 0,
  connected: false,
});
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hrm-backend-m21k.onrender.com/api';

export function NotificationRealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, accessToken } = useAuth();
  const [state, setState] = useState<RealtimeState>({
    notifications: [],
    unreadCount: 0,
    connected: false,
  });
  const birthdayCheckRef = useRef('');

  useEffect(() => {
    if (!user?.id || !accessToken) {
      setState({ notifications: [], unreadCount: 0, connected: false });
      return;
    }

    const checkBirthdays = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      const birthdayCheckKey = `${user.id}:${now.toISOString().slice(0, 10)}`;
      if (birthdayCheckRef.current === birthdayCheckKey) return;
      birthdayCheckRef.current = birthdayCheckKey;
      void apiFetch('/notifications/birthdays/check', { method: 'POST' }).catch(() => undefined);
    };
    checkBirthdays();
    const birthdayTimer = window.setInterval(checkBirthdays, 60 * 60 * 1000);

    const socket: Socket = io(API_URL.replace(/\/api\/?$/, ''), {
      auth: { token: accessToken },
      withCredentials: true,
      reconnection: true,
    });

    const addOrUpdate = (item: NotificationRecord) => {
      setState((current) => ({
        ...current,
        notifications: [
          item,
          ...current.notifications.filter(
            (existing) => existing.id !== item.id,
          ),
        ].slice(0, 50),
      }));
    };

    socket.on('connect', () =>
      setState((current) => ({ ...current, connected: true })),
    );
    socket.on('disconnect', (reason: string) => {
      setState((current) => ({ ...current, connected: false }));
      if (reason === 'io server disconnect') {
        void refreshAccessToken().then((token) => {
          if (token) {
            socket.auth = { token };
            socket.connect();
          }
        });
      }
    });
    socket.on('notification:history', (items: NotificationRecord[]) => {
      setState((current) => ({ ...current, notifications: items }));
    });
    socket.on('notification:new', (item: NotificationRecord) =>
      addOrUpdate(item),
    );
    socket.on('notification:read', (item: NotificationRecord) =>
      addOrUpdate(item),
    );
    socket.on('notification:deleted', ({ id }: { id: number }) => {
      setState((current) => ({
        ...current,
        notifications: current.notifications.filter((item) => item.id !== id),
      }));
    });
    socket.on('notification:read-all', () => {
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((item) => ({
          ...item,
          isRead: true,
        })),
      }));
    });
    socket.on('notification:unread-count', ({ count }: { count: number }) => {
      setState((current) => ({ ...current, unreadCount: count }));
    });

    return () => {
      window.clearInterval(birthdayTimer);
      socket.disconnect();
    };
  }, [user?.id, accessToken]);

  const value = useMemo(() => state, [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotificationRealtime() {
  return useContext(Context);
}
