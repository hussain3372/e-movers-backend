import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Put,
  BadRequestException,
  ValidationPipe,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './googleAuth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserType } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private googleAuthService: GoogleAuthService
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('send-otp')
  async sendOtp(@Body('email') email: string) {
    return this.authService.sendOtp(email);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyOtp(body.email, body.otp);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(ValidationPipe) refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto
  ) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto
  ) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: CurrentUserType,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: CurrentUserType) {
    return {
      status: 'success',
      message: 'Profile fetch successfully',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: CurrentUserType, @Req() req: Request) {
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    return this.authService.logout(user.id, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check')
  @HttpCode(HttpStatus.OK)
  async checkAuth(@CurrentUser() user: CurrentUserType) {
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }

  @Post('google/callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  async googleCallback(@Body(ValidationPipe) googleAuthDto: GoogleAuthDto) {
    // Step 1: Verify Google token
    const googleUser = await this.googleAuthService.verifyToken(
      googleAuthDto.token
    );

    // Step 2: Check if user exists
    const existingUser = await this.authService.findUserByEmail(
      googleUser.email
    );

    if (existingUser) {
      // Step 3a: User exists - Login
      // Update Google profile info if needed
      if (existingUser.googleId !== googleUser.sub) {
        await this.authService.updateGoogleId(
          existingUser.id,
          googleUser.sub,
          googleUser.picture
        );
      }

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens(existingUser);

      return {
        message: 'Login successful',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
          profilePicture: googleUser.picture,
        },
        ...tokens,
      };
    } else {
      // Step 3b: User doesn't exist - Register
      const role = googleAuthDto.role || UserRole.USER;

      const newUser = await this.authService.createGoogleUser({
        email: googleUser.email,
        name: googleUser.name,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        googleId: googleUser.sub,
        profilePicture: googleUser.picture,
        role,
        emailVerified: googleUser.email_verified,
      });

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens(newUser);

      return {
        message: 'Registration successful',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          profilePicture: googleUser.picture,
        },
        ...tokens,
        isNewUser: true,
      };
    }
  }

  // Optional: Endpoint to get Google client ID for frontend
  @Post('google/config')
  @Public()
  @HttpCode(HttpStatus.OK)
  getGoogleConfig() {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
    };
  }
}
