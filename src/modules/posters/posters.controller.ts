// posters.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { PostersService } from './posters.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';

@ApiTags('Posters')
@Controller('posters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostersController {
  constructor(private readonly postersService: PostersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Upload a new poster' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
      required: ['image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async create(
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

    return this.postersService.create(file, userId, userEmail, userRole);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posters' })
  async findAll() {
    return this.postersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a poster by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postersService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a poster image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
      required: ['image'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    // @CurrentUser() user: { id: number; email: string; role: string }
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    // Replace with actual user data from auth decorator
    const userId = 1;
    const userEmail = 'user@example.com';
    const userRole = 'USER';

    return this.postersService.update(id, file, userId, userEmail, userRole);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a poster' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    // @CurrentUser() user: { id: number; email: string; role: string }
  ) {
    // Replace with actual user data from auth decorator
    const userId = 1;
    const userEmail = 'user@example.com';
    const userRole = 'USER';

    return this.postersService.remove(id, userId, userEmail, userRole);
  }
}
