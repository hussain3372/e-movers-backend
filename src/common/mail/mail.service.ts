import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

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

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${firstName || ''},</h2>
      <p>Thank you for registering with the E House Movers Platform.</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="margin: 20px 0;">
        <a href="${verifyUrl}" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p>If you didn’t create an account, you can safely ignore this email.</p>
      <p>Best regards,<br>E House Movers Team</p>
    </div>
  `;

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

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${firstName || ''},</h2>
      <p>Your email verification code is:</p>

      <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; 
                  background: #f3f4f6; padding: 12px; text-align: center;">
        ${otp}
      </div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>
      <p>If you did not create this account, please ignore this email.</p>

      <p>Best regards,<br/>E House Movers Team</p>
    </div>
  `;

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
    const subject = 'Welcome to E-movers Company!';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome ${firstName}!</h2>
      <p>We are excited to have you on board at the E-movers Company.</p>
      <p>If you have any questions, our support team is here to help.</p>
      <p style="margin-top: 30px;">Best regards,<br>E-movers Team</p>
    </div>
  `;

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

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password.</p>
      <p>Please click the link below to reset your password:</p>
      <div style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </div>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this reset, please ignore this email.</p>
      <p>Best regards,<br>E House Movers Team</p>
    </div>
  `;

    return this.sendMail({ to: email, subject, html });
  }

  async sendAdminWelcomeEmail(
    email: string,
    firstName: string,
    temporaryPassword: string,
  ): Promise<void> {
    const subject = 'Welcome to Admin Panel';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to the Admin Panel!</h2>
      <p>Hi ${firstName},</p>
      <p>You have been added as an administrator. Here are your login credentials:</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      </div>
      <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
      <p>You can login at: <a href="${process.env.FRONTEND_URL}/admin/login">Admin Login</a></p>
      <br>
      <p>Best regards,<br>Your Team</p>
    </div>
  `;

    await this.sendMail({ to: email, subject, html });
  }

  async sendNewAdminNotificationEmail(
    email: string,
    firstName: string,
    newAdminData: { name: string; email: string; addedBy: string },
  ): Promise<void> {
    const subject = 'New Admin Added - Notification';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Admin Added</h2>
      <p>Hi ${firstName},</p>
      <p>This is to inform you that a new administrator has been added to the system.</p>
      <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-left: 4px solid #2196F3;">
        <p><strong>Admin Name:</strong> ${newAdminData.name}</p>
        <p><strong>Admin Email:</strong> ${newAdminData.email}</p>
        <p><strong>Added By:</strong> ${newAdminData.addedBy}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>This is an automated notification for your attention.</p>
      <br>
      <p>Best regards,<br>System Administrator</p>
    </div>
  `;

    await this.sendMail({ to: email, subject, html });
  }

  async sendAdminDeletedNotificationEmail(
    email: string,
    firstName: string,
    deletedAdminData: { name: string; email: string; deletedBy: string },
  ): Promise<void> {
    const subject = 'Admin Account Deleted - Notification';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Admin Account Deleted</h2>
      <p>Hi ${firstName},</p>
      <p>This is to inform you that an administrator account has been deleted from the system.</p>
      <div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-left: 4px solid #ff9800;">
        <p><strong>Admin Name:</strong> ${deletedAdminData.name}</p>
        <p><strong>Admin Email:</strong> ${deletedAdminData.email}</p>
        <p><strong>Deleted By:</strong> ${deletedAdminData.deletedBy}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>This is an automated notification for your attention.</p>
      <br>
      <p>Best regards,<br>System Administrator</p>
    </div>
  `;

    await this.sendMail({ to: email, subject, html });
  }

  async sendCertificationApprovedEmail(
    email: string,
    hostName: string,
    propertyName: string,
    badgeSerial: string,
  ): Promise<boolean> {
    const subject = 'Certification Approved - Digital Badge Ready';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Congratulations ${hostName}!</h2>
        <p>Your certification application for <strong>${propertyName}</strong> has been approved.</p>
        <p>Your digital badge is now ready for download:</p>
        <ul>
          <li>Badge Serial: ${badgeSerial}</li>
          <li>Status: Active</li>
        </ul>
        <div style="margin: 20px 0;">
          <a href="#" style="background-color: #EFFC76; color: black; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Download Badge
          </a>
        </div>
        <p>Best regards,<br>E House Movers Team</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, html });
  }

  async sendCertificationRejectedEmail(
    email: string,
    hostName: string,
    propertyName: string,
    reviewNotes: string,
  ): Promise<boolean> {
    const subject = 'Certification Application Update';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Application Update</h2>
        <p>Dear ${hostName},</p>
        <p>Thank you for submitting your certification application for <strong>${propertyName}</strong>.</p>
        <p>After careful review, we need some additional information to complete your certification:</p>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>Review Notes:</strong><br>
          ${reviewNotes}
        </div>
        <p>Please update your application and resubmit for review.</p>
        <div style="margin: 20px 0;">
          <a href="#" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Update Application
          </a>
        </div>
        <p>Best regards,<br>E House Movers Team</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, html });
  }

  async sendRenewalReminderEmail(
    email: string,
    hostName: string,
    propertyName: string,
    daysUntilExpiry: number,
  ): Promise<boolean> {
    const subject = `Certification Expiring Soon - ${daysUntilExpiry} Days Remaining`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Certification Renewal Reminder</h2>
        <p>Dear ${hostName},</p>
        <p>Your certification for <strong>${propertyName}</strong> will expire in <strong>${daysUntilExpiry} days</strong>.</p>
        <p>To maintain your verified status, please renew your certification before the expiry date.</p>
        <div style="margin: 20px 0;">
          <a href="#" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Renew Certification
          </a>
        </div>
        <p>Best regards,<br>E House Movers Team</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, html });
  }

  async sendCertificationExpiredEmail(
    email: string,
    hostName: string,
    propertyName: string,
  ): Promise<boolean> {
    const subject = 'Certification Expired - Action Required';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Certification Expired</h2>
        <p>Dear ${hostName},</p>
        <p>Your certification for <strong>${propertyName}</strong> has expired.</p>
        <p>Your property has been removed from the public registry. To restore your verified status, please renew your certification immediately.</p>
        <div style="margin: 20px 0;">
          <a href="#" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            Renew Certification
          </a>
        </div>
        <p>Best regards,<br>E House Movers Team</p>
      </div>
    `;

    return this.sendMail({ to: email, subject, html });
  }

  async sendOTPEmail(to: string, name: string, otp: string) {
    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject: 'Your Two-Factor Authentication Code',
      html: `
        <div class="container">
            <div class="header">
              <h1>Two-Factor Authentication</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>You have requested to enable Two-Factor Authentication (2FA) for your account.</p>
              <p>Please use the following verification code:</p>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in <strong>10 minutes</strong>.</p>
              <p class="warning">⚠️ If you did not request this code, please ignore this email and ensure your account is secure.</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Your Company. All rights reserved.</p>
            </div>
          </div>
      `,
      text: `Hello ${name},\n\nYour Two-Factor Authentication code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
    };

    await this.transporter.sendMail(mailOptions);
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
      <div style="margin: 20px 0; text-align: center;">
        <img src="${data.imageUrl}" 
             alt="${title}" 
             style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      </div>
    `
      : '';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📢 New Announcement</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #374151; font-size: 16px;">Hello ${userName},</p>
        
        <h2 style="color: #1f2937; margin-top: 20px; margin-bottom: 15px;">${title}</h2>
        
        ${imageSection}
        
        <div style="color: #4b5563; line-height: 1.6; margin: 20px 0;">
          ${description}
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
          Best regards,<br>
          <strong>E House Movers Team</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p>© ${new Date().getFullYear()} E House Movers Platform. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </div>
  `;

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

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #22c55e;">Payment Confirmed ✓</h2>
      <p>Hello ${hostName},</p>
      <p>Your payment has been successfully processed.</p>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Payment Details</h3>
        <p><strong>Amount:</strong> $${amount.toFixed(2)} ${currency}</p>
        <p><strong>Application ID:</strong> ${applicationId}</p>
        <p><strong>Property:</strong> ${propertyName}</p>
        <p><strong>Transaction ID:</strong> ${transactionId}</p>
        <p><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">COMPLETED</span></p>
      </div>
      
      <p>Your application is now in the submission phase. Our team will review your application and you will receive updates via email.</p>
      
      <p style="margin-top: 30px;">Best regards,<br><strong>E House Movers Team</strong></p>
    </div>
  `;

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
    const subject = 'New Moving Service Booking Received';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          New Moving Service Booking
        </h2>
        
        <div style="margin-top: 20px;">
          <p style="margin: 10px 0;"><strong>Booking ID:</strong> ${bookingData.id}</p>
          <p style="margin: 10px 0;"><strong>Service Type:</strong> ${bookingData.serviceType.toUpperCase()}</p>
          <p style="margin: 10px 0;"><strong>Preferred Date:</strong> ${new Date(
            bookingData.preferredDate,
          ).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</p>
          <p style="margin: 10px 0;"><strong>Pickup Location:</strong> ${bookingData.pickupLocation}</p>
          <p style="margin: 10px 0;"><strong>Drop-off Location:</strong> ${bookingData.dropOffLocation}</p>
          <p style="margin: 10px 0;"><strong>Client Type:</strong> ${bookingData.isCompany ? 'Company' : 'Individual'}</p>
          ${bookingData.comments ? `<p style="margin: 10px 0;"><strong>Comments:</strong> ${bookingData.comments}</p>` : ''}
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated notification from E-movers Company booking system.
          </p>
        </div>
      </div>
    `;

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
    const subject = 'New Storage Service Booking Received';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          New Storage Service Booking
        </h2>
        
        <div style="margin-top: 20px;">
          <p style="margin: 10px 0;"><strong>Booking ID:</strong> ${bookingData.id}</p>
          <p style="margin: 10px 0;"><strong>Storage Type:</strong> ${bookingData.storageType}</p>
          <p style="margin: 10px 0;"><strong>Rental Plan:</strong> ${bookingData.rentalPlan}</p>
          <p style="margin: 10px 0;"><strong>Storage Size:</strong> ${bookingData.storageSize}</p>
          <p style="margin: 10px 0;"><strong>Location:</strong> ${bookingData.location}</p>
          <p style="margin: 10px 0;"><strong>User Type:</strong> ${bookingData.userType}</p>
          ${bookingData.comments ? `<p style="margin: 10px 0;"><strong>Comments:</strong> ${bookingData.comments}</p>` : ''}
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated notification from E-movers Company booking system.
          </p>
        </div>
      </div>
    `;

    await this.sendMail({ to: bookingData.email, subject, html });
  }

  async sendBookingCancellationEmail(bookingData: {
    email: string;
    id: string;
    service: string;
    details: string;
  }): Promise<void> {
    const subject = 'Your Booking has been Cancelled';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
          Your Booking has been Cancelled
        </h2>
        
        <div style="margin-top: 20px;">
          <p style="margin: 10px 0;"><strong>Booking ID:</strong> ${bookingData.id}</p>
          <p style="margin: 10px 0;"><strong>Service Type:</strong> ${bookingData.service}</p>
          <p style="margin: 10px 0;"><strong>Booking Details:</strong></p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px;">
            ${bookingData.details}
          </div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
          <p style="color: #7f8c8d; font-size: 12px;">
            This booking has been deleted from the system.
          </p>
        </div>
      </div>
    `;

    await this.sendMail({ to: bookingData.email, subject, html });
  }
}
