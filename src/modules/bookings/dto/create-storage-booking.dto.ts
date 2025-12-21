import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
} from 'class-validator';
import { ServiceType } from './create-moving-booking.dto';

export class CreateStorageBookingDto {
    @IsEnum(ServiceType)
    @IsNotEmpty()
    service: ServiceType.STORAGE;

    @IsString()
    @IsNotEmpty()
    storageType: string;

    @IsString()
    @IsNotEmpty()
    rentalPlan: string;

    @IsString()
    @IsNotEmpty()
    storageSize: string;

    @IsString()
    @IsNotEmpty()
    location: string;

    @IsBoolean()
    @IsOptional()
    isBusiness?: boolean;

    @IsBoolean()
    @IsOptional()
    isHometown?: boolean;

    @IsBoolean()
    @IsOptional()
    isStudent?: boolean;

    @IsString()
    @IsOptional()
    comments?: string;

    // Custom validation to ensure only one user type is true
    @ValidateIf((o) => {
        const trueCount = [o.isBusiness, o.isHometown, o.isStudent].filter(
            (v) => v === true,
        ).length;
        return trueCount > 1;
    })
    customValidation?: never; // This will fail if more than one is true
}