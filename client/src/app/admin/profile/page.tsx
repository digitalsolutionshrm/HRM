'use client';
import Banner from 'components/admin/profile/Banner';
import General from 'components/admin/profile/General';
import Notification from 'components/admin/profile/Notification';
import Project from 'components/admin/profile/Project';
import Storage from 'components/admin/profile/Storage';
import Upload from 'components/admin/profile/Upload';
import ChangePassword from 'components/admin/profile/ChangePassword';

import { useEffect, useState, useRef } from 'react';
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
  const hasFetched = useRef(false);

  useEffect(() => {
        if (hasFetched.current) {
      return;
    }

    hasFetched.current = true;
    const getProfile = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await apiFetch('/employees/profile');
        if (!response.ok) {
          const errorData = await response.text();

          console.error('Profile API error:', errorData);

          throw new Error(
            `Failed to load profile (${response.status})`,
          );
        }
        const result = await response.json();
        const data = result?.data ?? result;

        setEmployee(data);
      } catch (error) {
        console.error('Failed to fetch employee profile:', error);

        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load employee profile',
        );
      } finally {
        setLoading(false);
      }
    };

    getProfile();
  }, []);

  return (
    <div className="flex w-full flex-col gap-5 lg:gap-5">
      <div className="w-ful mt-6 flex h-fit flex-col gap-5 lg:grid lg:grid-cols-2">
        <div className="col-span-3 lg:!mb-0 banner">
          <div className="banner">
              {employee && <Banner employee={employee} />}
            </div>
        </div>

        {/* <div className="col-span-3 lg:!mb-0 storage">
          <Storage />
        </div> */}

        <div className="z-0 col-span-3 lg:!mb-0 upload">
          <div className="upload">
              {employee && (
                <Upload
                  employeeId={employee.id}
                  profileImage={employee.profileImage}
                  onUploaded={(profileImage) =>
                    setEmployee((current) => current && { ...current, profileImage })
                  }
                />
              )}
          </div>
        </div>
      </div>
      <ChangePassword />
      {/* all project & ... */}

      <div className="mb-4 grid h-full grid-cols-1 gap-5 lg:!grid-cols-12">
        <div className="col-span-5 lg:col-span-6 lg:mb-0 3xl:col-span-4 Projects">
          <Project />
        </div>
        <div className="col-span-5 lg:col-span-6 lg:mb-0 3xl:col-span-5 General-section">
          {employee && <General employee={employee} />}
        </div>

        <div className="col-span-5 lg:col-span-12 lg:mb-0 3xl:!col-span-3 notifications">
          <Notification />
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
