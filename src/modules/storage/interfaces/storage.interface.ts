/**
 * Storage abstraction backed by Cloudinary.
 *
 * Cloudinary identifies an asset by `publicId` (folder path + name, no file
 * extension for image/video assets). Throughout this codebase the term "key"
 * is used interchangeably with Cloudinary's `public_id`.
 */

export type ResourceType = 'image' | 'video' | 'raw' | 'auto';

export interface UploadOptions {
  /** Cloudinary folder, e.g. `users/42/profile`. */
  folder: string;
  /** File name (without extension) used to build the public id. */
  fileName: string;
  body: Buffer;
  contentType?: string;
  /** Arbitrary key/value pairs stored as Cloudinary context metadata. */
  metadata?: Record<string, string>;
  resourceType?: ResourceType;
}

export interface UploadResult {
  /** Cloudinary `public_id`. */
  key: string;
  /** Cloudinary `secure_url`. */
  url: string;
  /** Cloudinary asset version, used in place of an S3 ETag. */
  etag: string;
  bytes: number;
  format?: string;
  resourceType: ResourceType;
}

export interface DeleteOptions {
  key: string;
  resourceType?: ResourceType;
}

export interface ListOptions {
  /** Public-id prefix, e.g. `posters/`. */
  prefix?: string;
  maxResults?: number;
  nextCursor?: string;
  resourceType?: ResourceType;
}

export interface StorageObject {
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  format?: string;
}

export interface ListResult {
  objects: StorageObject[];
  isTruncated: boolean;
  nextCursor?: string;
}

export interface DownloadResult {
  body: Buffer;
  contentType?: string;
}

export interface IStorageProvider {
  upload(options: UploadOptions): Promise<UploadResult>;
  download(key: string, resourceType?: ResourceType): Promise<DownloadResult>;
  delete(options: DeleteOptions): Promise<void>;
  list(options: ListOptions): Promise<ListResult>;
  exists(key: string, resourceType?: ResourceType): Promise<boolean>;
  /** Signed, time-limited delivery URL for a private/authenticated asset. */
  getSignedUrl(
    key: string,
    expiresIn?: number,
    resourceType?: ResourceType,
  ): string;
  /** Resolve a Cloudinary delivery URL back to its public id. */
  extractKeyFromUrl(url: string): string | null;
}
