import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

const memoryStorage = multer.memoryStorage();

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class S3Controller {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload public image
   * POST /upload/public-image
   */
  @Post('public-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      storage: memoryStorage,
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadPublicImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const normalized = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    };

    const result = await this.storageService.uploadFile(
      normalized,
      'public/images'
    );

    return {
      status: 'success',
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        key: result.key,
        name: result.name,
      },
    };
  }
}
