import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'node:path';

const allowedTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/gif', new Set(['.gif'])],
  ['image/webp', new Set(['.webp'])],
]);

export const coverImageUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      const destination = './uploads/cover-images';
      mkdirSync(destination, { recursive: true });
      callback(null, destination);
    },
    filename: (_req, file, callback) => {
      callback(null, `cover-${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const extensions = allowedTypes.get(file.mimetype);
    if (!extensions?.has(extension)) {
      return callback(
        new BadRequestException('Only JPG, PNG, GIF and WEBP images are allowed'),
        false,
      );
    }
    callback(null, true);
  },
};
