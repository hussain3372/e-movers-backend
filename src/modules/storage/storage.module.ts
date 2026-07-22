import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { LoggerModule } from '../../common/logger/logger.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, LoggerModule, AuditModule],
  providers: [StorageService, CloudinaryStorageProvider],
  exports: [StorageService, CloudinaryStorageProvider],
})
export class StorageModule {}
