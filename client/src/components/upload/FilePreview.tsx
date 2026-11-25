'use client';

import { MdClose, MdInsertDriveFile } from 'react-icons/md';

interface FilePreviewProps {
  file: File;
  preview: string | null;
  onRemove: () => void;
  disabled?: boolean;
}

const FilePreview = ({
  file,
  preview,
  onRemove,
  disabled = false,
}: FilePreviewProps) => {
  return (
    <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-navy-700">

      <div className="flex items-center gap-4">

        {preview ? (
          <img
            src={preview}
            alt="Selected file"
            className="h-16 w-16 rounded-lg object-cover"
          />
        ) : (
          <MdInsertDriveFile className="text-4xl text-brand-500" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-navy-700 dark:text-white">
            {file.name}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="text-gray-500 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MdClose size={22} />
        </button>

      </div>
    </div>
  );
};

export default FilePreview;
