// service-locations.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ServiceLocationsService } from './service-locations.service';
import { CreateServiceLocationDto } from './dto/create-service-location.dto';
import { UpdateServiceLocationDto } from './dto/update-service-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Service Locations')
@Controller('service-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceLocationsController {
  constructor(
    private readonly serviceLocationsService: ServiceLocationsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new service location' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
      required: ['title', 'image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createDto: CreateServiceLocationDto,
    @UploadedFile() file: Express.Multer.File,
    // Add your auth decorators here to get userId, userEmail, userRole
    // @CurrentUser() user: { id: number; email: string; role: string }
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    // Replace with actual user data from auth decorator
    const userId = 1; // user.id
    const userEmail = 'user@example.com'; // user.email
    const userRole = 'USER'; // user.role

    return this.serviceLocationsService.create(
      createDto,
      file,
      userId,
      userEmail,
      userRole,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all service locations' })
  async findAll() {
    return this.serviceLocationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service location by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceLocationsService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a service location' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateServiceLocationDto,
    @UploadedFile() file?: Express.Multer.File,
    // @CurrentUser() user: { id: number; email: string; role: string }
  ) {
    // Replace with actual user data from auth decorator
    const userId = 1;
    const userEmail = 'user@example.com';
    const userRole = 'USER';

    return this.serviceLocationsService.update(
      id,
      updateDto,
      file,
      userId,
      userEmail,
      userRole,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a service location' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    // @CurrentUser() user: { id: number; email: string; role: string }
  ) {
    // Replace with actual user data from auth decorator
    const userId = 1;
    const userEmail = 'user@example.com';
    const userRole = 'USER';

    return this.serviceLocationsService.remove(id, userId, userEmail, userRole);
  }
}
