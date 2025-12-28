// service-locations.module.ts
import { Module } from '@nestjs/common';
import { ServiceLocationsController } from './service-locations.controller';
import { ServiceLocationsService } from './service-locations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, StorageModule, AuditModule],
  controllers: [ServiceLocationsController],
  providers: [ServiceLocationsService],
  exports: [ServiceLocationsService],
})
export class ServiceLocationsModule {}
