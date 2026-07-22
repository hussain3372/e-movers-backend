import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiOptions,
} from 'cloudinary';
import axios from 'axios';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
  DeleteOptions,
  DownloadResult,
  ListOptions,
  ListResult,
  ResourceType,
  StorageObject,
} from '../interfaces/storage.interface';
import { EnhancedLoggerService } from '../../../common/logger/enhanced-logger.service';

/** Segments Cloudinary uses to mark the delivery type in a URL. */
const DELIVERY_TYPES = [
  'upload',
  'private',
  'authenticated',
  'fetch',
  'facebook',
  'twitter',
  'youtube',
  'sprite',
];

const RESOURCE_TYPES = ['image', 'video', 'raw'];

/** e.g. `w_200,c_fill,g_face` or `f_auto` — a transformation, not part of the public id. */
const TRANSFORMATION_SEGMENT = /^[a-z]{1,3}_[^/]+(,[a-z]{1,3}_[^/]+)*$/;

/** e.g. `v1699999999` */
const VERSION_SEGMENT = /^v\d+$/;

/** The Cloudinary SDK types `destroy` and `api.resources` as `any`. */
interface DestroyResponse {
  result: string;
}

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  bytes: number;
  created_at: string;
  format?: string;
}

interface ResourcesResponse {
  resources?: CloudinaryResource[];
  next_cursor?: string;
}

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  private readonly cloudName: string;

  constructor(
    private configService: ConfigService,
    private logger: EnhancedLoggerService,
  ) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary configuration is missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.cloudName = cloudName;
    this.logger.log(
      `Cloudinary storage provider initialized (cloud: ${cloudName})`,
      'CloudinaryStorageProvider',
    );
  }

  /** Pick the Cloudinary resource type that matches a MIME type. */
  static resourceTypeFor(contentType?: string): ResourceType {
    if (!contentType) return 'auto';
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'raw';
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    const folder = options.folder.replace(/^\/+|\/+$/g, '');
    const resourceType =
      options.resourceType ??
      CloudinaryStorageProvider.resourceTypeFor(options.contentType);

    const uploadOptions: UploadApiOptions = {
      folder,
      public_id: options.fileName,
      resource_type: resourceType,
      // We generate our own collision-free names, so never let Cloudinary
      // rename or silently replace an existing asset.
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    };

    if (options.metadata) {
      uploadOptions.context = this.toContext(options.metadata);
    }

    try {
      const result = await this.uploadBuffer(options.body, uploadOptions);

      this.logger.logFileOperation('UPLOAD', result.public_id, result.bytes, {
        folder,
        contentType: options.contentType,
        resourceType: result.resource_type,
      });

      return {
        key: result.public_id,
        url: result.secure_url,
        etag: result.etag || String(result.version || ''),
        bytes: result.bytes,
        format: result.format,
        resourceType: result.resource_type as ResourceType,
      };
    } catch (error) {
      const reason = this.reasonFor(error);
      this.logger.error(
        `Failed to upload file: ${folder}/${options.fileName} — ${reason}`,
        this.stackFor(error),
        'CloudinaryStorageProvider',
        {
          folder,
          fileName: options.fileName,
          contentType: options.contentType,
          resourceType,
          metadata: this.diagnosisFor(error),
        },
      );
      // Keep the provider's own diagnosis attached for callers that log it.
      // `description` must be passed explicitly, otherwise supplying options
      // drops the `error` field from the JSON response body.
      throw new BadRequestException(`Failed to upload file: ${reason}`, {
        cause: error,
        description: 'Bad Request',
      });
    }
  }

  private uploadBuffer(
    body: Buffer,
    uploadOptions: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            // Cloudinary rejects with a plain object, not an Error.
            return reject(new Error(this.reasonFor(error), { cause: error }));
          }
          if (!result) {
            return reject(new Error('Cloudinary returned an empty response'));
          }
          resolve(result);
        },
      );
      stream.end(body);
    });
  }

  async download(
    key: string,
    resourceType: ResourceType = 'image',
  ): Promise<DownloadResult> {
    try {
      const url = cloudinary.url(key, {
        secure: true,
        resource_type: resourceType,
        sign_url: true,
      });

      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
      });

      const body = Buffer.from(response.data);

      this.logger.logFileOperation('DOWNLOAD', key, body.length, {
        resourceType,
      });

      return {
        body,
        contentType: response.headers['content-type'] as string | undefined,
      };
    } catch (error) {
      const reason = this.reasonFor(error);
      this.logger.error(
        `Failed to download file: ${key}`,
        this.stackFor(error),
        'CloudinaryStorageProvider',
        { key },
      );
      throw new BadRequestException(`Failed to download file: ${reason}`);
    }
  }

  async delete(options: DeleteOptions): Promise<void> {
    const resourceType = options.resourceType ?? 'image';

    try {
      const result = (await cloudinary.uploader.destroy(options.key, {
        resource_type: resourceType,
        invalidate: true,
      })) as DestroyResponse;

      // destroy() resolves with { result: 'not found' } rather than throwing.
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(result.result);
      }

      this.logger.logFileOperation('DELETE', options.key, undefined, {
        resourceType,
        outcome: result.result,
      });
    } catch (error) {
      const reason = this.reasonFor(error);
      this.logger.error(
        `Failed to delete file: ${options.key}`,
        this.stackFor(error),
        'CloudinaryStorageProvider',
        { key: options.key },
      );
      throw new BadRequestException(`Failed to delete file: ${reason}`);
    }
  }

  async list(options: ListOptions): Promise<ListResult> {
    const resourceType = options.resourceType ?? 'image';

    try {
      const result = (await cloudinary.api.resources({
        type: 'upload',
        resource_type: resourceType,
        prefix: options.prefix,
        max_results: options.maxResults ?? 100,
        next_cursor: options.nextCursor,
      })) as ResourcesResponse;

      const objects: StorageObject[] = (result.resources ?? []).map(
        (item): StorageObject => ({
          key: item.public_id,
          url: item.secure_url,
          size: item.bytes,
          lastModified: new Date(item.created_at),
          format: item.format,
        }),
      );

      return {
        objects,
        isTruncated: Boolean(result.next_cursor),
        nextCursor: result.next_cursor,
      };
    } catch (error) {
      const reason = this.reasonFor(error);
      this.logger.error(
        `Failed to list resources with prefix: ${options.prefix ?? '(none)'}`,
        this.stackFor(error),
        'CloudinaryStorageProvider',
        { prefix: options.prefix },
      );
      throw new BadRequestException(`Failed to list resources: ${reason}`);
    }
  }

  async exists(
    key: string,
    resourceType: ResourceType = 'image',
  ): Promise<boolean> {
    try {
      await cloudinary.api.resource(key, { resource_type: resourceType });
      return true;
    } catch (error) {
      if (this.isNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  getSignedUrl(
    key: string,
    expiresIn = 3600,
    resourceType: ResourceType = 'image',
  ): string {
    return cloudinary.url(key, {
      secure: true,
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });
  }

  /**
   * Turn a Cloudinary delivery URL back into its public id.
   *
   * Handles optional transformation and version segments:
   *   https://res.cloudinary.com/demo/image/upload/w_200,c_fill/v17/a/b.jpg
   *     -> a/b
   *
   * For `raw` assets the extension is part of the public id and is kept.
   * Returns null for anything that isn't a Cloudinary URL.
   */
  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const deliveryIndex = segments.findIndex((segment) =>
      DELIVERY_TYPES.includes(segment),
    );
    if (deliveryIndex === -1) return null;

    // The segment before the delivery type is the resource type; anything else
    // means this URL did not come from Cloudinary.
    const resourceType = segments[deliveryIndex - 1];
    if (!RESOURCE_TYPES.includes(resourceType)) return null;

    let rest = segments.slice(deliveryIndex + 1);

    // Drop transformation segments, then the version segment.
    while (rest.length > 0 && TRANSFORMATION_SEGMENT.test(rest[0])) {
      rest = rest.slice(1);
    }
    if (rest.length > 0 && VERSION_SEGMENT.test(rest[0])) {
      rest = rest.slice(1);
    }

    if (rest.length === 0) return null;

    const publicId = rest.join('/');

    // Image and video public ids exclude the extension; raw ids include it.
    if (resourceType === 'raw') return publicId;

    return publicId.replace(/\.[^./]+$/, '');
  }

  /** Cloudinary context values may not contain `=` or `|`. */
  private toContext(metadata: Record<string, string>): Record<string, string> {
    const context: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue;
      context[key] = String(value).replace(/[=|]/g, '-');
    }
    return context;
  }

  private isNotFound(error: unknown): boolean {
    const err = error as { http_code?: number; error?: { http_code?: number } };
    return err?.http_code === 404 || err?.error?.http_code === 404;
  }

  /**
   * Cloudinary reports the actionable part of a failure (invalid signature,
   * quota exceeded, file too large) via http_code and a nested message. Pull
   * those out so the log says *why*, not just "upload failed".
   */
  private diagnosisFor(error: unknown): Record<string, unknown> {
    const raw = error instanceof Error && error.cause ? error.cause : error;
    const err = raw as {
      name?: string;
      http_code?: number;
      error?: { message?: string; http_code?: number };
    };

    return {
      cloudinaryHttpCode: err?.http_code ?? err?.error?.http_code,
      cloudinaryMessage: err?.error?.message,
      errorName: err?.name,
    };
  }

  private reasonFor(error: unknown): string {
    const err = error as { message?: string; error?: { message?: string } };
    return err?.message || err?.error?.message || 'Unknown error';
  }

  private stackFor(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
