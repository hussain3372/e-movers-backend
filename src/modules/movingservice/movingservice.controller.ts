// movingservice/movingservice.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { MovingServiceService } from './movingservice.service';
import { CreateServiceDto, ServiceType } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('movingservice')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovingServiceController {
  constructor(private readonly movingServiceService: MovingServiceService) {}

  // POST /movingservice - Create a new service with logo and banner upload
  @Post()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'bannerImg', maxCount: 1 },
    ]),
  )
  async create(
    @Body() createServiceDtoRaw: any,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; bannerImg?: Express.Multer.File[] },
  ) {
    const logo = files?.logo?.[0];
    const bannerImg = files?.bannerImg?.[0];

    if (!logo || !bannerImg) {
      throw new BadRequestException('Both logo and bannerImg files are required');
    }

    // Validate sizes and mime types
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedMime = /^image\/(jpeg|png|webp|svg\+xml)$/;

    for (const f of [logo, bannerImg]) {
      if (f.size > maxSize) {
        throw new BadRequestException('Each file must be <= 5MB');
      }
      if (!allowedMime.test(f.mimetype)) {
        throw new BadRequestException('Invalid file type. Allowed: jpeg, png, webp, svg');
      }
    }

    // Normalize features: accept JSON string or repeated form fields
    let features: string[] | undefined = undefined;
    if (typeof createServiceDtoRaw.features === 'string') {
      try {
        features = JSON.parse(createServiceDtoRaw.features);
      } catch (err) {
        // If parsing fails, try splitting by commas
        features = createServiceDtoRaw.features.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(createServiceDtoRaw.features)) {
      features = createServiceDtoRaw.features;
    }

    const dtoPlain = {
      ...createServiceDtoRaw,
      features,
    };

    const dto = plainToInstance(CreateServiceDto, dtoPlain);
    try {
      await validateOrReject(dto as unknown as object);
    } catch (errors) {
      throw new BadRequestException(errors);
    }

    // For now, using placeholder values - replace with actual auth
    const userId = 'system'; // Replace with actual user ID from auth
    const userEmail = 'system@example.com'; // Replace with actual user email
    const userRole = 'ADMIN'; // Replace with actual user role

    return this.movingServiceService.create(
      dto,
      { logo, bannerImg },
      userId,
      userEmail,
      userRole,
    );
  }

  // GET /movingservice?type=MOVING | STORAGE | (no type = all)
  @Get()
  async findByType(@Query('type') type?: ServiceType) {
    const data = await this.movingServiceService.findByType(
      type as ServiceType,
    );

    return {
      data,
      message: 'Services fetched successfully',
      status: HttpStatus.OK,
    };
  }

  // GET /movingservice/:id - Get a single service by ID
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.movingServiceService.findOne(id);
  }

  // PUT /movingservice/:id - Update a service (type is required, logo is optional)
  @Put(':id')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('logo'))
  async update(
    @Param('id') id: string,
    @Body() updateServiceDtoRaw: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          // new FileTypeValidator({
          //   fileType: /(jpg|jpeg|png|webp|svg)$/,
          // }),
        ],
        fileIsRequired: false, // Logo is optional for update
      }),
    )
    file?: Express.Multer.File,
    // TODO: Get these from JWT token/auth guard
  ) {
    // Normalize features if present
    let features: string[] | undefined = undefined;
    if (typeof updateServiceDtoRaw.features === 'string') {
      try {
        features = JSON.parse(updateServiceDtoRaw.features);
      } catch (err) {
        features = updateServiceDtoRaw.features.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(updateServiceDtoRaw.features)) {
      features = updateServiceDtoRaw.features;
    }

    const dtoPlain = {
      ...updateServiceDtoRaw,
      features,
    };

    const dto = plainToInstance(UpdateServiceDto, dtoPlain);
    try {
      await validateOrReject(dto as unknown as object);
    } catch (errors) {
      throw new BadRequestException(errors);
    }

    // For now, using placeholder values - replace with actual auth
    const userId = 'system'; // Replace with actual user ID from auth
    const userEmail = 'system@example.com'; // Replace with actual user email
    const userRole = 'ADMIN'; // Replace with actual user role

    return this.movingServiceService.update(
      id,
      dto,
      file,
      userId,
      userEmail,
      userRole,
    );
  }

  // DELETE /movingservice/:id - Delete a service
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    // TODO: Get these from JWT token/auth guard
  ) {
    // For now, using placeholder values - replace with actual auth
    const userId = 'system'; // Replace with actual user ID from auth
    const userEmail = 'system@example.com'; // Replace with actual user email
    const userRole = 'ADMIN'; // Replace with actual user role

    return this.movingServiceService.remove(id, userId, userEmail, userRole);
  }
}
