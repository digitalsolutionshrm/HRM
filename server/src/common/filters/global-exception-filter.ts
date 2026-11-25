import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    GlobalExceptionFilter.name,
  );

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    /**
     * Handle NestJS HTTP exceptions
     */
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse =
        exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const errorResponse =
          exceptionResponse as {
            message?: string | string[];
          };

        if (Array.isArray(errorResponse.message)) {
          message = errorResponse.message.join(', ');
        } else if (
          typeof errorResponse.message === 'string'
        ) {
          message = errorResponse.message;
        }
      }
    }

    /**
     * Log complete error in backend terminal
     */
    this.logger.error(
      `HTTP ${request.method} ${request.url} - ${statusCode}`,
    );

    this.logger.error(
      `Message: ${message}`,
    );

    /**
     * Log original exception
     */
    if (exception instanceof Error) {
      this.logger.error(
        exception.message,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Exception: ${JSON.stringify(exception)}`,
      );
    }

    /**
     * Send clean response to frontend
     */
    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}