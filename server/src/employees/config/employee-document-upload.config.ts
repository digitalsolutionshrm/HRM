import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import { extname } from 'node:path';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const employeeDocumentUploadConfig = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      const destination = './private-uploads/employee-documents';
      mkdirSync(destination, { recursive: true });
      callback(null, destination);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      return callback(new Error('Only PDF, JPG and PNG documents are allowed'), false);
    }
    callback(null, true);
  },
};
