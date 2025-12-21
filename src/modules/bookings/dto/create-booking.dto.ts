import { Type } from 'class-transformer';
import { ValidateNested, IsEnum } from 'class-validator';
import {
    CreateMovingBookingDto,
    ServiceType,
} from './create-moving-booking.dto';
import { CreateStorageBookingDto } from './create-storage-booking.dto';

export type CreateBookingDto =
    | CreateMovingBookingDto
    | CreateStorageBookingDto;

export { ServiceType };