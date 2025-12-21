import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StorageService } from '../storage/storage.service'; // Adjust import path
import { AuditService } from '../audit/audit.service'; // Adjust import path
import { Logger } from '@nestjs/common';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  // Validation rules for profile pictures
  private readonly profilePictureValidation = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService
  ) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName ?? existingUser.firstName,
        lastName: dto.lastName ?? existingUser.lastName,
        email: dto.email ?? existingUser.email,
        profilePicture: dto.profilePicture ?? existingUser.profilePicture,
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
    });
  }

  async uploadProfilePicture(
    userId: number,
    file: Express.Multer.File,
    userEmail: string,
    userRole: string
  ) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upload file to storage
    const uploadResult = await this.storageService.uploadFile(
      file,
      `users/${userId}/profile`,
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        maxSize: this.profilePictureValidation.maxSize,
        allowedTypes: this.profilePictureValidation.allowedTypes,
        allowedExtensions: this.profilePictureValidation.allowedExtensions,
      }
    );

    // If user already has a profile picture, delete the old one
    if (user.profilePicture) {
      try {
        // Extract key from old URL or use stored key
        const oldKey = this.extractKeyFromUrl(user.profilePicture);
        if (oldKey) {
          await this.storageService.deleteFile(oldKey);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete old profile picture: ${error.message}`,
          'ProfileService'
        );
        // Continue with upload even if deletion fails
      }
    }

    // Update user record with new profile picture URL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: uploadResult.url,
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
    });

    // Audit the profile picture upload
    await this.auditService.auditFileOperation(
      'PROFILE_PICTURE_UPLOAD',
      userId.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        fileSize: uploadResult.size,
        originalName: file.originalname,
        url: uploadResult.url,
      }
    );

    this.logger.log(
      `Profile picture uploaded for user: ${userId}`,
      'ProfileService',
      {
        userId,
        fileSize: uploadResult.size,
      }
    );

    return updatedUser;
  }

  async deleteProfilePicture(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.profilePicture) {
      throw new BadRequestException('No profile picture to delete');
    }

    // Delete file from storage
    try {
      const key = this.extractKeyFromUrl(user.profilePicture);
      if (key) {
        await this.storageService.deleteFile(key);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete profile picture from storage: ${error.message}`,
        'ProfileService'
      );
      // Continue with database update even if storage deletion fails
    }

    // Update user record
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
      },
    });

    this.logger.log(
      `Profile picture deleted for user: ${userId}`,
      'ProfileService'
    );

    return updatedUser;
  }

  async deleteProfile(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Delete profile picture if exists
    if (user.profilePicture) {
      try {
        const key = this.extractKeyFromUrl(user.profilePicture);
        if (key) {
          await this.storageService.deleteFile(key);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete profile picture during profile deletion: ${error.message}`,
          'ProfileService'
        );
      }
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      // If your storage service returns full URLs like:
      // https://bucket.s3.region.amazonaws.com/users/123/profile/filename.jpg
      // Extract the key part: users/123/profile/filename.jpg
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading '/'
    } catch (error) {
      this.logger.warn(`Failed to extract key from URL: ${url}`);
      return null;
    }
  }
}
