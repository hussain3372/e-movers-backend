// service-locations.service.ts
import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { CreateServiceLocationDto } from './dto/create-service-location.dto';
import { UpdateServiceLocationDto } from './dto/update-service-location.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ServiceLocationsService {
  private readonly logger = new Logger(ServiceLocationsService.name);
  private readonly imageValidation = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createDto: CreateServiceLocationDto,
    file: Express.Multer.File,
    userId: number,
    userEmail: string,
    userRole: string,
  ) {
    // Upload image to storage
    const uploadResult = await this.storageService.uploadFile(
      file,
      'service-locations/images',
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      this.imageValidation,
    );

    // Create service location in database
    const serviceLocation = await this.prisma.serviceLocation.create({
      data: {
        title: createDto.title,
        description: createDto.description,
        imageUrl: uploadResult.url,
        createdBy: userId,
      },
    });

    // Audit the operation
    await this.auditService.auditFileOperation(
      'SERVICE_LOCATION_CREATE',
      serviceLocation.id.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        fileSize: uploadResult.size,
        originalName: file.originalname,
        url: uploadResult.url,
        title: createDto.title,
      },
    );

    this.logger.log(
      `Service location created: ${serviceLocation.id}`,
      'ServiceLocationsService',
      { serviceLocationId: serviceLocation.id, userId },
    );

    return {
      success: true,
      message: 'Service location created successfully',
      serviceLocation,
    };
  }

  async findAll() {
    const data = await this.prisma.serviceLocation.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Service locations fetched successfully',
      data,
    };
  }

  async findOne(id: number) {
    const serviceLocation = await this.prisma.serviceLocation.findUnique({
      where: { id },
    });

    if (!serviceLocation) {
      throw new NotFoundException('Service location not found');
    }

    return serviceLocation;
  }

  async update(
    id: number,
    updateDto: UpdateServiceLocationDto,
    file: Express.Multer.File | undefined,
    userId: number,
    userEmail: string,
    userRole: string, 
  ) {
    // Validate service location exists
    const serviceLocation = await this.findOne(id);

    let imageUrl = serviceLocation.imageUrl;

    // If new image is provided, upload and delete old one
    if (file) {
      const uploadResult = await this.storageService.uploadFile(
        file,
        'service-locations/images',
        userId.toString(),
        userEmail,
        userRole.toLowerCase(),
        this.imageValidation,
      );

      // Delete old image
      if (serviceLocation.imageUrl) {
        try {
          const oldKey = this.extractKeyFromUrl(serviceLocation.imageUrl);
          if (oldKey) {
            await this.storageService.deleteFile(oldKey);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to delete old image: ${error.message}`,
            'ServiceLocationsService',
          );
        }
      }

      imageUrl = uploadResult.url;

      // Audit the image update
      await this.auditService.auditFileOperation(
        'SERVICE_LOCATION_IMAGE_UPDATE',
        id.toString(),
        userId.toString(),
        userEmail,
        userRole.toLowerCase(),
        {
          fileSize: uploadResult.size,
          originalName: file.originalname,
          url: uploadResult.url,
        },
      );
    }

    // Update service location
    const updatedServiceLocation = await this.prisma.serviceLocation.update({
      where: { id },
      data: {
        ...updateDto,
        imageUrl,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Service location updated: ${id}`,
      'ServiceLocationsService',
      { serviceLocationId: id, userId },
    );

    return updatedServiceLocation;
  }

  async remove(
    id: number,
    userId: number,
    userEmail: string,
    userRole: string,
  ) {
    // Validate service location exists
    const serviceLocation = await this.findOne(id);

    // Delete image from storage
    if (serviceLocation.imageUrl) {
      try {
        const key = this.extractKeyFromUrl(serviceLocation.imageUrl);
        if (key) {
          await this.storageService.deleteFile(key);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete image: ${error.message}`,
          'ServiceLocationsService',
        );
      }
    }

    // Delete service location
    await this.prisma.serviceLocation.delete({
      where: { id },
    });

    // Audit the deletion
    await this.auditService.auditFileOperation(
      'SERVICE_LOCATION_DELETE',
      id.toString(),
      userId.toString(),
      userEmail,
      userRole.toLowerCase(),
      {
        title: serviceLocation.title,
        imageUrl: serviceLocation.imageUrl,
      },
    );

    this.logger.log(
      `Service location deleted: ${id}`,
      'ServiceLocationsService',
      { serviceLocationId: id, userId },
    );

    return { message: 'Service location deleted successfully' };
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
