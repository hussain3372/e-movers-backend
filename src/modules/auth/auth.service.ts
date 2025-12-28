// auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RedisService } from '@/redis/redis.service';
import { randomInt } from 'crypto';
import { GoogleUserData } from './interfaces/google-user.interface';
import { MailService } from 'src/common/mail/mail.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  user: {
    id: number;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    isEmail: boolean;
    isNotification: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private readonly redisService: RedisService
  ) {}

  private async comparePasswords(
    plainText: string,
    hashed: string
  ): Promise<boolean> {
    return bcrypt.compare(plainText, hashed);
  }

  // Generate 4-digit OTP
  private generateOTP(): string {
    return randomInt(1000, 9999).toString();
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<any> {
    const { email, password, fcmToken } = loginDto;

    // ✅ Check if email exists
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('No account found with this email.');
    }

    // ✅ Check email verification status
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please check your email for verification OTP.'
      );
    }

    // ✅ Check password correctness
    const isPasswordValid = await this.comparePasswords(
      password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect password.');
    }

    // ✅ Save FCM token if provided
    if (fcmToken) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fcmToken },
      });
    }

    // ✅ MFA flow
    if (user.mfaEnabled) {
      const otp = this.generateOTP();

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: otp,
          resetPasswordExpires: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      await this.mailService.sendOTPEmail(user.email, user.name, otp);

      return {
        message: 'OTP sent to your email for verification.',
        mfaRequired: true,
        email: user.email,
      };
    }

    // ✅ Normal login flow
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user);

    return {
      status: 'success',
      message: 'Successfully logged in.',
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstName,
        lastname: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        isEmail: user.isEmail,
        isNotification: user.isNotification,
        profilePicture: user.profilePicture,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async sendOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found.');

    const otp = this.generateOTP();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: otp,
        resetPasswordExpires: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.mailService.sendOTPEmail(user.email, user.name, otp);

    return { status: 'success', message: 'OTP sent successfully.' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found.');

    if (!user.resetPasswordToken || user.resetPasswordToken !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new UnauthorizedException('OTP expired.');
    }

    // Clear OTP fields
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: null,
        resetPasswordExpires: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      status: 'success',
      message: 'OTP verified successfully.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        isEmail: user.isEmail,
        isNotification: user.isNotification,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async register(
    registerDto: RegisterDto
  ): Promise<{ status: string; message: string; userId: number }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Generate 4-digit OTP for email verification
    const otp = this.generateOTP();

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email.toLowerCase(),
        password: hashedPassword,
        name: `${registerDto.firstName} ${registerDto.lastName}`.trim(),
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: UserRole.USER,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        emailVerificationToken: otp,
        resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      },
    });

    // 📧 Send email verification OTP
    if (user.isEmail === true) {
      await this.mailService.sendEmailVerificationOTP(
        user.email,
        otp,
        registerDto.firstName
      );
    }

    return {
      status: 'success',
      message:
        'Registration successful. Please check your email for verification OTP.',
      userId: user.id,
    };
  }

  // Verify Email with OTP
  async verifyEmail(
    email: string,
    otp: string
  ): Promise<{ status: string; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      return { status: 'success', message: 'Email already verified' };
    }

    if (!user.emailVerificationToken || user.emailVerificationToken !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        emailVerificationToken: null,
        resetPasswordExpires: null,
        updatedAt: new Date(),
      },
    });

    // ✅ Send Welcome Email after successful verification
    await this.mailService.sendWelcomeEmail(
      user.email,
      user.firstName || user.name
    );

    return { status: 'success', message: 'Email verified successfully' };
  }

  // Resend Email Verification OTP
  async resendEmailVerificationOTP(
    email: string
  ): Promise<{ status: string; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      return { status: 'success', message: 'Email already verified' };
    }

    const otp = this.generateOTP();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: otp,
        resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.mailService.sendEmailVerificationOTP(
      user.email,
      otp,
      user.firstName || user.name
    );

    return {
      status: 'success',
      message: 'Verification OTP sent successfully.',
    };
  }

  // change password from profile
  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto
  ): Promise<{ status: string; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      12
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    return { status: 'success', message: 'Password changed successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto
  ): Promise<{ status: string; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email.toLowerCase() },
    });

    // Always return the same message for security
    if (!user) {
      return {
        status: 'success',
        message:
          'If an account with this email exists, a password reset OTP has been sent.',
      };
    }

    // Generate 4-digit OTP for password reset
    const otp = this.generateOTP();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: otp,
        resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // 📧 Send password reset OTP
    if (user.isEmail === true) {
      await this.mailService.sendEmailVerificationOTP(
        user.email,
        otp,
        user.firstName || user.name
      );
    }

    return {
      status: 'success',
      message:
        'If an account with this email exists, a password reset OTP has been sent.',
    };
  }

  // Verify Reset Password OTP and Reset Password
  async resetPassword(
    resetPasswordDto: ResetPasswordDto
  ): Promise<{ status: string; message: string }> {
    const { email, otp, newPassword, confirmPassword } = resetPasswordDto;

    // 1️⃣ Ensure passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // 2️⃣ Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 3️⃣ Verify OTP
    if (!user.resetPasswordToken || user.resetPasswordToken !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }

    // 4️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 5️⃣ Update user password and clear OTP
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updatedAt: new Date(),
      },
    });

    return { status: 'success', message: 'Password reset successfully' };
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: Number(payload.sub) },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(
    userId: number,
    token: string
  ): Promise<{ status: string; message: string }> {
    // ⏱ Get token TTL (same as JWT expiry)
    const ttl = this.configService.get<number>('JWT_EXPIRATION', 3600);

    // ❌ Blacklist token in Redis until it naturally expires
    await this.redisService.set(`blacklist:${token}`, 'true', ttl);

    return { status: 'success', message: 'Logged out successfully' };
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const exists = await this.redisService.get(`blacklist:${token}`);
    return !!exists;
  }

  public async generateTokens(
    user: User
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m') as any,
    });

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d'
      ) as any,
    });

    return { accessToken, refreshToken };
  }

  async findUserById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateGoogleId(userId: number, googleId: string, picture?: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        profilePicture: picture,
      },
    });
  }

  async createGoogleUser(userData: GoogleUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        firstName: userData.name.split(' ')[0],
        lastName: userData.name.split(' ').slice(1).join(' '),
        googleId: userData.googleId,
        profilePicture: userData.profilePicture,
        role: userData.role,
        emailVerified: userData.emailVerified,
        status: 'ACTIVE',
        password: '',
      },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}