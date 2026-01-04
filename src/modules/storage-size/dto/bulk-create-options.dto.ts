import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStorageOptionDto } from './create-storage-option.dto';

export class BulkCreateOptionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateStorageOptionDto)
    options: CreateStorageOptionDto[];
}