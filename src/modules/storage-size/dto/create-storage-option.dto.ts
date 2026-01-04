import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateStorageOptionDto {
    @IsString()
    size: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    displayOrder?: number;
}