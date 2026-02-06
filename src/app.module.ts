import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './common/mail/mail.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorageModule } from './modules/storage/storage.module';
import { S3Module } from './modules/s3module/s3.module';
import { ProfileModule } from './modules/profile/profile.module';
import { MovingServiceModule } from './modules/movingservice/movingservice.module';
import { BookingModule } from './modules/bookings/booking.module';
import { ServiceLocationsModule } from './modules/servicelocations/service-locations.module';
import { PostersModule } from './modules/posters/posters.module';
import { UserManagementModule } from './modules/usermanagement/user-management.module';
import { StorageSizeModule } from './modules/storage-size/storage-size.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    PrismaModule,
    RedisModule,
    MailModule,
    AuditModule,
    StorageModule,
    DashboardModule,
    S3Module,
    ProfileModule,
    MovingServiceModule,
    BookingModule,
    ServiceLocationsModule,
    PostersModule,
    UserManagementModule,
    StorageSizeModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
