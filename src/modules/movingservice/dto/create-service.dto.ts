import { IsArray, IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export enum ServiceType {
  MOVING = 'MOVING',
  STORAGE = 'STORAGE',
}

export class CreateServiceDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  heading: string;

  @IsNotEmpty()
  @IsString()
  shortdescription: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsEnum(ServiceType)
  type: ServiceType;

  @IsNotEmpty()
  @IsArray()
  features: string[];
}
