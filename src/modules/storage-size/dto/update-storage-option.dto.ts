import { PartialType } from '@nestjs/mapped-types';
import { CreateStorageOptionDto } from './create-storage-option.dto';

export class UpdateStorageOptionDto extends PartialType(CreateStorageOptionDto) {}