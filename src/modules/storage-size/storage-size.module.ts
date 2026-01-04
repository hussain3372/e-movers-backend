import { Module } from '@nestjs/common';
import { StorageSizeService } from './storage-size.service';
import { StorageSizeController } from './storage-size.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StorageSizeController],
    providers: [StorageSizeService],
    exports: [StorageSizeService],
})
export class StorageSizeModule {}