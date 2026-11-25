import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { bootstrapDatabase } from './database/database-bootstrap';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception-filter';
import { ResponseInterceptor } from './common/interceptors/response/interceptor';
import * as express from 'express';
import cookieParser from 'cookie-parser';

async function bootstrap() {

const app = await NestFactory.create(AppModule); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

  app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
);

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.ALL }],
  });
  // Origins must be compared without a trailing slash: browsers send the
  // Origin header as the bare scheme+host (e.g. https://digital-hrm.com).
  const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase();

  const allowedOrigins = [
    'https://digital-hrm.com',
    'https://www.digital-hrm.com',
    'http://localhost:3001'
  ].map(normalizeOrigin);

  // Local development: the Next.js dev/start server runs on port 3001.
  // Render sets NODE_ENV=production, so these are never allowed in production.
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // 'https://hrm-backend-m21k.onrender.com'
    );
  }

  const vercelPreviewOrigin =
    /^https:\/\/hrm-frontend[a-z0-9-]*\.vercel\.app$/;

    app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(normalizeOrigin(origin)) ||
        vercelPreviewOrigin.test(normalizeOrigin(origin))
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: [
                'GET',
                'HEAD',
                'PUT',
                'PATCH',
                'POST',
                'DELETE',
                'OPTIONS',
              ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
    credentials: true,
  });

  app.use(
    '/uploads',
    express.static('uploads'),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
  );

  app.useGlobalInterceptors(
    new ResponseInterceptor(),
  );
 
  await bootstrapDatabase(app.get(DataSource));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();