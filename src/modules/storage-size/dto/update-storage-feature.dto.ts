import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStorageFeatureDto } from './create-storage-feature.dto';

export class UpdateStorageFeatureDto extends PartialType(
    OmitType(CreateStorageFeatureDto, ['optionId'] as const)
) {}