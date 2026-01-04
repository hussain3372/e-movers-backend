import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseBoolPipe,
  Put,
} from '@nestjs/common';
import { StorageSizeService } from './storage-size.service';
import { CreateStorageOptionDto } from './dto/create-storage-option.dto';
import { UpdateStorageOptionDto } from './dto/update-storage-option.dto';
import { CreateStorageFeatureDto } from './dto/create-storage-feature.dto';
import { UpdateStorageFeatureDto } from './dto/update-storage-feature.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';
// import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
// import { RolesGuard } from '@/auth/guards/roles.guard';
// import { Roles } from '@/auth/decorators/roles.decorator';
// import { UserRole } from '@prisma/client';

@Controller('storage-size')
export class StorageSizeController {
  constructor(private readonly storageSizeService: StorageSizeService) {}

  // ==================== USER ENDPOINTS ====================

  // Get all active storage options with features
  @Get('options')
  @HttpCode(HttpStatus.OK)
  async getAllOptions() {
    const data = await this.storageSizeService.findAllOptions(false);
    return {
      data,
      status: 'success',
      message: 'Storage options retrieved successfully',
    };
  }

  // Get single storage option with features
  @Get('options/:id')
  @HttpCode(HttpStatus.OK)
  async getOption(@Param('id') id: string) {
    const data = await this.storageSizeService.findOneOption(id);
    return {
      data,
      status: 'success',
      message: 'Storage option retrieved successfully',
    };
  }

  // Get features for a specific storage option
  @Get('options/:optionId/features')
  @HttpCode(HttpStatus.OK)
  async getFeaturesByOption(@Param('optionId') optionId: string) {
    const data = await this.storageSizeService.findFeaturesByOptionId(
      optionId,
      false,
    );
    return {
      data,
      status: 'success',
      message: 'Features retrieved successfully',
    };
  }

  // ==================== ADMIN ENDPOINTS - STORAGE OPTIONS ====================

  // Create single storage option
  @Post('admin/options')
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async createOption(@Body() createOptionDto: CreateStorageOptionDto) {
    const data = await this.storageSizeService.createOption(createOptionDto);
    return {
      data,
      status: 'success',
      message: 'Storage option created successfully',
    };
  }

  // Create multiple storage options at once
  @Post('admin/options/bulk')
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async createBulkOptions(@Body() bulkCreateDto: BulkCreateOptionsDto) {
    return this.storageSizeService.createBulkOptions(bulkCreateDto);
  }

  // Get all storage options (including inactive)
  @Get('admin/options')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async getAllOptionsAdmin(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    const data = await this.storageSizeService.findAllOptions(
      includeInactive ?? true,
    );
    return {
      data,
      status: 'success',
      message: 'Storage options retrieved successfully',
    };
  }

  // Get single storage option by ID (admin view)
  @Get('admin/options/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async getOptionAdmin(@Param('id') id: string) {
    const data = await this.storageSizeService.findOneOption(id);
    return {
      data,
      status: 'success',
      message: 'Storage option retrieved successfully',
    };
  }

  // Update storage option
  @Put('admin/options/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async updateOption(
    @Param('id') id: string,
    @Body() updateOptionDto: UpdateStorageOptionDto,
  ) {
    const data = await this.storageSizeService.updateOption(
      id,
      updateOptionDto,
    );
    return {
      data,
      status: 'success',
      message: 'Storage option updated successfully',
    };
  }

  // Delete storage option
  @Delete('admin/options/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async removeOption(@Param('id') id: string) {
    return this.storageSizeService.removeOption(id);
  }

  // ==================== ADMIN ENDPOINTS - STORAGE FEATURES ====================

  // Create storage feature
  @Post('admin/features')
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async createFeature(@Body() createFeatureDto: CreateStorageFeatureDto) {
    const data = await this.storageSizeService.createFeature(createFeatureDto);
    return {
      data,
      status: 'success',
      message: 'Storage feature created successfully',
    };
  }

  // Get all features (across all options)
  @Get('admin/features')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async getAllFeatures() {
    const data = await this.storageSizeService.findAllFeatures();
    return {
      data,
      status: 'success',
      message: 'All features retrieved successfully',
    };
  }

  // Get features by option ID (admin view - includes inactive)
  @Get('admin/options/:optionId/features')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async getFeaturesByOptionAdmin(
    @Param('optionId') optionId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    const data = await this.storageSizeService.findFeaturesByOptionId(
      optionId,
      includeInactive ?? true,
    );
    return {
      data,
      status: 'success',
      message: 'Features retrieved successfully',
    };
  }

  // Get single feature by ID
  @Get('admin/features/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async getFeature(@Param('id') id: string) {
    const data = await this.storageSizeService.findOneFeature(id);
    return {
      data,
      status: 'success',
      message: 'Feature retrieved successfully',
    };
  }

  // Update storage feature
  @Patch('admin/features/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async updateFeature(
    @Param('id') id: string,
    @Body() updateFeatureDto: UpdateStorageFeatureDto,
  ) {
    const data = await this.storageSizeService.updateFeature(
      id,
      updateFeatureDto,
    );
    return {
      data,
      status: 'success',
      message: 'Feature updated successfully',
    };
  }

  // Delete storage feature
  @Delete('admin/features/:id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  async removeFeature(@Param('id') id: string) {
    return this.storageSizeService.removeFeature(id);
  }
}
