import {
  Controller,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Body,
  Put,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from './dto/user.dto';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: CurrentUserType) {
    const profile = await this.profileService.getProfile(user.id);
    return {
      status: 'success',
      message: 'Profile fetched successfully',
      data: profile,
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateProfileDto
  ) {
    const updatedProfile = await this.profileService.updateProfile(
      user.id,
      dto
    );
    return {
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedProfile,
    };
  }

  @Post('picture')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfilePicture(
    @CurrentUser() user: CurrentUserType,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const updatedProfile = await this.profileService.uploadProfilePicture(
      user.id,
      file,
      user.email,
      user.role
    );

    return {
      status: 'success',
      message: 'Profile picture uploaded successfully',
      data: updatedProfile,
    };
  }

  @Delete('picture')
  @HttpCode(HttpStatus.OK)
  async deleteProfilePicture(@CurrentUser() user: CurrentUserType) {
    const updatedProfile = await this.profileService.deleteProfilePicture(
      user.id
    );
    return {
      status: 'success',
      message: 'Profile picture deleted successfully',
      data: updatedProfile,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteProfile(@CurrentUser() user: CurrentUserType) {
    await this.profileService.deleteProfile(user.id);
    return {
      status: 'success',
      message: 'Profile deleted successfully',
    };
  }
}