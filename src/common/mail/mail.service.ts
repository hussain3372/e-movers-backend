import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  renderEmail,
  emailButton,
  emailDetails,
  emailNotice,
  emailCode,
  emailParagraph,
  esc,
} from './mail-template';

@Injectable()
export class MailService {
  private transporter: Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const host = this.configService.get<string>('MAIL_HOST');
      const port = this.configService.get<number>('MAIL_PORT');
      const encryption = this.configService.get<string>(
        'MAIL_ENCRYPTION',
        'ssl',
      );
      const username = this.configService.get<string>('MAIL_USERNAME');
      const password = this.configService.get<string>('MAIL_PASSWORD');

      // Determine secure flag based on port or encryption setting
      // Port 465 = SSL (secure: true)
      // Port 587 = TLS/STARTTLS (secure: false)
      let secure = false;
      if (port === 465 || encryption?.toLowerCase() === 'ssl') {
        secure = true;
      } else if (port === 587 || encryption?.toLowerCase() === 'tls') {
        secure = false;
      }

      const smtpConfig: any = {
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password,
        },
      };

      // Add connection pooling and timeouts for better reliability
      smtpConfig.pool = true;
      smtpConfig.maxConnections = 5;
      smtpConfig.maxMessages = 100;
      smtpConfig.rateDelta = 1000; // 1 second
      smtpConfig.rateLimit = 5; // 5 messages per second
      smtpConfig.connectionTimeout = 10000; // 10 seconds
      smtpConfig.socketTimeout = 10000; // 10 seconds

      // For TLS connections, allow self-signed certificates if needed (not recommended for production)
      if (!secure && port === 587) {
        smtpConfig.tls = {
          rejectUnauthorized: false, // ⚠️ Only for development; use true in production
        };
      }

      this.transporter = nodemailer.createTransport(smtpConfig);

      this.logger.log(
        `✅ Email transporter initialized: ${host}:${port} (${secure ? 'SSL' : 'TLS'})`,
        {
          host,
          port,
          secure,
          encryption,
        },
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize email transporter', error);
      throw error;
    }
  }

  async sendMail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<boolean> {
    const maxRetries = 3;
    const retryDelayMs = 2000; // 2 seconds between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const from =
          options.from ||
          this.configService.get<string>(
            'MAIL_FROM_ADDRESS',
            'developer@vordx.com',
          );

        const mailOptions = {
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        };

        const info = await this.transporter.sendMail(mailOptions);

        this.logger.log(`📧 Email sent successfully: ${info.messageId}`, {
          to: options.to,
          subject: options.subject,
          attempt,
        });

        return true;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const errorMsg = error?.message || JSON.stringify(error);

        if (isLastAttempt) {
          this.logger.error(
            `❌ Failed to send email after ${maxRetries} attempts: ${errorMsg}`,
            {
              to: options.to,
              subject: options.subject,
              error: errorMsg,
            },
          );
          return false;
        }

        this.logger.warn(
          `⚠️ Email send attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelayMs}ms: ${errorMsg}`,
          { to: options.to, subject: options.subject },
        );

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    return false;
  }

  async sendEmailVerification(
    email: string,
    token: string,
    firstName?: string,
  ): Promise<boolean> {
    const subject = 'Verify Your Email Address';
    const verifyUrl = `${this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    )}/verify-email?token=${token}`;

    const html = renderEmail({
      preheader:
        'Confirm your email address to activate your E-Movers account.',
      eyebrow: 'Account Verification',
      title: 'Verify your email address',
      greeting: firstName ? `Hello ${firstName},` : 'Hello,',
      body: [
        emailParagraph(
          'Thank you for registering with E-Movers. Please confirm your email address to activate your account.',
        ),
        emailButton('Verify Email Address', verifyUrl),
        emailParagraph(
          `If the button doesn't work, copy and paste this link into your browser:<br><a href="${verifyUrl}" style="color:#9E1B1B;word-break:break-all;">${esc(verifyUrl)}</a>`,
        ),
        emailParagraph(
          "If you didn't create an account, you can safely ignore this email.",
        ),
      ].join(''),
    });

    // Debug logs
    console.log('🔹 Preparing to send verification email...');
    console.log('   → Recipient:', email);
    console.log('   → Subject:', subject);
    console.log('   → Verify URL:', verifyUrl);
    console.log('   → SMTP Host:', this.configService.get<string>('MAIL_HOST'));
    console.log('   → SMTP Port:', this.configService.get<string>('MAIL_PORT'));
    console.log(
      '   → SMTP User:',
      this.configService.get<string>('MAIL_USERNAME'),
    );

    try {
      const result = await this.sendMail({
        to: email,
        subject,
        html,
      });

      console.log('✅ Email send result:', result);
      return true;
    } catch (error) {
      console.error('❌ Email send failed:', error.message);
      console.error(error);
      return false;
    }
  }

  async sendEmailVerificationOTP(
    email: string,
    otp: string,
    firstName?: string,
  ): Promise<boolean> {
    const subject = 'Your Email Verification Code';

    const html = renderEmail({
      preheader: `Your E-Movers verification code is ${otp}.`,
      eyebrow: 'Account Verification',
      title: 'Your verification code',
      greeting: firstName ? `Hello ${firstName},` : 'Hello,',
      body: [
        emailParagraph('Use the code below to verify your email address.'),
        emailCode(otp, 'This code expires in 10 minutes'),
        emailParagraph(
          'If you did not create this account, please ignore this email.',
        ),
      ].join(''),
    });

    try {
      await this.sendMail({
        to: email,
        subject,
        html,
      });
      return true;
    } catch (error) {
      console.error('Email OTP send failed:', error);
      return false;
    }
  }

  // Template methods for common emails
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    const subject = 'Welcome to E-Movers!';
    const html = renderEmail({
      preheader: 'Your E-Movers account is ready. Moving, made simple.',
      eyebrow: 'Welcome Aboard',
      title: `Welcome to E-Movers, ${firstName}!`,
      body: [
        emailParagraph(
          'We are delighted to have you with us. Since 2003, E-Movers has had a single goal: to make moving a simple and seamless experience.',
        ),
        emailDetails(
          [
            { label: 'Vehicles', value: '100+' },
            { label: 'Moves a day', value: '35+' },
            { label: 'Years in business', value: '20+' },
            { label: 'Customer satisfaction', value: '97%' },
          ],
          'Why customers choose us',
        ),
        emailParagraph(
          'If you have any questions, our support team is always happy to help.',
        ),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    role: string, // 👈 add role parameter
  ): Promise<boolean> {
    const subject = 'Password Reset Request';

    // Base frontend URL from env or default
    const baseUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // ✅ Determine route prefix based on role
    let rolePrefix = '';
    if (role === 'ADMIN') rolePrefix = '/admin';
    else if (role === 'SUPER_ADMIN') rolePrefix = '/super-admin';
    // for 'user' or any other, keep it empty

    // ✅ Build reset URL dynamically
    const resetUrl = `${baseUrl}${rolePrefix}/auth/reset-password?token=${resetToken}`;

    const html = renderEmail({
      preheader: 'Reset your E-Movers password. This link expires in 1 hour.',
      eyebrow: 'Account Security',
      title: 'Reset your password',
      body: [
        emailParagraph(
          'We received a request to reset the password for your account. Click the button below to choose a new one.',
        ),
        emailButton('Reset Password', resetUrl),
        emailNotice(
          'This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.',
          'warning',
          'Security notice',
        ),
        emailParagraph(
          `If the button doesn't work, copy and paste this link into your browser:<br><a href="${resetUrl}" style="color:#9E1B1B;word-break:break-all;">${esc(resetUrl)}</a>`,
        ),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendAdminWelcomeEmail(
    email: string,
    firstName: string,
    temporaryPassword: string,
  ): Promise<void> {
    const subject = 'Welcome to the E-Movers Admin Panel';
    const baseUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const loginUrl = `${baseUrl}/admin/login`;

    const html = renderEmail({
      preheader: 'Your E-Movers administrator account is ready.',
      eyebrow: 'Administrator Access',
      title: 'Welcome to the Admin Panel',
      greeting: `Hi ${firstName},`,
      body: [
        emailParagraph(
          'You have been added as an administrator. Use the credentials below to sign in for the first time.',
        ),
        emailDetails(
          [
            { label: 'Email', value: email },
            { label: 'Temporary password', value: temporaryPassword },
          ],
          'Your login credentials',
        ),
        emailNotice(
          'For your security, please change this temporary password immediately after your first login and do not share it with anyone.',
          'warning',
          'Important',
        ),
        emailButton('Go to Admin Login', loginUrl),
      ].join(''),
    });

    await this.sendMail({ to: email, subject, html });
  }

  async sendNewAdminNotificationEmail(
    email: string,
    firstName: string,
    newAdminData: { name: string; email: string; addedBy: string },
  ): Promise<void> {
    const subject = 'New Admin Added - Notification';
    const html = renderEmail({
      preheader: `${newAdminData.name} was added as an administrator.`,
      eyebrow: 'System Notification',
      title: 'A new administrator was added',
      greeting: `Hi ${firstName},`,
      body: [
        emailParagraph(
          'This is to inform you that a new administrator has been added to the system.',
        ),
        emailDetails(
          [
            { label: 'Admin name', value: newAdminData.name },
            { label: 'Admin email', value: newAdminData.email },
            { label: 'Added by', value: newAdminData.addedBy },
            { label: 'Date', value: new Date().toLocaleString() },
          ],
          'Account details',
        ),
        emailParagraph(
          'If you did not expect this change, please review the administrator list right away.',
        ),
      ].join(''),
    });

    await this.sendMail({ to: email, subject, html });
  }

  async sendAdminDeletedNotificationEmail(
    email: string,
    firstName: string,
    deletedAdminData: { name: string; email: string; deletedBy: string },
  ): Promise<void> {
    const subject = 'Admin Account Deleted - Notification';
    const html = renderEmail({
      preheader: `${deletedAdminData.name}'s administrator account was deleted.`,
      eyebrow: 'System Notification',
      title: 'An administrator account was deleted',
      greeting: `Hi ${firstName},`,
      body: [
        emailParagraph(
          'This is to inform you that an administrator account has been deleted from the system.',
        ),
        emailDetails(
          [
            { label: 'Admin name', value: deletedAdminData.name },
            { label: 'Admin email', value: deletedAdminData.email },
            { label: 'Deleted by', value: deletedAdminData.deletedBy },
            { label: 'Date', value: new Date().toLocaleString() },
          ],
          'Removed account',
        ),
        emailNotice(
          'If you did not authorise this deletion, please contact your system administrator immediately.',
          'warning',
          'Action may be required',
        ),
      ].join(''),
    });

    await this.sendMail({ to: email, subject, html });
  }

  async sendCertificationApprovedEmail(
    email: string,
    hostName: string,
    propertyName: string,
    badgeSerial: string,
  ): Promise<boolean> {
    const subject = 'Certification Approved - Digital Badge Ready';
    const badgeUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/certifications/${badgeSerial}`;

    const html = renderEmail({
      preheader: `Your certification for ${propertyName} has been approved.`,
      eyebrow: 'Certification Approved',
      title: `Congratulations, ${hostName}!`,
      body: [
        emailParagraph(
          `Your certification application for <strong>${esc(propertyName)}</strong> has been approved, and your digital badge is ready.`,
        ),
        emailDetails(
          [
            { label: 'Property', value: propertyName },
            { label: 'Badge serial', value: badgeSerial },
            {
              label: 'Status',
              value:
                '<span style="color:#2E7D32;font-weight:bold;">ACTIVE</span>',
              html: true,
            },
          ],
          'Badge details',
        ),
        emailButton('Download Your Badge', badgeUrl),
        emailParagraph(
          'Display your badge on your listing to show guests that your property is verified.',
        ),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendCertificationRejectedEmail(
    email: string,
    hostName: string,
    propertyName: string,
    reviewNotes: string,
  ): Promise<boolean> {
    const subject = 'Certification Application Update';
    const applicationUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/certifications`;

    const html = renderEmail({
      preheader: `We need a little more information for ${propertyName}.`,
      eyebrow: 'Application Update',
      title: 'We need a bit more information',
      greeting: `Dear ${hostName},`,
      body: [
        emailParagraph(
          `Thank you for submitting your certification application for <strong>${esc(propertyName)}</strong>. After careful review, we need some additional information before we can complete your certification.`,
        ),
        emailNotice(esc(reviewNotes), 'warning', 'Reviewer notes'),
        emailParagraph(
          'Please update your application with the details above and resubmit it for review.',
        ),
        emailButton('Update Application', applicationUrl),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendRenewalReminderEmail(
    email: string,
    hostName: string,
    propertyName: string,
    daysUntilExpiry: number,
  ): Promise<boolean> {
    const subject = `Certification Expiring Soon - ${daysUntilExpiry} Days Remaining`;
    const renewUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/certifications`;

    const html = renderEmail({
      preheader: `${propertyName} expires in ${daysUntilExpiry} days. Renew to stay verified.`,
      eyebrow: 'Renewal Reminder',
      title: 'Your certification expires soon',
      greeting: `Dear ${hostName},`,
      body: [
        emailParagraph(
          `Your certification for <strong>${esc(propertyName)}</strong> is approaching its expiry date.`,
        ),
        emailDetails(
          [
            { label: 'Property', value: propertyName },
            { label: 'Days remaining', value: String(daysUntilExpiry) },
          ],
          'Certification status',
        ),
        emailParagraph(
          'To maintain your verified status without interruption, please renew before the expiry date.',
        ),
        emailButton('Renew Certification', renewUrl),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendCertificationExpiredEmail(
    email: string,
    hostName: string,
    propertyName: string,
  ): Promise<boolean> {
    const subject = 'Certification Expired - Action Required';
    const renewUrl = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/certifications`;

    const html = renderEmail({
      preheader: `${propertyName} is no longer certified. Renew to restore your listing.`,
      eyebrow: 'Action Required',
      title: 'Your certification has expired',
      greeting: `Dear ${hostName},`,
      body: [
        emailParagraph(
          `Your certification for <strong>${esc(propertyName)}</strong> has expired.`,
        ),
        emailNotice(
          'Your property has been removed from the public registry and no longer displays a verified badge.',
          'danger',
          'What this means',
        ),
        emailParagraph(
          'To restore your verified status, please renew your certification.',
        ),
        emailButton('Renew Certification', renewUrl),
      ].join(''),
    });

    return this.sendMail({ to: email, subject, html });
  }

  async sendOTPEmail(to: string, name: string, otp: string) {
    const html = renderEmail({
      preheader: `Your two-factor authentication code is ${otp}.`,
      eyebrow: 'Account Security',
      title: 'Two-factor authentication code',
      greeting: `Hello ${name},`,
      body: [
        emailParagraph(
          'You requested to enable Two-Factor Authentication (2FA) for your account. Use the code below to continue.',
        ),
        emailCode(otp, 'This code expires in 10 minutes'),
        emailNotice(
          'If you did not request this code, please ignore this email and review your account security — someone may have your password.',
          'warning',
          "Didn't request this?",
        ),
      ].join(''),
    });

    await this.sendMail({
      to,
      subject: 'Your Two-Factor Authentication Code',
      html,
      text: `Hello ${name},\n\nYour Two-Factor Authentication code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
      from: `"${this.configService.get<string>('MAIL_FROM_NAME', 'E-Movers')}" <${this.configService.get<string>('MAIL_FROM_ADDRESS')}>`,
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify transporter is ready
      await this.transporter.verify();
      this.logger.log('✅ Email service health check passed');
      return true;
    } catch (error) {
      this.logger.error('❌ Email service health check failed', error);
      return false;
    }
  }

  // Diagnostic method to test SMTP connection
  async diagnoseSMTPConnection(): Promise<{
    status: 'ok' | 'error';
    details: string;
    config: {
      host: string;
      port: number;
      secure: boolean;
      encryption: string;
    };
  }> {
    try {
      const host = this.configService.get<string>('MAIL_HOST');
      const port = this.configService.get<number>('MAIL_PORT');
      const encryption = this.configService.get<string>(
        'MAIL_ENCRYPTION',
        'tls',
      );
      const secure = port === 465 || encryption?.toLowerCase() === 'ssl';

      await this.transporter.verify();

      return {
        status: 'ok',
        details: `Successfully connected to ${host}:${port}`,
        config: {
          host: host || '',
          port: port || 587,
          secure,
          encryption: encryption || 'tls',
        },
      };
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error);
      const host = this.configService.get<string>('MAIL_HOST');
      const port = this.configService.get<number>('MAIL_PORT');
      const encryption = this.configService.get<string>(
        'MAIL_ENCRYPTION',
        'tls',
      );
      const secure = port === 465 || encryption?.toLowerCase() === 'ssl';

      this.logger.error(
        `📋 SMTP Connection Diagnostic:`,
        `Host: ${host}, Port: ${port}, Secure: ${secure}, Encryption: ${encryption}, Error: ${errorMsg}`,
      );

      return {
        status: 'error',
        details: errorMsg,
        config: {
          host: host || '',
          port: port || 587,
          secure,
          encryption: encryption || 'tls',
        },
      };
    }
  }

  async sendAnnouncementEmail(
    email: string,
    userName: string,
    title: string,
    description: string,
    data?: { announcementId?: string | number; imageUrl?: string },
  ): Promise<boolean> {
    const subject = `New Announcement: ${title}`;

    const imageSection = data?.imageUrl
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
        <tr>
          <td align="center">
            <img src="${esc(data.imageUrl)}" alt="${esc(title)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:4px;" />
          </td>
        </tr>
      </table>`
      : '';

    const html = renderEmail({
      preheader: title,
      eyebrow: 'Announcement',
      title,
      greeting: `Hello ${userName},`,
      // `description` is authored in the admin panel and may contain markup.
      body: [
        imageSection,
        `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;line-height:24px;color:#333333;">${description}</div>`,
      ].join(''),
    });

    try {
      return await this.sendMail({
        to: email,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send announcement email to ${email}`, error);
      return false;
    }
  }

  async sendPaymentConfirmationEmail(
    email: string,
    hostName: string,
    propertyName: string,
    amount: number,
    currency: string,
    applicationId: string,
    transactionId: string,
  ): Promise<boolean> {
    const subject = 'Payment Confirmed - Certification Application';

    const html = renderEmail({
      preheader: `We received your payment of ${amount.toFixed(2)} ${currency}.`,
      eyebrow: 'Payment Received',
      title: 'Your payment is confirmed',
      greeting: `Hello ${hostName},`,
      body: [
        emailParagraph('Your payment has been processed successfully.'),
        emailDetails(
          [
            { label: 'Amount', value: `${amount.toFixed(2)} ${currency}` },
            { label: 'Property', value: propertyName },
            { label: 'Application ID', value: applicationId },
            { label: 'Transaction ID', value: transactionId },
            {
              label: 'Status',
              value:
                '<span style="color:#2E7D32;font-weight:bold;">COMPLETED</span>',
              html: true,
            },
          ],
          'Payment details',
        ),
        emailParagraph(
          'Your application has moved to the submission phase. Our team will review it and keep you updated by email.',
        ),
      ].join(''),
      footerNote: 'Please keep this email as your receipt.',
    });

    try {
      const result = await this.sendMail({
        to: email,
        subject,
        html,
      });

      console.log('✅ Payment confirmation email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('❌ Payment confirmation email failed:', error.message);
      console.error(error);
      return false;
    }
  }

  async sendMovingBookingEmail(bookingData: {
    email: string;
    id: string;
    serviceType: string;
    preferredDate: string;
    pickupLocation: string;
    dropOffLocation: string;
    isCompany: boolean;
    comments?: string;
  }): Promise<void> {
    const subject = 'Your Moving Service Booking is Confirmed';
    const preferredDate = new Date(
      bookingData.preferredDate,
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = renderEmail({
      preheader: `Booking ${bookingData.id} received for ${preferredDate}.`,
      eyebrow: 'Booking Received',
      title: 'Your move is booked',
      body: [
        emailParagraph(
          'Thank you for choosing E-Movers. We have received your booking and our team will contact you shortly to confirm the details.',
        ),
        emailDetails(
          [
            { label: 'Booking ID', value: bookingData.id },
            {
              label: 'Service type',
              value: bookingData.serviceType.toUpperCase(),
            },
            { label: 'Preferred date', value: preferredDate },
            { label: 'Pickup location', value: bookingData.pickupLocation },
            { label: 'Drop-off location', value: bookingData.dropOffLocation },
            {
              label: 'Client type',
              value: bookingData.isCompany ? 'Company' : 'Individual',
            },
          ],
          'Booking summary',
        ),
        bookingData.comments
          ? emailNotice(esc(bookingData.comments), 'info', 'Your comments')
          : '',
        emailParagraph('No mess, no stress — we will take it from here.'),
      ].join(''),
    });

    await this.sendMail({ to: bookingData.email, subject, html });
  }

  async sendStorageBookingEmail(bookingData: {
    email: string;
    id: string;
    storageType: string;
    rentalPlan: string;
    storageSize: string;
    location: string;
    userType: string;
    comments?: string;
  }): Promise<void> {
    const subject = 'Your Storage Booking is Confirmed';
    const html = renderEmail({
      preheader: `Storage booking ${bookingData.id} received.`,
      eyebrow: 'Booking Received',
      title: 'Your storage is booked',
      body: [
        emailParagraph(
          'Thank you for choosing E-Movers. We have received your storage booking and our team will be in touch shortly to confirm the details.',
        ),
        emailDetails(
          [
            { label: 'Booking ID', value: bookingData.id },
            { label: 'Storage type', value: bookingData.storageType },
            { label: 'Rental plan', value: bookingData.rentalPlan },
            { label: 'Storage size', value: bookingData.storageSize },
            { label: 'Location', value: bookingData.location },
            { label: 'User type', value: bookingData.userType },
          ],
          'Booking summary',
        ),
        bookingData.comments
          ? emailNotice(esc(bookingData.comments), 'info', 'Your comments')
          : '',
        emailParagraph(
          'Your belongings will be kept in our 100,000+ sq.ft secure storage facility.',
        ),
      ].join(''),
    });

    await this.sendMail({ to: bookingData.email, subject, html });
  }

  async sendBookingCancellationEmail(bookingData: {
    email: string;
    id: string;
    service: string;
    details: string;
  }): Promise<void> {
    const subject = 'Your Booking has been Cancelled';
    const html = renderEmail({
      preheader: `Booking ${bookingData.id} has been cancelled.`,
      eyebrow: 'Booking Cancelled',
      title: 'Your booking has been cancelled',
      body: [
        emailParagraph(
          'We are writing to confirm that the booking below has been cancelled and removed from our system.',
        ),
        emailDetails(
          [
            { label: 'Booking ID', value: bookingData.id },
            { label: 'Service type', value: bookingData.service },
          ],
          'Cancelled booking',
        ),
        emailNotice(esc(bookingData.details), 'danger', 'Booking details'),
        emailParagraph(
          'If this was not intended, or you would like to rebook, please contact our team and we will be glad to help.',
        ),
      ].join(''),
    });

    await this.sendMail({ to: bookingData.email, subject, html });
  }
}
