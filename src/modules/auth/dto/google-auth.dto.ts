import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Google OAuth token' })
  token: string;

  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'User role', enum: UserRole, required: false })
  role?: UserRole;
}