import { User, UserRole } from '@prisma/client';

export interface GoogleUserData {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  googleId: string;
  profilePicture?: string;
  role: UserRole;
  emailVerified: boolean;
}