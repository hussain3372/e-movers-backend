import {
    Injectable,
    NotFoundException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStorageOptionDto } from './dto/create-storage-option.dto';
import { UpdateStorageOptionDto } from './dto/update-storage-option.dto';
import { CreateStorageFeatureDto } from './dto/create-storage-feature.dto';
import { UpdateStorageFeatureDto } from './dto/update-storage-feature.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';

@Injectable()
export class StorageSizeService {
    private readonly logger = new Logger(StorageSizeService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ==================== STORAGE OPTIONS ====================

    // Admin: Create single storage option
    async createOption(createOptionDto: CreateStorageOptionDto) {
        const option = await this.prisma.storageSizeOption.create({
            data: {
                size: createOptionDto.size,
                title: createOptionDto.title,
                description: createOptionDto.description,
                price: createOptionDto.price,
                isActive: createOptionDto.isActive ?? true,
                displayOrder: createOptionDto.displayOrder ?? 0,
            },
            include: {
                features: true,
            },
        });

        this.logger.log(`Storage option created: ${option.id}`);
        return option;
    }

    // Admin: Create multiple storage options at once
    async createBulkOptions(bulkCreateDto: BulkCreateOptionsDto) {
        const createdOptions = await this.prisma.$transaction(
            bulkCreateDto.options.map((optionDto) =>
                this.prisma.storageSizeOption.create({
                    data: {
                        size: optionDto.size,
                        title: optionDto.title,
                        description: optionDto.description,
                        price: optionDto.price,
                        isActive: optionDto.isActive ?? true,
                        displayOrder: optionDto.displayOrder ?? 0,
                    },
                })
            )
        );

        this.logger.log(`${createdOptions.length} storage options created`);
        return {
            message: `${createdOptions.length} storage options created successfully`,
            data: createdOptions,
        };
    }

    // User: Get all active storage options
    async findAllOptions(includeInactive: boolean = false) {
        const whereClause = includeInactive ? {} : { isActive: true };

        const options = await this.prisma.storageSizeOption.findMany({
            where: whereClause,
            orderBy: { displayOrder: 'asc' },
            include: {
                features: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });

        return options;
    }

    // User: Get single storage option by ID
    async findOneOption(id: string) {
        const option = await this.prisma.storageSizeOption.findUnique({
            where: { id },
            include: {
                features: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                },
            },
        });

        if (!option) {
            throw new NotFoundException(`Storage option with ID ${id} not found`);
        }

        return option;
    }

    // Admin: Update storage option
    async updateOption(id: string, updateOptionDto: UpdateStorageOptionDto) {
        await this.findOneOption(id);

        const updatedOption = await this.prisma.storageSizeOption.update({
            where: { id },
            data: updateOptionDto,
            include: {
                features: true,
            },
        });

        this.logger.log(`Storage option updated: ${id}`);
        return updatedOption;
    }

    // Admin: Delete storage option
    async removeOption(id: string) {
        await this.findOneOption(id);

        await this.prisma.storageSizeOption.delete({
            where: { id },
        });

        this.logger.log(`Storage option deleted: ${id}`);
        return {
            message: 'Storage option deleted successfully',
            id,
        };
    }

    // ==================== STORAGE FEATURES ====================

    // Admin: Create storage feature
    async createFeature(createFeatureDto: CreateStorageFeatureDto) {
        // Verify that the storage option exists
        await this.findOneOption(createFeatureDto.optionId);

        const feature = await this.prisma.storageSizeFeature.create({
            data: {
                optionId: createFeatureDto.optionId,
                feature: createFeatureDto.feature,
                isActive: createFeatureDto.isActive ?? true,
                displayOrder: createFeatureDto.displayOrder ?? 0,
            },
        });

        this.logger.log(`Storage feature created: ${feature.id}`);
        return feature;
    }

    // User: Get all features for a specific storage option
    async findFeaturesByOptionId(optionId: string, includeInactive: boolean = false) {
        // Verify that the storage option exists
        await this.findOneOption(optionId);

        const whereClause: any = { optionId };
        if (!includeInactive) {
            whereClause.isActive = true;
        }

        const features = await this.prisma.storageSizeFeature.findMany({
            where: whereClause,
            orderBy: { displayOrder: 'asc' },
        });

        return features;
    }

    // Admin: Get single feature by ID
    async findOneFeature(id: string) {
        const feature = await this.prisma.storageSizeFeature.findUnique({
            where: { id },
            include: {
                option: true,
            },
        });

        if (!feature) {
            throw new NotFoundException(`Storage feature with ID ${id} not found`);
        }

        return feature;
    }

    // Admin: Update storage feature
    async updateFeature(id: string, updateFeatureDto: UpdateStorageFeatureDto) {
        await this.findOneFeature(id);

        const updatedFeature = await this.prisma.storageSizeFeature.update({
            where: { id },
            data: updateFeatureDto,
        });

        this.logger.log(`Storage feature updated: ${id}`);
        return updatedFeature;
    }

    // Admin: Delete storage feature
    async removeFeature(id: string) {
        await this.findOneFeature(id);

        await this.prisma.storageSizeFeature.delete({
            where: { id },
        });

        this.logger.log(`Storage feature deleted: ${id}`);
        return {
            message: 'Storage feature deleted successfully',
            id,
        };
    }

    // Admin: Get all features (across all options)
    async findAllFeatures() {
        const features = await this.prisma.storageSizeFeature.findMany({
            orderBy: [{ optionId: 'asc' }, { displayOrder: 'asc' }],
            include: {
                option: {
                    select: {
                        id: true,
                        size: true,
                        title: true,
                    },
                },
            },
        });

        return features;
    }
}