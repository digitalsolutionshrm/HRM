'use client';

import React, { ReactNode } from 'react';
import dynamic from 'next/dynamic';

import '@/styles/App.css';
import '@/styles/Contact.css';
import '@/styles/MiniCalendar.css';
import '@/styles/index.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationRealtimeProvider } from '@/contexts/NotificationRealtimeContext';
import CelebrationOverlay from '@/components/notifications/CelebrationOverlay';

const NoSSRContent = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

const NoSSR = dynamic(() => Promise.resolve(NoSSRContent), {
  ssr: false,
});

export default function AppWrappers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationRealtimeProvider>
        <NoSSR>
          <CelebrationOverlay />
          {children}
        </NoSSR>
      </NotificationRealtimeProvider>
    </AuthProvider>
  );
}
