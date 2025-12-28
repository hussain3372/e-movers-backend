// posters.service.ts
import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PostersService {
  private readonly logger = new Logger(PostersService.name);
  private readonly imageValidation = {
    maxSize: 10 * 1024 * 1024, // 10MB for posters
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async create(
    file: Express.Multer.File,
    userId: number,
    userEmail: string,
    userRole: string,
  ) {
    // Upload poster to storage
    const uploadResult = await this.storage.uploadFile(
      file,
      'posters',
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      this.imageValidation,
    );

    // Create poster record in database
    const poster = await this.prisma.poster.create({
      data: {
        imageUrl: uploadResult.url,
        fileName: file.originalname,
        fileSize: uploadResult.size,
        uploadedBy: userId,
      },
    });

    // Audit the operation
    await this.audit.auditFileOperation(
      'POSTER_UPLOAD',
      poster.id.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        fileSize: uploadResult.size,
        originalName: file.originalname,
        url: uploadResult.url,
      },
    );

    this.logger.log(`Poster uploaded: ${poster.id}`, 'PostersService', {
      posterId: poster.id,
      userId,
      fileSize: uploadResult.size,
    });

    return poster;
  }

  async findAll() {
    return this.prisma.poster.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        imageUrl: true,
        fileName: true,
        fileSize: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const poster = await this.prisma.poster.findUnique({
      where: { id },
    });

    if (!poster) {
      throw new NotFoundException('Poster not found');
    }

    return poster;
  }

  async update(
    id: number,
    file: Express.Multer.File,
    userId: number,
    userEmail: string,
    userRole: string,
  ) {
    // Validate poster exists
    const poster = await this.findOne(id);

    // Upload new poster to storage
    const uploadResult = await this.storage.uploadFile(
      file,
      'posters',
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      this.imageValidation,
    );

    // Delete old poster from storage
    if (poster.imageUrl) {
      try {
        const oldKey = this.extractKeyFromUrl(poster.imageUrl);
        if (oldKey) {
          await this.storage.deleteFile(oldKey);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete old poster: ${error.message}`,
          'PostersService',
        );
      }
    }

    // Update poster record
    const updatedPoster = await this.prisma.poster.update({
      where: { id },
      data: {
        imageUrl: uploadResult.url,
        fileName: file.originalname,
        fileSize: uploadResult.size,
        updatedAt: new Date(),
      },
    });

    // Audit the operation
    await this.audit.auditFileOperation(
      'POSTER_UPDATE',
      id.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        fileSize: uploadResult.size,
        originalName: file.originalname,
        url: uploadResult.url,
        oldUrl: poster.imageUrl,
      },
    );

    this.logger.log(`Poster updated: ${id}`, 'PostersService', {
      posterId: id,
      userId,
      fileSize: uploadResult.size,
    });

    return updatedPoster;
  }

  async remove(
    id: number,
    userId: number,
    userEmail: string,
    userRole: string,
  ) {
    // Validate poster exists
    const poster = await this.findOne(id);

    // Delete poster from storage
    if (poster.imageUrl) {
      try {
        const key = this.extractKeyFromUrl(poster.imageUrl);
        if (key) {
          await this.storage.deleteFile(key);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete poster file: ${error.message}`,
          'PostersService',
        );
      }
    }

    // Delete poster record
    await this.prisma.poster.delete({
      where: { id },
    });

    // Audit the deletion
    await this.audit.auditFileOperation(
      'POSTER_DELETE',
      id.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        fileName: poster.fileName,
        imageUrl: poster.imageUrl,
      },
    );

    this.logger.log(`Poster deleted: ${id}`, 'PostersService', {
      posterId: id,
      userId,
    });

    return { message: 'Poster deleted successfully' };
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading '/'
    } catch {
      return null;
    }
  }
}
