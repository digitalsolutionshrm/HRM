'use client';

import { useCallback, useEffect, useState } from 'react';

import Banner from 'components/admin/profile/Banner';
import General from 'components/admin/profile/General';
import Notification from 'components/admin/profile/Notification';
import Project from 'components/admin/profile/Project';
import Upload from 'components/admin/profile/Upload';

import { apiFetch } from 'lib/api';

interface Employee {
  id: number;
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  designation?: string;
  phone?: string;
  joiningDate?: string;
  status?: boolean;
  profileImage?: string | null;
  coverImage?: string | null;
}

const ProfileOverview = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getProfile = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError('');

      const response = await apiFetch('/employees/profile', {
        signal,
      });

      // Handle HTTP errors
      if (!response.ok) {
        let message = `Failed to load profile (${response.status})`;

        try {
          const errorData = await response.json();

          if (errorData?.message) {
            message = Array.isArray(errorData.message)
              ? errorData.message.join(', ')
              : errorData.message;
          }
        } catch {
          // Response was not JSON, keep default message
        }

        throw new Error(message);
      }

      // Parse response safely
      const result = await response.json();
      const data = result?.data ?? result;

      // Validate API response
      if (!data || typeof data.id !== 'number') {
        throw new Error('Invalid employee profile data received from server.');
      }

      setEmployee(data);
    } catch (error) {
      // Ignore aborted requests
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Failed to fetch employee profile:', error);

      setEmployee(null);

      setError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading your profile.',
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getProfile(controller.signal);

    return () => {
      controller.abort();
    };
  }, [getProfile]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20">
          <h3 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-300">
            Unable to load profile
          </h3>

          <p className="mb-4 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>

          <button
            type="button"
            onClick={() => getProfile()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No employee data
  if (!employee) {
    return (
      <div className="flex min-h-[300px] w-full items-center justify-center">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-navy-700 dark:bg-navy-800">
          <h3 className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-200">
            Profile Not Found
          </h3>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            We could not find your employee profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5 lg:gap-5">
      {/* Profile Banner & Upload */}
      <div className="mt-6 grid h-fit w-full grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="col-span-1 lg:col-span-2">
          <Banner employee={employee} />
        </div>

        <div className="z-0 col-span-1 lg:col-span-2">
          <Upload
            employeeId={employee.id}
            profileImage={employee.profileImage}
            onUploaded={(profileImage) =>
              setEmployee((current) => current && { ...current, profileImage })
            }
          />
        </div>
      </div>

      {/* Profile Details */}
      <div className="mb-4 grid h-full grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="col-span-1 lg:col-span-6 3xl:col-span-4">
          <Project />
        </div>

        <div className="col-span-1 lg:col-span-6 3xl:col-span-5">
          <General employee={employee} />
        </div>

        <div className="col-span-1 lg:col-span-12 3xl:col-span-3">
          <Notification />
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
