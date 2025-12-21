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
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MovingServiceService } from './movingservice.service';
import { CreateServiceDto, ServiceType } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('movingservice')
export class MovingServiceController {
  constructor(private readonly movingServiceService: MovingServiceService) { }

  // POST /movingservice - Create a new service with logo upload
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('logo'))
  async create(
    @Body(ValidationPipe) createServiceDto: CreateServiceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp|svg)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    // TODO: Get these from JWT token/auth guard
    // @CurrentUser() user: { id: string; email: string; role: string }
  ) {
    // For now, using placeholder values - replace with actual auth
    const userId = 'system'; // Replace with actual user ID from auth
    const userEmail = 'system@example.com'; // Replace with actual user email
    const userRole = 'ADMIN'; // Replace with actual user role

    return this.movingServiceService.create(
      createServiceDto,
      file,
      userId,
      userEmail,
      userRole,
    );
  }

  // GET /movingservice?type=MOVING | STORAGE | (no type = all)
  @Get()
  async findByType(@Query('type') type?: ServiceType) {
    const data = await this.movingServiceService.findByType(type as ServiceType);

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
  @UseInterceptors(FileInterceptor('logo'))
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateServiceDto: UpdateServiceDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|webp|svg)$/,
          }),
        ],
        fileIsRequired: false, // Logo is optional for update
      }),
    )
    file?: Express.Multer.File,
    // TODO: Get these from JWT token/auth guard
  ) {
    // For now, using placeholder values - replace with actual auth
    const userId = 'system'; // Replace with actual user ID from auth
    const userEmail = 'system@example.com'; // Replace with actual user email
    const userRole = 'ADMIN'; // Replace with actual user role

    return this.movingServiceService.update(
      id,
      updateServiceDto,
      file,
      userId,
      userEmail,
      userRole,
    );
  }

  // DELETE /movingservice/:id - Delete a service
  @Delete(':id')
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