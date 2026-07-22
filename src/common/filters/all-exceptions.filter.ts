import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request } from 'express';
import { EnhancedLoggerService } from '../logger/enhanced-logger.service';

/** Shape of the bits of the request we log. */
interface LoggableRequest extends Request {
  user?: { id?: string | number; email?: string; role?: string };
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
}

/**
 * Logs every failed request, then defers to Nest's default filter so response
 * bodies and status codes are completely unchanged.
 *
 * Without this, anything thrown outside a service's own try/catch — multer
 * rejecting an oversized or wrong-typed upload, a missing file, a validation
 * pipe failure — returned an error to the client and left no trace in the logs.
 *
 * 5xx and non-HTTP exceptions are logged at `error` (they reach logs/error.log);
 * 4xx are client mistakes and are logged at `warn`.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly logger: EnhancedLoggerService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    // Only HTTP requests carry a request object worth logging.
    if (host.getType() === 'http') {
      try {
        this.logException(exception, host);
      } catch {
        // Logging must never mask the original error.
      }
    }

    super.catch(exception, host);
  }

  private logException(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<LoggableRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.messageOf(exception);
    const label = `${request.method} ${request.originalUrl || request.url} failed with ${status}: ${message}`;

    const context = {
      userId: request.user?.id,
      userEmail: request.user?.email,
      userRole: request.user?.role,
      ipAddress: request.ip,
      status: String(status),
      metadata: {
        method: request.method,
        url: request.originalUrl || request.url,
        statusCode: status,
        ...this.uploadDetails(request),
      },
    };

    if (status >= (HttpStatus.INTERNAL_SERVER_ERROR as number)) {
      this.logger.error(
        label,
        exception instanceof Error ? exception.stack : undefined,
        'HTTP',
        context,
      );
    } else {
      this.logger.warn(label, 'HTTP', context);
    }
  }

  /**
   * Surface which file the client was trying to upload. Multer populates
   * `req.file` before its own validation runs, so this is usually present even
   * when the upload was the thing that failed.
   */
  private uploadDetails(request: LoggableRequest): Record<string, unknown> {
    const contentType = request.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) return {};

    const files: Express.Multer.File[] = [];
    if (request.file) files.push(request.file);
    if (Array.isArray(request.files)) {
      files.push(...request.files);
    } else if (request.files) {
      files.push(...Object.values(request.files).flat());
    }

    if (files.length === 0) {
      return { upload: true, uploadedFiles: 'none received' };
    }

    return {
      upload: true,
      uploadedFiles: files.map((file) => ({
        field: file.fieldname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        bytes: file.size,
      })),
    };
  }

  private messageOf(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      const body = response as { message?: unknown };
      if (Array.isArray(body.message)) return body.message.join('; ');
      if (typeof body.message === 'string') return body.message;
      return exception.message;
    }
    if (exception instanceof Error) return exception.message;
    return 'Unknown error';
  }
}
