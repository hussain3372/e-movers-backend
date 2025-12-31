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

  // File validation settings
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
  
  private async handleFileUpload(
    file: Express.Multer.File,
    folder: string,
    userId: string,
    userEmail: string,
    userRole: string,
  ) {
    if (!file) return null;

    const uploadResult = await this.storage.uploadFile(
      file,
      folder,
      userId,
      userEmail,
      userRole.toLowerCase(),
      {
        maxSize: this.logoValidation.maxSize,
        allowedTypes: this.logoValidation.allowedTypes,
        allowedExtensions: this.logoValidation.allowedExtensions,
      },
    );

    return uploadResult;
  }

  async create(
    createServiceDto: CreateServiceDto,
    files: { logo?: Express.Multer.File; bannerImg?: Express.Multer.File },
    userId: string,
    userEmail: string,
    userRole: string,
  ) {
    const folder = `services/${createServiceDto.type.toLowerCase()}`;

    const logoFile = files?.logo ?? null;
    const bannerFile = files?.bannerImg ?? null;

    const logoUpload = logoFile ? await this.handleFileUpload(logoFile, folder, userId, userEmail, userRole) : null;
    const bannerUpload = bannerFile ? await this.handleFileUpload(bannerFile, folder, userId, userEmail, userRole) : null;

    const service = await this.prisma.service.create({
      data: {
        logo: logoUpload?.url || '',
        bannerImg: bannerUpload?.url || '',
        title: createServiceDto.title,
        heading: createServiceDto.heading,
        shortdescription: createServiceDto.shortdescription,
        description: createServiceDto.description,
        features: createServiceDto.features,
        type: createServiceDto.type,
      },
    });

    if (logoUpload && logoFile) {
      await this.audit.auditFileOperation(
        'SERVICE_LOGO_UPLOAD',
        service.id,
        userId,
        userEmail,
        userRole.toLowerCase(),
        {
          fileSize: logoUpload.size,
          originalName: logoFile.originalname,
          url: logoUpload.url,
          serviceType: service.type,
        },
      );
    }

    if (bannerUpload && bannerFile) {
      await this.audit.auditFileOperation(
        'SERVICE_BANNER_UPLOAD',
        service.id,
        userId,
        userEmail,
        userRole.toLowerCase(),
        {
          fileSize: bannerUpload.size,
          originalName: bannerFile.originalname,
          url: bannerUpload.url,
          serviceType: service.type,
        },
      );
    }

    this.logger.log(`Service created with ID: ${service.id}`, {
      serviceId: service.id,
      type: service.type,
      logoSize: logoUpload?.size || 0,
      bannerSize: bannerUpload?.size || 0,
    });

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
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundException(`Service with ID ${id} not found`);
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
    const existingService = await this.findOne(id);

    let logoUrl = existingService.logo;

    if (file) {
      const folder = `services/${updateServiceDto.type.toLowerCase()}`;
      const uploadResult = await this.handleFileUpload(file, folder, userId, userEmail, userRole);

      if (uploadResult) {
        logoUrl = uploadResult.url;

        if (existingService.logo) {
          const oldKey = this.extractKeyFromUrl(existingService.logo);
          if (oldKey) await this.storage.deleteFile(oldKey);
        }

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
    }

    const updatedService = await this.prisma.service.update({
      where: { id },
      data: {
        logo: logoUrl,
        ...(updateServiceDto.title && { title: updateServiceDto.title }),
        ...(updateServiceDto.heading && { heading: updateServiceDto.heading }),
        ...(updateServiceDto.description && { description: updateServiceDto.description }),
        ...(updateServiceDto.shortdescription && { shortdescription: updateServiceDto.shortdescription }),
        ...(typeof updateServiceDto.features !== 'undefined' && { features: updateServiceDto.features }),
        type: updateServiceDto.type,
      },
    });

    this.logger.log(`Service updated with ID: ${id}`, {
      serviceId: id,
      type: updatedService.type,
    });

    return updatedService;
  }

  async remove(id: string, userId: string, userEmail: string, userRole: string) {
    const service = await this.findOne(id);

    if (service.logo) {
      const logoKey = this.extractKeyFromUrl(service.logo);
      if (logoKey) await this.storage.deleteFile(logoKey);
    }

    await this.prisma.service.delete({ where: { id } });

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

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const key = urlObj.pathname.substring(1);
      return key || null;
    } catch (error) {
      this.logger.error(`Failed to extract key from URL: ${url}`, error);
      return null;
    }
  }
}
