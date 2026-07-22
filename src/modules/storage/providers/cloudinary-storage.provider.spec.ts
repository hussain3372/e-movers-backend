import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { EnhancedLoggerService } from '../../../common/logger/enhanced-logger.service';

const CLOUD = 'e-movers';

function makeProvider(
  overrides: Record<string, string | undefined> = {},
): CloudinaryStorageProvider {
  const values: Record<string, string | undefined> = {
    CLOUDINARY_CLOUD_NAME: CLOUD,
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'test-secret',
    ...overrides,
  };

  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;

  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logFileOperation: jest.fn(),
  } as unknown as EnhancedLoggerService;

  return new CloudinaryStorageProvider(config, logger);
}

describe('CloudinaryStorageProvider', () => {
  describe('construction', () => {
    it('throws when credentials are missing', () => {
      expect(() => makeProvider({ CLOUDINARY_API_SECRET: undefined })).toThrow(
        /Cloudinary configuration is missing/,
      );
    });

    it('constructs when all three credentials are present', () => {
      expect(() => makeProvider()).not.toThrow();
    });
  });

  describe('resourceTypeFor', () => {
    it.each([
      ['image/jpeg', 'image'],
      ['image/webp', 'image'],
      ['video/mp4', 'video'],
      ['application/pdf', 'raw'],
      ['text/csv', 'raw'],
    ])('maps %s to %s', (mime, expected) => {
      expect(CloudinaryStorageProvider.resourceTypeFor(mime)).toBe(expected);
    });

    it('falls back to auto without a content type', () => {
      expect(CloudinaryStorageProvider.resourceTypeFor(undefined)).toBe('auto');
    });
  });

  describe('extractKeyFromUrl', () => {
    let provider: CloudinaryStorageProvider;

    beforeEach(() => {
      provider = makeProvider();
    });

    it('parses a plain versioned image URL', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/v1699999999/users/42/profile/pic.jpg`,
        ),
      ).toBe('users/42/profile/pic');
    });

    it('parses a URL with no version segment', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/posters/banner.png`,
        ),
      ).toBe('posters/banner');
    });

    it('strips a single transformation segment', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/w_200,c_fill,g_face/v1699999999/posters/banner.png`,
        ),
      ).toBe('posters/banner');
    });

    it('strips chained transformation segments', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/w_200,c_fill/e_blur:300/f_auto/v1/a/b/c.jpg`,
        ),
      ).toBe('a/b/c');
    });

    it('keeps the extension for raw assets', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/raw/upload/v1699999999/docs/contract.pdf`,
        ),
      ).toBe('docs/contract.pdf');
    });

    it('handles video assets', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/video/upload/v1/clips/intro.mp4`,
        ),
      ).toBe('clips/intro');
    });

    it('handles authenticated delivery type', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/private/doc.jpg`,
        ),
      ).toBe('private/doc');
    });

    it('decodes percent-encoded segments', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/v1/service%20locations/abu%20dhabi.jpg`,
        ),
      ).toBe('service locations/abu dhabi');
    });

    it('preserves dots inside the public id and only strips the extension', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/v1/users/1/2026-07-22T10-00-00-000Z-ab12-photo.jpg`,
        ),
      ).toBe('users/1/2026-07-22T10-00-00-000Z-ab12-photo');
    });

    it('returns null for a non-Cloudinary URL', () => {
      expect(
        provider.extractKeyFromUrl(
          'https://e-movers-images.s3.eu-north-1.amazonaws.com/users/42/profile/pic.jpg',
        ),
      ).toBeNull();
    });

    it('returns null for a malformed URL', () => {
      expect(provider.extractKeyFromUrl('not-a-url')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(provider.extractKeyFromUrl('')).toBeNull();
    });

    it('returns null when there is no public id after the delivery type', () => {
      expect(
        provider.extractKeyFromUrl(
          `https://res.cloudinary.com/${CLOUD}/image/upload/v1699999999`,
        ),
      ).toBeNull();
    });

    it('round-trips a public id built by StorageService naming', () => {
      const publicId =
        'users/42/profile/2026-07-22T09-30-00-000Z-deadbeef-photo';
      const url = `https://res.cloudinary.com/${CLOUD}/image/upload/v1699999999/${publicId}.png`;
      expect(provider.extractKeyFromUrl(url)).toBe(publicId);
    });
  });
});
