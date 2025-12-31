import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ServiceType } from './create-service.dto';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  shortdescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsNotEmpty()
  @IsEnum(ServiceType)
  type: ServiceType;
}
