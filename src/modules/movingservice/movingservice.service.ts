// movingservice/movingservice.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { CreateServiceDto, ServiceType } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class MovingServiceService {
  private readonly logger = new Logger(MovingServiceService.name);
  
  // Validation settings for service logos
  private readonly logoValidation = {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async create(
    createServiceDto: CreateServiceDto,
    file: Express.Multer.File,
    userId: string,
    userEmail: string,
    userRole: string,
  ) {
    // Upload logo to S3
    const uploadResult = await this.storage.uploadFile(
      file,
      `services/${createServiceDto.type.toLowerCase()}`,
      userId,
      userEmail,
      userRole.toLowerCase(),
      {
        maxSize: this.logoValidation.maxSize,
        allowedTypes: this.logoValidation.allowedTypes,
        allowedExtensions: this.logoValidation.allowedExtensions,
      },
    );

    // Create service with uploaded logo URL
    const service = await this.prisma.service.create({
      data: {
        logo: uploadResult.url,
        title: createServiceDto.title,
        description: createServiceDto.description,
        type: createServiceDto.type,
      },
    });

    // Audit the creation
    await this.audit.auditFileOperation(
      'SERVICE_LOGO_UPLOAD',
      service.id,
      userId,
      userEmail,
      userRole.toLowerCase(),
      {
        fileSize: uploadResult.size,
        originalName: file.originalname,
        url: uploadResult.url,
        serviceType: service.type,
      },
    );

    this.logger.log(
      `Service created with ID: ${service.id}, Type: ${service.type}`,
      {
        serviceId: service.id,
        type: service.type,
        fileSize: uploadResult.size,
      },
    );

    return service;
  }

  async findByType(type: ServiceType) {
    const services = await this.prisma.service.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });

    return services;
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    file: Express.Multer.File | undefined,
    userId: string,
    userEmail: string,
    userRole: string,
  ) {
    // Check if service exists
    const existingService = await this.findOne(id);

    let logoUrl = existingService.logo;

    // If a new logo file is provided, upload it
    if (file) {
      const uploadResult = await this.storage.uploadFile(
        file,
        `services/${updateServiceDto.type.toLowerCase()}`,
        userId,
        userEmail,
        userRole.toLowerCase(),
        {
          maxSize: this.logoValidation.maxSize,
          allowedTypes: this.logoValidation.allowedTypes,
          allowedExtensions: this.logoValidation.allowedExtensions,
        },
      );

      logoUrl = uploadResult.url;

      // Delete old logo from S3
      if (existingService.logo) {
        try {
          const oldKey = this.extractKeyFromUrl(existingService.logo);
          if (oldKey) {
            await this.storage.deleteFile(oldKey);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to delete old logo: ${error.message}`,
            'MovingServiceService',
          );
        }
      }

      // Audit the logo update
      await this.audit.auditFileOperation(
        'SERVICE_LOGO_UPDATE',
        id,
        userId,
        userEmail,
        userRole.toLowerCase(),
        {
          fileSize: uploadResult.size,
          originalName: file.originalname,
          url: uploadResult.url,
          serviceType: updateServiceDto.type,
        },
      );
    }

    // Update service
    const updatedService = await this.prisma.service.update({
      where: { id },
      data: {
        logo: logoUrl,
        ...(updateServiceDto.title && { title: updateServiceDto.title }),
        ...(updateServiceDto.description && {
          description: updateServiceDto.description,
        }),
        type: updateServiceDto.type, // Type is required
      },
    });

    this.logger.log(`Service updated with ID: ${id}`, {
      serviceId: id,
      type: updatedService.type,
    });

    return updatedService;
  }

  async remove(id: string, userId: string, userEmail: string, userRole: string) {
    // Check if service exists
    const service = await this.findOne(id);

    // Delete logo from S3
    if (service.logo) {
      try {
        const logoKey = this.extractKeyFromUrl(service.logo);
        if (logoKey) {
          await this.storage.deleteFile(logoKey);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete logo during service deletion: ${error.message}`,
          'MovingServiceService',
        );
      }
    }

    // Delete the service
    await this.prisma.service.delete({
      where: { id },
    });

    // Audit the deletion
    await this.audit.auditFileOperation(
      'SERVICE_DELETE',
      id,
      userId,
      userEmail,
      userRole.toLowerCase(),
      {
        serviceType: service.type,
        deletedLogoUrl: service.logo,
      },
    );

    this.logger.log(`Service deleted with ID: ${id}`, {
      serviceId: id,
      type: service.type,
    });

    return { message: 'Service deleted successfully', id };
  }

  /**
   * Extract S3 key from URL
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // For S3 URLs like: https://bucket.s3.region.amazonaws.com/key
      // or https://cloudfront.net/key
      let key = urlObj.pathname.substring(1); // Remove leading slash
      return key || null;
    } catch (error) {
      this.logger.error(`Failed to extract key from URL: ${url}`, error);
      return null;
    }
  }
}