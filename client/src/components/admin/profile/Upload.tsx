"use client";

import { useEffect, useRef, useState } from "react";
import { MdFileUpload } from "react-icons/md";

import Card from "components/card";
import api from "lib/api";
import { getMediaUrl } from "@/lib/media-url";

interface UploadProps {
  employeeId: number;
  profileImage?: string | null;
  onUploaded: (profileImage: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const Upload = ({ employeeId, profileImage, onUploaded }: UploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const currentImage = profileImage ? getMediaUrl(profileImage) : null;
https://hrm-backend-m21k.onrender.com
  /**
   * Cleanup preview URL when component unmounts
   */
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  /**
   * Handle file selection
   */
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError("Please select a valid image (PNG, JPG, GIF or WEBP).");

      event.target.value = "";
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("Image size must be less than 5 MB.");

      event.target.value = "";
      return;
    }

    // Remove previous preview URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const imageUrl = URL.createObjectURL(file);

    previewUrlRef.current = imageUrl;

    setSelectedFile(file);
    setPreview(imageUrl);
  };

  /**
   * Upload profile image
   */
  const handleUpload = async () => {
    if (!employeeId) {
      setError("Employee ID is missing.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a profile image first.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("file", selectedFile);



      const response = await api.post(
        `/employees/${employeeId}/profile-image`,
        formData,
      );
      const result = response.data?.data ?? response.data;
      if (typeof result?.profileImage !== "string") {
        throw new Error("The server did not return the saved profile image.");
      }
      onUploaded(result.profileImage);

      setSuccess("Profile image uploaded successfully.");

      // Clear selected file
      setSelectedFile(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreview(null);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Profile image upload error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to upload profile image.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Open file selector
   */
  const handleSelectImage = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  return (
    <Card className="grid h-full w-full grid-cols-1 gap-3 rounded-[20px] bg-white bg-clip-border p-3 font-dm shadow-3xl shadow-shadow-500 dark:!bg-navy-800 dark:shadow-none 2xl:grid-cols-11">
      {/* Upload Area */}
      <div className="col-span-5 h-full w-full rounded-xl bg-lightPrimary dark:!bg-navy-700 2xl:col-span-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={handleSelectImage}
          disabled={isUploading}
          className="flex h-full min-h-[250px] w-full flex-col items-center justify-center rounded-xl border-[2px] border-dashed border-gray-200 py-3 transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-70 dark:!border-navy-700"
        >
          {preview ? (
            <>
              <img
                src={preview}
                alt="Profile preview"
                className="mb-3 h-28 w-28 rounded-full object-cover"
              />

              <h4 className="text-xl font-bold text-brand-500 dark:text-white">
                Change Profile Image
              </h4>

              <p className="mt-2 max-w-[90%] truncate text-sm font-medium text-gray-600 dark:text-gray-300">
                {selectedFile?.name}
              </p>
            </>
          ) : (
            <>
              {currentImage ? (
                <img
                  src={currentImage}
                  alt="Current profile"
                  className="mb-3 h-28 w-28 rounded-full object-cover"
                />
              ) : (
                <MdFileUpload className="text-[80px] text-brand-500 dark:text-white" />
              )}

              <h4 className="text-xl font-bold text-brand-500 dark:text-white">
                {currentImage ? "Change Profile Image" : "Upload Profile Image"}
              </h4>

              <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                PNG, JPG, GIF or WEBP
              </p>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Maximum size: 5 MB
              </p>
            </>
          )}
        </button>
      </div>

      {/* Information / Upload */}
      <div className="col-span-5 flex h-full w-full flex-col justify-center overflow-hidden rounded-xl bg-white pl-3 pb-4 dark:!bg-navy-800">
        <h4 className="text-left text-xl font-bold leading-9 text-navy-700 dark:text-white">
          Profile Image
        </h4>

        <p className="mt-2 text-base font-normal text-gray-600 dark:text-gray-300">
          Upload a professional profile image. This image will be displayed
          across your employee profile.
        </p>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
            {success}
          </div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="linear mt-4 flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2 text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload Profile Image"}
        </button>
      </div>
    </Card>
  );
};

export default Upload;
