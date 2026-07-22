import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './common/mail/mail.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
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
    LoggerModule,
    AuthModule,
    PrismaModule,
    RedisModule,
    MailModule,
    AuditModule,
    StorageModule,
    DashboardModule,
    UploadModule,
    ProfileModule,
    MovingServiceModule,
    BookingModule,
    ServiceLocationsModule,
    PostersModule,
    UserManagementModule,
    StorageSizeModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Logs every failed request; response bodies are unchanged.
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
