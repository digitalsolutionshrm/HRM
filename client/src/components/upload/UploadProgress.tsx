'use client';

interface UploadProgressProps {
  progress: number;
}

const UploadProgress = ({ progress }: UploadProgressProps) => {
  return (
    <div className="mt-4 w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Uploading...
        </span>

        <span className="text-sm font-semibold text-brand-500">
          {progress}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-navy-700">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default UploadProgress;