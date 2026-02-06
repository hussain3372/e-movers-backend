// booking/booking.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import type { CreateBookingDto, ServiceType } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
// Import your auth guards - adjust the path as needed
// import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
// import { RolesGuard } from '@/auth/guards/roles.guard';
// import { Roles } from '@/auth/decorators/roles.decorator';
// import { UserRole } from '@prisma/client';

@Controller('booking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    // Extract userId from authenticated user
    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    return this.bookingService.create(createBookingDto, userId);
  }

  @Get('admin')
  async findAll(@Query('service') service?: string) {
    if (service) {
      if (!['MOVING', 'STORAGE'].includes(service.toUpperCase())) {
        throw new BadRequestException(
          'Invalid service type. Must be MOVING or STORAGE',
        );
      }

      const data = await this.bookingService.findAll(
        service.toUpperCase() as ServiceType,
      );

      return {
        data,
        status: 'success',
        message: 'Booking list retrieved successfully',
      };
    }

    const data = await this.bookingService.findAll();

    return {
      data,
      status: 'success',
      message: 'Booking list retrieved successfully',
    };
  }

  @Get()
  async getBookings(@Req() req: any, @Query('service') service?: string) {
    const { id: userId, role } = req.user;

    let serviceType: ServiceType | undefined;
    if (service) {
      if (!['MOVING', 'STORAGE'].includes(service.toUpperCase())) {
        throw new BadRequestException(
          'Invalid service type. Must be MOVING or STORAGE',
        );
      }
      serviceType = service.toUpperCase() as ServiceType;
    }

    const data =
      role === 'ADMIN'
        ? await this.bookingService.findAll(serviceType)
        : await this.bookingService.findByUserId(userId, serviceType);

    return {
      data,
      status: 'success',
      message: 'Bookings retrieved successfully',
    };
  }

  // Get single booking by ID
  @Get(':id')
  // @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN'; // Adjust based on your role enum

    return this.bookingService.findOne(id, userId, isAdmin);
  }

  // Delete booking
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    return this.bookingService.remove(id, userId, isAdmin);
  }
}
