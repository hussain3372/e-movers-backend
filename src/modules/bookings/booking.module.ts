// booking/booking.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingController } from './booking.controller';
import { MailModule } from '@/common/mail/mail.module';
import { BookingService } from './booking.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}