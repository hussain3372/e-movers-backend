/**
 * Database seed — bootstraps the admin account.
 *
 *   npm run db:seed
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in .env so they are never
 * committed to version control.
 *
 * The seed is idempotent and authoritative: re-running it resets the admin's
 * password to the current ADMIN_PASSWORD and re-activates the account. Use it
 * to recover a locked-out or forgotten admin login.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Must match the cost factor used by AuthService.
const BCRYPT_ROUNDS = 12;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding.',
    );
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const existing = await prisma.user.findUnique({ where: { email } });

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashedPassword,
      name: 'Admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      // Login rejects unverified accounts, so the bootstrap admin is
      // pre-verified rather than waiting on a verification email.
      emailVerified: true,
    },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
    select: { id: true, email: true, role: true, status: true },
  });

  console.log(
    existing
      ? `Updated existing admin (id ${admin.id}) — password reset.`
      : `Created admin (id ${admin.id}).`,
  );
  console.log(`  email:  ${admin.email}`);
  console.log(`  role:   ${admin.role}`);
  console.log(`  status: ${admin.status}`);
}

async function main() {
  console.log('\nSeeding database...\n');
  await seedAdmin();
  console.log('\nSeed complete.\n');
}

main()
  .catch((error: unknown) => {
    console.error(`\nSeed failed: ${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
