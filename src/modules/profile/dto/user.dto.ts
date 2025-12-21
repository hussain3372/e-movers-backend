import { UserRole } from '@prisma/client';

export interface CurrentUserType {
  id: number;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}
