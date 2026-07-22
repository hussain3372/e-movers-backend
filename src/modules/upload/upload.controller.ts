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
import { StorageService } from '../storage/storage.service';

const memoryStorage = multer.memoryStorage();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload public image
   * POST /upload/public-image
   */
  @Post('public-image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_SIZE },
      storage: memoryStorage,
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPublicImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const result = await this.storageService.uploadFile(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      'public/images',
      undefined,
      undefined,
      undefined,
      {
        maxSize: MAX_IMAGE_SIZE,
        allowedTypes: [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      },
    );

    return {
      status: 'success',
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        key: result.key,
        name: file.originalname,
      },
    };
  }
}
