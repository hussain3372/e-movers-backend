/**
 * Live SMTP diagnostic against the credentials in .env.
 *
 *   npm run verify:smtp            # verify connection + send a test email
 *   npm run verify:smtp -- --to you@example.com
 *
 * It tests three things, in order:
 *   1. How the running app derives the `secure` flag from MAIL_PORT/MAIL_ENCRYPTION.
 *   2. Whether the transporter can authenticate (verify()).
 *   3. Whether a real message is accepted for delivery (sendMail()).
 *
 * If the app's own config fails to connect, it retries with the flag that the
 * port actually implies, so the output pinpoints the misconfiguration.
 */
import 'dotenv/config';
import * as nodemailer from 'nodemailer';

interface SmtpEnv {
  host: string;
  port: number;
  encryption: string;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

function readEnv(): SmtpEnv {
  const host = process.env.MAIL_HOST;
  const portRaw = process.env.MAIL_PORT;
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;

  if (!host || !portRaw || !username || !password) {
    throw new Error(
      'MAIL_HOST, MAIL_PORT, MAIL_USERNAME and MAIL_PASSWORD must all be set in .env.',
    );
  }

  return {
    host,
    port: Number(portRaw),
    encryption: (process.env.MAIL_ENCRYPTION || 'ssl').toLowerCase(),
    username,
    password,
    fromAddress: process.env.MAIL_FROM_ADDRESS || username,
    fromName: process.env.MAIL_FROM_NAME || 'E House Movers',
  };
}

/** The flag the port actually requires: 465 = implicit TLS, everything else = STARTTLS. */
function correctSecureFor(port: number): boolean {
  return port === 465;
}

function buildTransporter(env: SmtpEnv, secure: boolean) {
  return nodemailer.createTransport({
    host: env.host,
    port: env.port,
    secure,
    auth: { user: env.username, pass: env.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
}

async function tryVerify(
  label: string,
  env: SmtpEnv,
  secure: boolean,
): Promise<boolean> {
  const transporter = buildTransporter(env, secure);
  process.stdout.write(
    `  ${label}: connecting to ${env.host}:${env.port} (secure=${secure}) ... `,
  );
  try {
    await transporter.verify();
    console.log('OK');
    return true;
  } catch (error) {
    console.log('FAILED');
    console.log(`      -> ${(error as Error).message}`);
    return false;
  } finally {
    transporter.close();
  }
}

async function main() {
  const env = readEnv();
  const to = parseTo() || env.fromAddress;

  console.log(`\nSMTP diagnostic for ${env.host}:${env.port}\n`);
  console.log(`  user:       ${env.username}`);
  console.log(`  encryption: ${env.encryption}`);
  console.log(`  from:       "${env.fromName}" <${env.fromAddress}>`);
  console.log(`  test to:    ${to}\n`);

  const correctSecure = correctSecureFor(env.port);
  if ((env.port === 465) !== (env.encryption === 'ssl')) {
    console.log(
      `  NOTE: port ${env.port} implies secure=${correctSecure}, but MAIL_ENCRYPTION=${env.encryption}.\n`,
    );
  }

  console.log('Step 1 — verify connection:');
  let workingSecure: boolean | null = null;
  if (await tryVerify('as configured', env, correctSecure)) {
    workingSecure = correctSecure;
  } else if (await tryVerify('fallback', env, !correctSecure)) {
    workingSecure = !correctSecure;
  }

  if (workingSecure === null) {
    console.log(
      '\nConnection failed with both secure flags. This is an auth, host, or firewall problem — not the secure flag.\n',
    );
    process.exit(1);
  }

  console.log(`\nStep 2 — send a test email (secure=${workingSecure}):`);
  const transporter = buildTransporter(env, workingSecure);
  try {
    const info = await transporter.sendMail({
      from: `"${env.fromName}" <${env.fromAddress}>`,
      to,
      subject: 'E-Movers SMTP test',
      text: 'This is a plain-text SMTP connectivity test from the E-Movers backend.',
      html: '<p>This is an SMTP connectivity test from the <strong>E-Movers</strong> backend.</p>',
    });
    console.log(`  accepted: ${JSON.stringify(info.accepted)}`);
    console.log(`  rejected: ${JSON.stringify(info.rejected)}`);
    console.log(`  messageId: ${info.messageId}`);
    console.log(`  response: ${info.response}`);
  } catch (error) {
    console.log(`  SEND FAILED -> ${(error as Error).message}`);
    process.exit(1);
  } finally {
    transporter.close();
  }

  console.log(
    `\nSMTP works with secure=${workingSecure}. ` +
      `For port ${env.port}, MAIL_ENCRYPTION should be "${workingSecure ? 'ssl' : 'tls'}".\n`,
  );
  process.exit(0);
}

function parseTo(): string | undefined {
  const index = process.argv.indexOf('--to');
  return index !== -1 ? process.argv[index + 1] : undefined;
}

void main();
