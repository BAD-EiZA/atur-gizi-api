import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MealType } from '@prisma/client';

export class StartAnalysisDto {
  @IsString()
  @MaxLength(512)
  cloudinaryPublicId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mediaDeliveryType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  mediaVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  mediaFormat?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  mediaBytes?: number;

  /** Dev-only: base64 image when Cloudinary mock */
  @IsOptional()
  @IsString()
  @MaxLength(Math.ceil(50 * 1024 * 1024 * (4 / 3)))
  imageBase64?: string;

  @IsOptional()
  @IsEnum(['image/jpeg', 'image/png', 'image/webp'])
  mimeType?: string;
}

export class ConfirmItemDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Min(0.01)
  portionAmount!: number;

  @IsString()
  portionUnit!: string;

  @IsInt()
  @Min(0)
  calories!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbsG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fatG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fiberG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aiConfidence?: number;
}

export class ConfirmAnalysisDto {
  @IsEnum(MealType)
  mealType!: MealType;

  @IsDateString()
  consumedAt!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmItemDto)
  items!: ConfirmItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
