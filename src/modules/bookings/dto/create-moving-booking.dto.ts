// booking/dto/create-moving-booking.dto.ts
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString
} from 'class-validator';

export enum ServiceType {
    MOVING = 'MOVING',
    STORAGE = 'STORAGE',
}

export class CreateMovingBookingDto {
    @IsEnum(ServiceType)
    @IsNotEmpty()
    service: ServiceType.MOVING;

    @IsString()
    @IsNotEmpty()
    serviceType: string;

    @IsDateString()
    @IsNotEmpty()
    preferredDate: string;

    @IsString()
    @IsNotEmpty()
    pickupLocation: string;

    @IsString()
    @IsNotEmpty()
    dropOffLocation: string; 

    @IsBoolean()
    @IsNotEmpty()
    isCompany: boolean; // true = Company, false = Individual

    @IsString()
    @IsOptional()
    comments?: string;
}