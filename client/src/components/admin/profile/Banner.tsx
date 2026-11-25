'use client';


import { useEffect, useRef, useState } from 'react';
import avatar from '/public/img/avatars/avatar11.png';
import banner from '/public/img/profile/banner.png';
import Card from 'components/card';
import Image from 'next/image';
import { MdAddPhotoAlternate, MdDeleteOutline, MdSave } from 'react-icons/md';
import { apiFetch } from '@/lib/api';
import { getMediaUrl } from '@/lib/media-url';


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
interface BannerProps {
  employee: Employee;
}



const Banner = ({ employee }: BannerProps) => {
const [coverImage, setCoverImage] = useState(employee.coverImage ?? null);
const [coverPreview, setCoverPreview] = useState<string | null>(null);
const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<File | null>(null);
const [coverPhotoBusy, setCoverPhotoBusy] = useState(false);
const [coverPhotoError, setCoverPhotoError] = useState('');
const [coverPhotoSuccess, setCoverPhotoSuccess] = useState('');
const coverPhotoInput = useRef<HTMLInputElement>(null);
const coverPreviewRef = useRef<string | null>(null);

useEffect(() => {
  setCoverImage(employee.coverImage ?? null);
}, [employee.coverImage]);

useEffect(() => {
  return () => {
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
  };
}, []);

const profileImage = employee?.profileImage
  ? getMediaUrl(employee.profileImage)
  : avatar;
const coverImageUrl = coverImage ? getMediaUrl(coverImage) : null;

  const fullName =
    `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() ||
    'Employee';

  const handleCoverPhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverPhotoError('');
    setCoverPhotoSuccess('');
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setCoverPhotoError('Choose a JPG, PNG, GIF or WEBP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverPhotoError('Cover photo must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }

    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    coverPreviewRef.current = previewUrl;
    setSelectedCoverPhoto(file);
    setCoverPreview(previewUrl);
  };

  const handleCoverPhotoSave = async () => {
    if (!selectedCoverPhoto) return;

    try {
      setCoverPhotoBusy(true);
      setCoverPhotoError('');
      setCoverPhotoSuccess('');
      const formData = new FormData();
      formData.append('file', selectedCoverPhoto);
      const response = await apiFetch('/employees/profile/cover-image', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.message ?? result?.error ?? 'Cover photo upload failed.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }

      const data = result?.data ?? result;
      if (typeof data?.coverImage !== 'string') {
        throw new Error('The server did not return the saved cover photo.');
      }
      setCoverImage(data.coverImage);
      setSelectedCoverPhoto(null);
      setCoverPreview(null);
      setCoverPhotoSuccess('Cover photo updated.');
      if (coverPhotoInput.current) coverPhotoInput.current.value = '';
    } catch (error) {
      setCoverPhotoError(error instanceof Error ? error.message : 'Cover photo upload failed.');
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  const handleCoverPhotoDelete = async () => {
    if (!coverImage || !window.confirm('Remove your cover photo?')) return;

    try {
      setCoverPhotoBusy(true);
      setCoverPhotoError('');
      setCoverPhotoSuccess('');
      const response = await apiFetch('/employees/profile/cover-image', {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.message ?? result?.error ?? 'Cover photo removal failed.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      setCoverImage(null);
      setCoverPhotoSuccess('Cover photo removed.');
    } catch (error) {
      setCoverPhotoError(error instanceof Error ? error.message : 'Cover photo removal failed.');
    } finally {
      setCoverPhotoBusy(false);
    }
  };

  return (
    <Card extra="items-center w-full h-full p-[16px] bg-cover">

      {/* Background and profile */}
      <div
        className="relative mt-1 flex h-32 w-full justify-center rounded-xl bg-cover"
        style={{
          backgroundImage: `url("${coverPreview ?? coverImageUrl ?? banner.src}")`,
          backgroundPosition: 'center',
        }}
      >
        <input
          ref={coverPhotoInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleCoverPhotoSelect}
        />
        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={coverPhotoBusy}
            onClick={() => coverPhotoInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-navy-700 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MdAddPhotoAlternate className="h-4 w-4" />
            {coverImage || coverPreview ? 'Change cover' : 'Add cover photo'}
          </button>
          {selectedCoverPhoto && (
            <>
              <button
                type="button"
                disabled={coverPhotoBusy}
                onClick={() => void handleCoverPhotoSave()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MdSave className="h-4 w-4" />
                {coverPhotoBusy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={coverPhotoBusy}
                onClick={() => {
                  setCoverPreview(null);
                  setSelectedCoverPhoto(null);
                  setCoverPhotoError('');
                  if (coverPhotoInput.current) coverPhotoInput.current.value = '';
                }}
                className="rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-navy-700 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          )}
          {coverImage && !selectedCoverPhoto && (
            <button
              type="button"
              disabled={coverPhotoBusy}
              onClick={() => void handleCoverPhotoDelete()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-red-600 shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MdDeleteOutline className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
        {coverPhotoError && (
          <p role="alert" className="absolute bottom-2 left-2 max-w-[70%] rounded-lg bg-red-600/95 px-3 py-1.5 text-xs font-medium text-white">
            {coverPhotoError}
          </p>
        )}
        {coverPhotoSuccess && !coverPhotoError && (
          <p role="status" className="absolute bottom-2 left-2 rounded-lg bg-green-700/95 px-3 py-1.5 text-xs font-medium text-white">
            {coverPhotoSuccess}
          </p>
        )}
        <div className="absolute -bottom-12 flex h-[87px] w-[87px] items-center justify-center rounded-full border-[4px] border-white bg-pink-400 dark:!border-navy-700">
          <Image
            width={87}
            height={87}
            className="h-full w-full rounded-full"
             src={profileImage}
            alt="Employee avatar"
          />
        </div>
      </div>

      {/* Name and position */}
      <div className="mt-16 flex flex-col items-center">
        <h4 className="text-xl font-bold text-navy-700 dark:text-white">
          {fullName}
        </h4>

        <h5 className="text-base font-normal text-gray-600 dark:text-gray-300">
          {employee.designation || 'Employee'}
        </h5>
      </div>

      {/* Employee information */}
      <div className="mb-3 mt-6 flex gap-4 md:!gap-14">

        {/* Employee Code */}
        <div className="flex flex-col items-center justify-center">
          <h4 className="text-2xl font-bold text-navy-700 dark:text-white">
            {employee.employeeCode || '-'}
          </h4>

          <p className="text-sm font-normal text-gray-600 dark:text-gray-300">
            Employee Code
          </p>
        </div>

        {/* Status */}
        {/* <div className="flex flex-col items-center justify-center">
          <h4 className="text-2xl font-bold text-navy-700 dark:text-white">
            {employee.status ? 'Active' : 'Inactive'}
          </h4>

          <p className="text-sm font-normal text-gray-600 dark:text-gray-300">
            Status
          </p>
        </div> */}

        {/* Joining Date */}
        <div className="flex flex-col items-center justify-center">
          <h4 className="text-2xl font-bold text-navy-700 dark:text-white">
            {employee.joiningDate
              ? new Date(employee.joiningDate).toLocaleDateString()
              : '-'}
          </h4>

          <p className="text-sm font-normal text-gray-600 dark:text-gray-300">
            Joining Date
          </p>
        </div>

      </div>
    </Card>
  );
};

export default Banner;