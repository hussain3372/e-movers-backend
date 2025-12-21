// booking/booking.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '@/common/mail/mail.service';
import type { CreateBookingDto } from './dto/create-booking.dto';
import { ServiceType } from './dto/create-booking.dto';
import { CreateMovingBookingDto } from './dto/create-moving-booking.dto';
import { CreateStorageBookingDto } from './dto/create-storage-booking.dto';

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    /**
     * Create a new booking (Moving or Storage)
     */
    async create(createBookingDto: CreateBookingDto) {
        const bookingType =
            createBookingDto.service === ServiceType.MOVING ? 'MOVING' : 'STORAGE';

        let bookingData: any;

        if (createBookingDto.service === ServiceType.MOVING) {
            const movingDto = createBookingDto as CreateMovingBookingDto;

            bookingData = {
                type: bookingType,
                logo: null,

                serviceType: movingDto.serviceType,
                preferredDate: new Date(movingDto.preferredDate),
                pickupLocation: movingDto.pickupLocation,
                dropOffLocation: movingDto.dropOffLocation,
                isCompany: movingDto.isCompany,
                comments: movingDto.comments ?? null,

                // storage fields
                storageType: null,
                rentalPlan: null,
                storageSize: null,
                location: null,
                isBusiness: null,
                isHometown: null,
                isStudent: null,
            };
        } else {
            const storageDto = createBookingDto as CreateStorageBookingDto;

            bookingData = {
                type: bookingType,
                logo: null,

                storageType: storageDto.storageType,
                rentalPlan: storageDto.rentalPlan,
                storageSize: storageDto.storageSize,
                location: storageDto.location,
                isBusiness: storageDto.isBusiness ?? false,
                isHometown: storageDto.isHometown ?? false,
                isStudent: storageDto.isStudent ?? false,
                comments: storageDto.comments ?? null,

                // moving fields
                serviceType: null,
                preferredDate: null,
                pickupLocation: null,
                dropOffLocation: null,
                isCompany: null,
            };
        }

        const booking = await (this.prisma as any).booking.create({
            data: bookingData,
        });

        this.logger.log(`Booking created`, {
            bookingId: booking.id,
            type: booking.type,
        });


        // ✅ Return only relevant fields
        return this.formatBookingResponse(booking);
    }

    private formatBookingResponse(booking: any) {
        if (booking.type === 'MOVING') {
            return {
                id: booking.id,
                type: booking.type,
                serviceType: booking.serviceType,
                preferredDate: booking.preferredDate,
                pickupLocation: booking.pickupLocation,
                dropOffLocation: booking.dropOffLocation,
                isCompany: booking.isCompany,
                comments: booking.comments,
                createdAt: booking.createdAt,
            };
        }

        // STORAGE
        return {
            id: booking.id,
            type: booking.type,
            storageType: booking.storageType,
            rentalPlan: booking.rentalPlan,
            storageSize: booking.storageSize,
            location: booking.location,
            isBusiness: booking.isBusiness,
            isHometown: booking.isHometown,
            isStudent: booking.isStudent,
            comments: booking.comments,
            createdAt: booking.createdAt,
        };
    }



    /**
     * Get all bookings or filter by service type
     */
    async findAll(service?: ServiceType) {
        if (service) {
            const bookings = await (this.prisma as any).booking.findMany({
                where: { type: service },
                orderBy: { createdAt: 'desc' },
            });
            return bookings;
        }

        // Return all bookings if no filter provided
        const bookings = await (this.prisma as any).booking.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return bookings;
    }

    /**
     * Get a single booking by ID
     */
    async findOne(id: string) {
        const booking = await (this.prisma as any).booking.findUnique({
            where: { id },
        });

        if (!booking) {
            throw new NotFoundException(`Booking with ID ${id} not found`);
        }

        return booking;
    }

    /**
     * Delete a booking and send cancellation email
     */
    async remove(id: string) {
        // Check if booking exists
        const booking = await this.findOne(id);

        // Prepare booking details for email
        let bookingDetails: string;
        let serviceType: string;

        if (booking.type === 'MOVING') {
            bookingDetails = `
                <p><strong>Service Type:</strong> ${booking.serviceType || 'N/A'}</p>
                <p><strong>Preferred Date:</strong> ${booking.preferredDate ? new Date(booking.preferredDate).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Pickup Location:</strong> ${booking.pickupLocation || 'N/A'}</p>
                <p><strong>Drop-off Location:</strong> ${booking.dropOffLocation || 'N/A'}</p>
                <p><strong>Client Type:</strong> ${booking.isCompany ? 'Company' : 'Individual'}</p>
                ${booking.comments ? `<p><strong>Comments:</strong> ${booking.comments}</p>` : ''}
            `;
            serviceType = 'MOVING';
        } else {
            const userType = this.getStorageUserTypeFromBooking(booking);
            bookingDetails = `
                <p><strong>Storage Type:</strong> ${booking.storageType || 'N/A'}</p>
                <p><strong>Rental Plan:</strong> ${booking.rentalPlan || 'N/A'}</p>
                <p><strong>Storage Size:</strong> ${booking.storageSize || 'N/A'}</p>
                <p><strong>Location:</strong> ${booking.location || 'N/A'}</p>
                <p><strong>User Type:</strong> ${userType}</p>
                ${booking.comments ? `<p><strong>Comments:</strong> ${booking.comments}</p>` : ''}
            `;
            serviceType = 'STORAGE';
        }

        // Delete the booking
        await (this.prisma as any).booking.delete({
            where: { id },
        });

        this.logger.log(`Booking deleted with ID: ${id}`, {
            bookingId: id,
            type: booking.type,
        });

        // Note: Email sending should include user email from authenticated context
        // For now, we return success message
        // TODO: Send cancellation email when user email is available
        // await this.mailService.sendBookingCancellationEmail({
        //     email: userEmail,
        //     id: booking.id,
        //     service: serviceType,
        //     details: bookingDetails,
        // });

        return {
            message: 'Booking deleted successfully',
            id,
        };
    }

    /**
     * Helper method to determine storage user type from booking
     */
    private getStorageUserTypeFromBooking(booking: any): string {
        if (booking.isBusiness) return 'Business';
        if (booking.isHometown) return 'Hometown';
        if (booking.isStudent) return 'Student';
        return 'Standard';
    }

    /**
     * Helper method to determine storage user type from DTO
     */
    private getStorageUserType(dto: CreateStorageBookingDto): string {
        if (dto.isBusiness) return 'Business';
        if (dto.isHometown) return 'Hometown';
        if (dto.isStudent) return 'Student';
        return 'Standard';
    }
}
