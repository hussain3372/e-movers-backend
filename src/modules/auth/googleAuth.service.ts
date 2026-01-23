import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GoogleTokenPayload {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  sub: string;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async verifyToken(token: string): Promise<GoogleTokenPayload> {
    try {
      // Call Google's OAuth2 API to verify the token
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );

      const googleUser = response.data;

      // Validate required fields
      if (!googleUser.email) {
        throw new UnauthorizedException(
          'Google account does not have a valid email',
        );
      }

      // Optional: Check if email is verified
      if (!googleUser.email_verified) {
        throw new UnauthorizedException('Google email not verified');
      }

      return {
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name || 'Unknown',
        picture: googleUser.picture || '',
        given_name: googleUser.given_name,
        family_name: googleUser.family_name,
        locale: googleUser.locale,
        sub: googleUser.sub,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Handle HTTP errors from Google API
      if (error.response?.status === 401 || error.response?.status === 400) {
        throw new UnauthorizedException('Invalid or expired Google token');
      }

      throw new UnauthorizedException(
        `Failed to verify Google token: ${error.message}`,
      );
    }
  }
}
