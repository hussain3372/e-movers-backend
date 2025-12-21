// src/modules/s3module/s3.module.ts
import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';
import { S3Controller } from '@/modules/s3module/s3.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule], // Import PrismaModule
  controllers: [S3Controller],
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: (config: ConfigService) => {
        const region = config.get<string>('AWS_REGION');
        const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

        if (!region || !accessKeyId || !secretAccessKey) {
          throw new Error('AWS S3 configuration is missing. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY');
        }

        console.log('🔧 AWS S3 Configuration:', {
          region,
          bucket: config.get('S3_BUCKET_NAME'),
          accessKeyId: accessKeyId.slice(0, 4) + '...',
          secretKey: '✅ Loaded',
        });

        return new S3Client({
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
      },
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: ['S3_CLIENT', StorageService],
})
export class S3Module {}