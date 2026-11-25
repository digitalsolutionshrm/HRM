'use client';

import { DragEvent, ChangeEvent, useRef } from 'react';
import { MdFileUpload } from 'react-icons/md';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
}

const FileDropzone = ({
  onFileSelect,
  isDragging,
  setIsDragging,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onFileSelect(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif"
        onChange={handleChange}
        className="hidden"
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-[260px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition ${
          isDragging
            ? 'border-brand-500 bg-white dark:bg-navy-800'
            : 'border-gray-200 dark:border-navy-600'
        }`}
      >
        <MdFileUpload className="text-[70px] text-brand-500 dark:text-white" />

        <h4 className="mt-2 text-xl font-bold text-brand-500 dark:text-white">
          Upload Files
        </h4>

        <p className="mt-2 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
          Drag & drop your file here
        </p>

        <p className="mt-1 text-xs text-gray-500">
          or click to browse
        </p>

        <p className="mt-3 text-xs text-gray-500">
          PNG, JPG, GIF • Maximum 5 MB
        </p>
      </div>
    </>
  );
};

export default FileDropzone;
