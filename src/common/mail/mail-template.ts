/**
 * Shared building blocks for every transactional email.
 *
 * Everything here is table-based with inline styles so it survives Outlook,
 * Gmail and Apple Mail. Avoid <style> blocks, flexbox, grid and background
 * images — Gmail strips or ignores them.
 */

export const BRAND = {
  name: 'E House Movers',
  tagline: 'Moving Made Easy.',
  red: '#9E1B1B',
  redDark: '#7C1414',
  text: '#333333',
  muted: '#767676',
  border: '#E5E5E5',
  cardBg: '#F2F2F2',
  pageBg: '#F4F4F4',
  font: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
};

const SOCIAL_LINKS: Array<{ label: string; url: string }> = [
  { label: 'Facebook', url: 'https://www.facebook.com/emoversuae' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/company/emovers/' },
  {
    label: 'YouTube',
    url: 'https://www.youtube.com/channel/UClxGJlbXpCM4F8bWotE52vA',
  },
  { label: 'Instagram', url: 'https://www.instagram.com/emoversuae/' },
  { label: 'TikTok', url: 'https://www.tiktok.com/@emoversuae' },
];

/** Escape untrusted values before interpolating them into an email body. */
export function esc(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type NoticeVariant = 'info' | 'success' | 'warning' | 'danger';

const NOTICE_COLORS: Record<NoticeVariant, { bg: string; accent: string }> = {
  info: { bg: '#F2F2F2', accent: BRAND.red },
  success: { bg: '#EFF7F0', accent: '#2E7D32' },
  warning: { bg: '#FDF6E7', accent: '#B7791F' },
  danger: { bg: '#FBEDED', accent: '#C0392B' },
};

/**
 * A call-to-action button. Rendered as a table so Outlook honours the padding
 * and the whole block stays clickable.
 */
export function emailButton(
  label: string,
  url: string,
  variant: 'primary' | 'secondary' = 'primary',
): string {
  const bg = variant === 'primary' ? BRAND.red : '#FFFFFF';
  const fg = variant === 'primary' ? '#FFFFFF' : BRAND.red;
  const border = variant === 'primary' ? BRAND.red : BRAND.border;

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:4px;border:1px solid ${border};">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 34px;font-family:${BRAND.font};font-size:15px;font-weight:bold;line-height:20px;color:${fg};text-decoration:none;border-radius:4px;letter-spacing:0.4px;">${esc(label)}</a>
      </td>
    </tr>
  </table>`;
}

/**
 * The grey stat-card look from the website: a light panel of label/value rows.
 * Values are escaped — pass pre-built HTML only via `html: true`.
 */
export function emailDetails(
  rows: Array<{ label: string; value: string; html?: boolean }>,
  heading?: string,
): string {
  const body = rows
    .filter(
      (row) =>
        row.value !== undefined && row.value !== null && row.value !== '',
    )
    .map(
      (row) => `
        <tr>
          <td style="padding:7px 0;font-family:${BRAND.font};font-size:13px;line-height:20px;color:${BRAND.muted};white-space:nowrap;" valign="top">${esc(row.label)}</td>
          <td style="padding:7px 0 7px 20px;font-family:${BRAND.font};font-size:14px;line-height:20px;color:${BRAND.text};font-weight:bold;" valign="top" align="right">${row.html ? row.value : esc(row.value)}</td>
        </tr>`,
    )
    .join('');

  const title = heading
    ? `<tr><td colspan="2" style="padding:0 0 12px;font-family:${BRAND.font};font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.red};">${esc(heading)}</td></tr>`
    : '';

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;background-color:${BRAND.cardBg};border-radius:4px;">
    <tr>
      <td style="padding:22px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${title}
          ${body}
        </table>
      </td>
    </tr>
  </table>`;
}

/** A tinted callout with a coloured left rule — for warnings, notes, review comments. */
export function emailNotice(
  html: string,
  variant: NoticeVariant = 'info',
  heading?: string,
): string {
  const { bg, accent } = NOTICE_COLORS[variant];
  const title = heading
    ? `<div style="font-family:${BRAND.font};font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${accent};padding-bottom:8px;">${esc(heading)}</div>`
    : '';

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;background-color:${bg};border-left:4px solid ${accent};border-radius:0 4px 4px 0;">
    <tr>
      <td style="padding:18px 22px;font-family:${BRAND.font};font-size:14px;line-height:22px;color:${BRAND.text};">
        ${title}${html}
      </td>
    </tr>
  </table>`;
}

/** Large monospaced one-time code. */
export function emailCode(code: string, note?: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0;">
    <tr>
      <td align="center" style="padding:24px 16px;background-color:${BRAND.cardBg};border-radius:4px;">
        <div style="font-family:'Courier New', Courier, monospace;font-size:34px;font-weight:bold;letter-spacing:10px;color:${BRAND.red};line-height:40px;">${esc(code)}</div>
        ${note ? `<div style="font-family:${BRAND.font};font-size:12px;color:${BRAND.muted};padding-top:12px;line-height:18px;">${esc(note)}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

/** Paragraph helper so copy keeps consistent leading and colour. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BRAND.font};font-size:15px;line-height:24px;color:${BRAND.text};">${html}</p>`;
}

function renderHeader(): string {
  return `
  <tr>
    <td align="center" style="padding:40px 32px 30px;border-bottom:1px solid ${BRAND.border};">
      <div style="font-family:${BRAND.font};font-size:30px;font-weight:bold;letter-spacing:2px;color:${BRAND.red};line-height:36px;">E-MOVERS</div>
      <div style="font-family:${BRAND.font};font-size:12px;font-style:italic;font-weight:bold;letter-spacing:2.5px;color:${BRAND.muted};padding-top:8px;line-height:16px;">${BRAND.tagline}</div>
    </td>
  </tr>`;
}

function renderSocialRow(): string {
  const cells = SOCIAL_LINKS.map(
    (link) => `
        <td style="padding:0 3px;">
          <a href="${link.url}" target="_blank" style="display:inline-block;padding:9px 13px;background-color:#FFFFFF;border:1px solid ${BRAND.border};border-radius:4px;font-family:${BRAND.font};font-size:11px;font-weight:bold;letter-spacing:0.6px;color:${BRAND.red};text-decoration:none;">${link.label}</a>
        </td>`,
  ).join('');

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr>${cells}</tr>
  </table>`;
}

function renderFooter(footerNote?: string): string {
  const year = new Date().getFullYear();

  return `
  <tr>
    <td align="center" style="padding:30px 24px 34px;background-color:${BRAND.cardBg};border-top:1px solid ${BRAND.border};">
      <div style="font-family:${BRAND.font};font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.muted};padding-bottom:16px;">Follow Us</div>
      ${renderSocialRow()}
      <div style="font-family:${BRAND.font};font-size:12px;line-height:20px;color:${BRAND.muted};padding-top:26px;">
        ${footerNote ? `${esc(footerNote)}<br>` : ''}
        This is an automated message — please do not reply to this email.
      </div>
      <div style="font-family:${BRAND.font};font-size:11px;line-height:18px;color:#9A9A9A;padding-top:12px;">
        &copy; ${year} ${BRAND.name}. All rights reserved.
      </div>
    </td>
  </tr>`;
}

export interface EmailLayoutOptions {
  /** Grey preview line shown next to the subject in most inboxes. */
  preheader?: string;
  /** Small uppercase label above the title, e.g. "Booking Confirmed". */
  eyebrow?: string;
  title: string;
  /** e.g. "Hello Ahmed," — escaped for you. */
  greeting?: string;
  /** Body HTML, built with the helpers above. */
  body: string;
  /** Extra line above the copyright, e.g. an office address. */
  footerNote?: string;
}

/** Wraps content in the branded shell: header, white card, social footer. */
export function renderEmail(options: EmailLayoutOptions): string {
  const { preheader, eyebrow, title, greeting, body, footerNote } = options;

  const preheaderBlock = preheader
    ? `<div style="display:none;font-size:1px;color:${BRAND.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>`
    : '';

  const eyebrowBlock = eyebrow
    ? `<div style="font-family:${BRAND.font};font-size:11px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${BRAND.red};padding-bottom:10px;">${esc(eyebrow)}</div>`
    : '';

  const greetingBlock = greeting
    ? `<p style="margin:0 0 18px;font-family:${BRAND.font};font-size:15px;line-height:24px;color:${BRAND.text};">${esc(greeting)}</p>`
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};-webkit-text-size-adjust:100%;">
  ${preheaderBlock}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#FFFFFF;border:1px solid ${BRAND.border};border-radius:6px;">
          ${renderHeader()}
          <tr>
            <td style="padding:34px 40px 12px;">
              ${eyebrowBlock}
              <h1 style="margin:0 0 20px;font-family:${BRAND.font};font-size:23px;line-height:31px;font-weight:bold;color:${BRAND.red};">${esc(title)}</h1>
              ${greetingBlock}
              ${body}
            </td>
          </tr>
          <tr><td style="padding:0 40px 34px;"></td></tr>
          ${renderFooter(footerNote)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
