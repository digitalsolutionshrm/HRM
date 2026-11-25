import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const profileImageUploadConfig = {
  storage: memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },

  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Only JPG, PNG, GIF and WEBP images are allowed',
        ),
        false,
      );
    }

    callback(null, true);
  },
};