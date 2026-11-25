'use client';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    // 1. User is NOT logged in
    if (!user) {
      router.replace(
        `/auth/login?redirect=${encodeURIComponent(pathname)}`,
      );
      return;
    }

    // 2. Check allowedRoles prop
    // Example: <ProtectedRoute allowedRoles={['admin']}>
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(user.role)
    ) {
      router.replace('/unauthorized');
      return;
    }

    // 3. If allowedRoles is provided and user has permission,
    // don't redirect based on role.
    if (allowedRoles && allowedRoles.length > 0) {
      return;
    }

    // 4. No allowedRoles prop → redirect based on user's role
    if (user.role === 'admin') {
      if (!pathname.startsWith('/admin')) {
        router.replace('/admin');
      }
      return;
    }

    if (user.role === 'hr') {
      if (!pathname.startsWith('/hr')) {
        router.replace('/hr');
      }
      return;
    }

    if (user.role === 'manager') {
      if (!pathname.startsWith('/manager')) {
        router.replace('/manager');
      }
      return;
    }

    if (user.role === 'employee') {
      if (!pathname.startsWith('/employee')) {
        router.replace('/employee');
      }
      return;
    }
  }, [
    user,
    isLoading,
    allowedRoles,
    pathname,
    router,
  ]);

  // While checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Checking authentication...</p>
      </div>
    );
  }

  // User is NOT logged in
  if (!user) {
    return null;
  }

  // User doesn't have permission
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return null;
  }

  return <>{children}</>;
}

