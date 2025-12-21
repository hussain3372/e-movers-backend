import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { MovingServiceController } from './movingservice.controller';
import { MovingServiceService } from './movingservice.service';

@Module({
  imports: [PrismaModule, StorageModule, AuditModule],
  controllers: [MovingServiceController],
  providers: [MovingServiceService],
  exports: [MovingServiceService],
})
export class MovingServiceModule {}