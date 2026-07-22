/**
 * Live round-trip check against the real Cloudinary account in .env.
 *
 *   npm run verify:cloudinary
 *
 * Uploads a tiny generated PNG, verifies the returned URL, resolves that URL
 * back to a public id, confirms the asset exists, deletes it, and confirms it
 * is gone. Nothing is left behind in your Cloudinary account.
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageProvider } from '../src/modules/storage/providers/cloudinary-storage.provider';
import { EnhancedLoggerService } from '../src/common/logger/enhanced-logger.service';

// Smallest valid 1x1 PNG.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const TEST_FOLDER = 'e-movers-verify';

const config = {
  get: (key: string) => process.env[key],
} as unknown as ConfigService;

const silentLogger = {
  log: () => {},
  error: () => {},
  warn: () => {},
  logFileOperation: () => {},
} as unknown as EnhancedLoggerService;

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (
    !cloudName ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.error(
      '\nCLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in .env first.\n',
    );
    process.exit(1);
  }

  console.log(`\nVerifying Cloudinary storage (cloud: ${cloudName})\n`);

  const provider = new CloudinaryStorageProvider(config, silentLogger);
  const fileName = `verify-${Date.now()}`;
  let publicId: string | undefined;

  try {
    // 1. Upload
    const uploaded = await provider.upload({
      folder: TEST_FOLDER,
      fileName,
      body: ONE_PIXEL_PNG,
      contentType: 'image/png',
      metadata: { purpose: 'automated-verification' },
    });
    publicId = uploaded.key;

    check('upload returns a public id', Boolean(uploaded.key), uploaded.key);
    check(
      'public id is namespaced under the folder',
      uploaded.key.startsWith(`${TEST_FOLDER}/`),
      uploaded.key,
    );
    check(
      'upload returns an https secure_url',
      uploaded.url.startsWith('https://'),
      uploaded.url,
    );
    check(
      'upload reports the byte size',
      uploaded.bytes > 0,
      String(uploaded.bytes),
    );
    check(
      'resource type is image',
      uploaded.resourceType === 'image',
      uploaded.resourceType,
    );

    // 2. The URL must round-trip back to the same public id. This is what
    //    every deleteFile() call in the app depends on.
    const parsed = provider.extractKeyFromUrl(uploaded.url);
    check(
      'secure_url resolves back to the same public id',
      parsed === uploaded.key,
      `got ${parsed ?? 'null'}, expected ${uploaded.key}`,
    );

    // 3. The asset is really there
    check(
      'exists() finds the uploaded asset',
      await provider.exists(uploaded.key),
    );

    // 4. It is publicly reachable
    const headResponse = await fetch(uploaded.url);
    check(
      'secure_url is publicly fetchable',
      headResponse.ok,
      `HTTP ${headResponse.status}`,
    );

    // 5. Listing by prefix finds it
    const listed = await provider.list({
      prefix: `${TEST_FOLDER}/`,
      maxResults: 50,
    });
    check(
      'list() finds the asset by prefix',
      listed.objects.some((o) => o.key === uploaded.key),
      `${listed.objects.length} object(s) under ${TEST_FOLDER}/`,
    );

    // 6. Delete
    await provider.delete({ key: uploaded.key });
    check('delete() resolves', true);

    // 7. Really gone
    check(
      'exists() is false after delete',
      !(await provider.exists(uploaded.key)),
    );
    publicId = undefined;
  } catch (error) {
    failed++;
    console.log(`  FAIL  unexpected error — ${(error as Error).message}`);

    if (publicId) {
      try {
        await provider.delete({ key: publicId });
        console.log(`  ....  cleaned up leftover asset ${publicId}`);
      } catch {
        console.log(
          `  WARN  could not clean up ${publicId} — delete it manually`,
        );
      }
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
