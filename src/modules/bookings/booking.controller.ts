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
} from '@nestjs/common';
import { BookingService } from './booking.service';
import type { CreateBookingDto, ServiceType } from './dto/create-booking.dto';

@Controller('booking')
export class BookingController {
    constructor(private readonly bookingService: BookingService) { }

    /**
     * POST /booking - Create a new booking (Moving or Storage)
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createBookingDto: CreateBookingDto) {
        return this.bookingService.create(createBookingDto);
    }

    /**
     * GET /booking - Get all bookings or filter by service type
     * Examples:
     * - GET /booking (returns all bookings)
     * - GET /booking?service=MOVING (returns only moving bookings)
     * - GET /booking?service=STORAGE (returns only storage bookings)
     */
    @Get()
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


    /**
     * GET /booking/:id - Get a single booking by ID
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.bookingService.findOne(id);
    }

    /**
     * DELETE /booking/:id - Delete a booking and send cancellation email
     */
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async remove(@Param('id') id: string) {
        return this.bookingService.remove(id);
    }
}