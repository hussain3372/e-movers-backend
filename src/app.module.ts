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
    S3Module,
    ProfileModule,
    MovingServiceModule,
    BookingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
