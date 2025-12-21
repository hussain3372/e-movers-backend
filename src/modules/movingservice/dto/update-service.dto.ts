import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ServiceType } from './create-service.dto';

export class UpdateServiceDto {
    @IsOptional()
    @IsString()
    title?: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsNotEmpty()
    @IsEnum(ServiceType)
    type: ServiceType;
  }