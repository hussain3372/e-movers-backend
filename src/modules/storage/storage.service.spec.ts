import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { EnhancedLoggerService } from '../../common/logger/enhanced-logger.service';
import { AuditService } from '../audit/audit.service';

const CLOUD = 'e-movers';

function makeFile(
  overrides: Partial<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }> = {},
) {
  return {
    buffer: Buffer.from('hello world'),
    originalname: 'photo.png',
    mimetype: 'image/png',
    ...overrides,
  };
}

function makeLogger(): EnhancedLoggerService {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logFileOperation: jest.fn(),
  } as unknown as EnhancedLoggerService;
}

describe('StorageService', () => {
  let service: StorageService;
  let provider: jest.Mocked<CloudinaryStorageProvider>;
  let audit: { auditFileOperation: jest.Mock };

  beforeEach(() => {
    // A real provider instance, used only for its URL parser so that key
    // handling is exercised end to end rather than stubbed.
    const parser = new CloudinaryStorageProvider(
      {
        get: (key: string) =>
          ({
            CLOUDINARY_CLOUD_NAME: CLOUD,
            CLOUDINARY_API_KEY: '123456789012345',
            CLOUDINARY_API_SECRET: 'test-secret',
          })[key],
      } as unknown as ConfigService,
      makeLogger(),
    );

    provider = {
      upload: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      exists: jest.fn(),
      getSignedUrl: jest.fn(),
      extractKeyFromUrl: jest.fn((url: string) =>
        parser.extractKeyFromUrl(url),
      ),
    } as unknown as jest.Mocked<CloudinaryStorageProvider>;

    const logger = makeLogger();

    audit = { auditFileOperation: jest.fn() };

    service = new StorageService(
      provider,
      logger,
      audit as unknown as AuditService,
    );
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      provider.upload.mockResolvedValue({
        key: 'posters/2026-07-22T09-30-00-000Z-deadbeef-photo',
        url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/posters/2026-07-22T09-30-00-000Z-deadbeef-photo.png`,
        etag: 'abc123',
        bytes: 11,
        format: 'png',
        resourceType: 'image',
      });
    });

    it('uploads into the requested folder and returns the public id', async () => {
      const result = await service.uploadFile(makeFile(), 'posters');

      expect(provider.upload).toHaveBeenCalledTimes(1);
      const args = provider.upload.mock.calls[0][0];
      expect(args.folder).toBe('posters');
      expect(args.contentType).toBe('image/png');

      expect(result.key).toBe(
        'posters/2026-07-22T09-30-00-000Z-deadbeef-photo',
      );
      expect(result.size).toBe(11);
    });

    it('builds a collision-free file name without the extension', async () => {
      await service.uploadFile(
        makeFile({ originalname: 'My Holiday Photo!.png' }),
        'posters',
      );

      const { fileName } = provider.upload.mock.calls[0][0];
      // Cloudinary stores image public ids without an extension.
      expect(fileName).not.toMatch(/\.png$/);
      // Unsafe characters are replaced.
      expect(fileName).toMatch(/My_Holiday_Photo_$/);
      // Timestamp + random hash prefix keeps names unique.
      expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-[0-9a-f]{16}-/);
    });

    it('generates a different name for the same file uploaded twice', async () => {
      await service.uploadFile(makeFile(), 'posters');
      await service.uploadFile(makeFile(), 'posters');

      const first = provider.upload.mock.calls[0][0].fileName;
      const second = provider.upload.mock.calls[1][0].fileName;
      expect(first).not.toBe(second);
    });

    it('records an audit entry when a user id is supplied', async () => {
      await service.uploadFile(makeFile(), 'posters', '42', 'a@b.com', 'ADMIN');
      expect(audit.auditFileOperation).toHaveBeenCalledWith(
        'FILE_UPLOAD',
        expect.any(String),
        '42',
        'a@b.com',
        'ADMIN',
        expect.objectContaining({ folder: 'posters' }),
      );
    });

    it('skips the audit entry for anonymous uploads', async () => {
      await service.uploadFile(makeFile(), 'posters');
      expect(audit.auditFileOperation).not.toHaveBeenCalled();
    });

    it('rejects a file over the size limit', async () => {
      const big = makeFile({ buffer: Buffer.alloc(11 * 1024 * 1024) });
      await expect(service.uploadFile(big, 'posters')).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.upload).not.toHaveBeenCalled();
    });

    it('rejects a disallowed mime type', async () => {
      const bad = makeFile({
        mimetype: 'application/x-msdownload',
        originalname: 'virus.exe',
      });
      await expect(service.uploadFile(bad, 'posters')).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.upload).not.toHaveBeenCalled();
    });

    it('rejects an empty file', async () => {
      const empty = makeFile({ buffer: Buffer.alloc(0) });
      await expect(service.uploadFile(empty, 'posters')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects path traversal in the original name', async () => {
      const evil = makeFile({ originalname: '../../etc/passwd.png' });
      await expect(service.uploadFile(evil, 'posters')).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.upload).not.toHaveBeenCalled();
    });
  });

  describe('uploadMultipleFiles', () => {
    it('keeps going when one file in the batch fails validation', async () => {
      provider.upload.mockResolvedValue({
        key: 'posters/ok',
        url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/posters/ok.png`,
        etag: 'e',
        bytes: 11,
        format: 'png',
        resourceType: 'image',
      });

      const results = await service.uploadMultipleFiles(
        [
          makeFile(),
          makeFile({ buffer: Buffer.alloc(0) }), // invalid
          makeFile(),
        ],
        'posters',
      );

      expect(results).toHaveLength(2);
      expect(provider.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      provider.exists.mockResolvedValue(true);
      provider.delete.mockResolvedValue(undefined);
    });

    it('deletes by public id', async () => {
      await service.deleteFile('posters/banner');
      expect(provider.delete).toHaveBeenCalledWith({
        key: 'posters/banner',
        resourceType: undefined,
      });
    });

    it('accepts a full Cloudinary URL and resolves it to the public id', async () => {
      await service.deleteFile(
        `https://res.cloudinary.com/${CLOUD}/image/upload/v1699999999/posters/banner.png`,
      );
      expect(provider.delete).toHaveBeenCalledWith({
        key: 'posters/banner',
        resourceType: undefined,
      });
    });

    it('throws NotFound when the asset is absent', async () => {
      provider.exists.mockResolvedValue(false);
      await expect(service.deleteFile('posters/gone')).rejects.toThrow(
        NotFoundException,
      );
      expect(provider.delete).not.toHaveBeenCalled();
    });
  });

  describe('extractKeyFromUrl', () => {
    it('delegates to the provider', () => {
      expect(
        service.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/v1/a/b.jpg`,
        ),
      ).toBe('a/b');
    });
  });
});
