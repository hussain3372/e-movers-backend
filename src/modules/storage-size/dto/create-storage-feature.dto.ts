import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateStorageFeatureDto {
  @IsString()
  optionId: string;

  @IsString()
  feature: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;
}
