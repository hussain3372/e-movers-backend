import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { EnhancedLoggerService } from '../../common/logger/enhanced-logger.service';
import { AuditService } from '../audit/audit.service';
import { ResourceType } from './interfaces/storage.interface';
import * as path from 'path';
import * as crypto from 'crypto';

export interface FileUploadResult {
  /** Cloudinary public id — pass this back to `deleteFile`. */
  key: string;
  url: string;
  etag: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

type UploadableFile =
  | Express.Multer.File
  | { buffer: Buffer; originalname: string; mimetype: string };

/** Catch clauses are untyped; pull a stack out only when there really is one. */
function stackOf(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

/**
 * The Cloudinary SDK rejects with a plain object carrying the real diagnosis
 * (http_code, provider message). The provider wraps that as `cause`, so unwrap
 * it for the log rather than losing it.
 */
function describeCause(error: unknown): unknown {
  const cause = error instanceof Error ? error.cause : undefined;
  if (!cause) return undefined;
  if (cause instanceof Error) return cause.message;
  return cause;
}

@Injectable()
export class StorageService {
  private readonly defaultValidation: FileValidationOptions = {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
  };

  constructor(
    private storageProvider: CloudinaryStorageProvider,
    private logger: EnhancedLoggerService,
    private auditService: AuditService,
  ) {}

  async uploadFile(
    file: UploadableFile,
    folder: string,
    userId?: string,
    userEmail?: string,
    userRole?: string,
    validationOptions?: FileValidationOptions,
  ): Promise<FileUploadResult> {
    const validation = { ...this.defaultValidation, ...validationOptions };

    // Rejecting a file is the caller's mistake, so it is logged separately
    // from a genuine transfer failure — but it *is* logged, rather than
    // silently 400ing with no trace.
    try {
      this.validateFile(file, validation);
    } catch (error) {
      this.logUploadFailure(error, file, folder, 'rejected', {
        userId,
        userEmail,
        userRole,
      });
      throw error;
    }

    const fileName = this.buildFileName(file.originalname);

    try {
      const result = await this.storageProvider.upload({
        folder,
        fileName,
        body: file.buffer,
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: userId || 'anonymous',
          uploadedAt: new Date().toISOString(),
          folder,
        },
      });

      const uploadResult: FileUploadResult = {
        key: result.key,
        url: result.url,
        etag: result.etag,
        size: result.bytes,
        contentType: file.mimetype,
        uploadedAt: new Date(),
      };

      this.logger.logFileOperation('UPLOAD', result.key, result.bytes, {
        userId,
        userEmail,
        userRole,
        contentType: file.mimetype,
        folder,
      });

      if (userId) {
        await this.auditService.auditFileOperation(
          'FILE_UPLOAD',
          result.key,
          userId,
          userEmail || '',
          userRole || 'HOST',
          {
            originalName: file.originalname,
            size: result.bytes,
            contentType: file.mimetype,
            folder,
          },
        );
      }

      return uploadResult;
    } catch (error) {
      this.logUploadFailure(error, file, folder, 'failed', {
        userId,
        userEmail,
        userRole,
      });
      throw error;
    }
  }

  /**
   * Record why an upload failed, with enough detail to diagnose it from the
   * log alone: which file, which folder, who uploaded it, and the underlying
   * provider error.
   *
   * `rejected` means the file failed our own validation — the caller's
   * mistake, logged at `warn`. `failed` means the transfer itself broke, which
   * is a real fault and is logged at `error` so it reaches logs/error.log.
   * The distinction cannot be made from the exception type, because the
   * provider also surfaces Cloudinary faults as BadRequestException.
   */
  private logUploadFailure(
    error: unknown,
    file: UploadableFile,
    folder: string,
    kind: 'rejected' | 'failed',
    actor: { userId?: string; userEmail?: string; userRole?: string },
  ): void {
    const reason = error instanceof Error ? error.message : String(error);
    const verb = kind === 'rejected' ? 'rejected' : 'failed';
    const label =
      `File upload ${verb}: ${file.originalname} ` +
      `(${file.mimetype}, ${file.buffer?.length ?? 0} bytes) -> ${folder}: ${reason}`;

    const context = {
      ...actor,
      folder,
      fileName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.buffer?.length,
      metadata: { cause: describeCause(error) },
    };

    if (kind === 'rejected') {
      this.logger.warn(label, 'StorageService', context);
    } else {
      this.logger.error(label, stackOf(error), 'StorageService', context);
    }
  }

  async uploadMultipleFiles(
    files: UploadableFile[],
    folder: string,
    userId?: string,
    userEmail?: string,
    userRole?: string,
    validationOptions?: FileValidationOptions,
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(
          file,
          folder,
          userId,
          userEmail,
          userRole,
          validationOptions,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to upload file in batch: ${file.originalname}`,
          stackOf(error),
          'StorageService',
          { userId, folder },
        );
        // Continue with other files, but log the failure
      }
    }

    return results;
  }

  async downloadFile(
    key: string,
    userId?: string,
    userEmail?: string,
    userRole?: string,
    resourceType?: ResourceType,
  ) {
    try {
      const result = await this.storageProvider.download(key, resourceType);

      this.logger.logFileOperation('DOWNLOAD', key, result.body.length, {
        userId,
        userEmail,
        userRole,
        contentType: result.contentType,
      });

      if (userId) {
        await this.auditService.auditFileOperation(
          'FILE_DOWNLOAD',
          key,
          userId,
          userEmail || '',
          userRole || 'HOST',
          {
            size: result.body.length,
            contentType: result.contentType,
          },
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `File download failed: ${key}`,
        stackOf(error),
        'StorageService',
        { userId },
      );
      throw new NotFoundException(`File not found: ${key}`);
    }
  }

  /**
   * Delete an asset. Accepts either a Cloudinary public id or a full
   * Cloudinary delivery URL.
   */
  async deleteFile(
    key: string,
    userId?: string,
    userEmail?: string,
    userRole?: string,
    resourceType?: ResourceType,
  ): Promise<void> {
    const publicId = this.normalizeKey(key);

    try {
      const exists = await this.storageProvider.exists(publicId, resourceType);

      if (!exists) {
        throw new NotFoundException(`File not found: ${publicId}`);
      }

      await this.storageProvider.delete({ key: publicId, resourceType });

      this.logger.logFileOperation('DELETE', publicId, undefined, {
        userId,
        userEmail,
        userRole,
      });

      if (userId) {
        await this.auditService.auditFileOperation(
          'FILE_DELETE',
          publicId,
          userId,
          userEmail || '',
          userRole || 'HOST',
          {},
        );
      }
    } catch (error) {
      this.logger.error(
        `File deletion failed: ${publicId}`,
        stackOf(error),
        'StorageService',
        { userId },
      );
      throw error;
    }
  }

  /** Signed, time-limited delivery URL for a private/authenticated asset. */
  getSignedUrl(
    key: string,
    expiresIn = 3600,
    resourceType?: ResourceType,
  ): string {
    return this.storageProvider.getSignedUrl(
      this.normalizeKey(key),
      expiresIn,
      resourceType,
    );
  }

  async listFiles(folder: string, maxFiles = 100) {
    try {
      return await this.storageProvider.list({
        prefix: folder,
        maxResults: maxFiles,
      });
    } catch (error) {
      this.logger.error(
        `Failed to list files in folder: ${folder}`,
        stackOf(error),
        'StorageService',
      );
      throw error;
    }
  }

  async fileExists(key: string, resourceType?: ResourceType): Promise<boolean> {
    try {
      return await this.storageProvider.exists(
        this.normalizeKey(key),
        resourceType,
      );
    } catch (error) {
      this.logger.error(
        `Failed to check file existence: ${key}`,
        stackOf(error),
        'StorageService',
      );
      return false;
    }
  }

  /**
   * Resolve a stored Cloudinary URL back to its public id. Returns null when
   * the value is not a recognisable Cloudinary URL.
   */
  extractKeyFromUrl(url: string): string | null {
    return this.storageProvider.extractKeyFromUrl(url);
  }

  /** Accept a public id or a full Cloudinary URL and return the public id. */
  private normalizeKey(keyOrUrl: string): string {
    if (!/^https?:\/\//i.test(keyOrUrl)) return keyOrUrl;
    return this.storageProvider.extractKeyFromUrl(keyOrUrl) ?? keyOrUrl;
  }

  /**
   * Build a collision-free, Cloudinary-safe public id fragment.
   * Cloudinary keeps the extension out of the public id for image/video, so
   * only the base name is used here.
   */
  private buildFileName(originalName: string): string {
    const extension = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, extension);
    const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const hash = crypto.randomBytes(8).toString('hex');

    return `${timestamp}-${hash}-${sanitized}`;
  }

  private validateFile(
    file: UploadableFile,
    options: FileValidationOptions,
  ): void {
    // Check file size
    if (options.maxSize && file.buffer.length > options.maxSize) {
      throw new BadRequestException(
        `File size ${file.buffer.length} bytes exceeds maximum allowed size ${options.maxSize} bytes`,
      );
    }

    // Check MIME type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
      );
    }

    // Check file extension
    if (options.allowedExtensions) {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      if (!options.allowedExtensions.includes(fileExtension)) {
        throw new BadRequestException(
          `File extension ${fileExtension} is not allowed. Allowed extensions: ${options.allowedExtensions.join(', ')}`,
        );
      }
    }

    // Check for empty files
    if (file.buffer.length === 0) {
      throw new BadRequestException('File cannot be empty');
    }

    // Basic security check - ensure filename doesn't contain path traversal
    if (
      file.originalname.includes('..') ||
      file.originalname.includes('/') ||
      file.originalname.includes('\\')
    ) {
      throw new BadRequestException('Invalid filename');
    }
  }
}
