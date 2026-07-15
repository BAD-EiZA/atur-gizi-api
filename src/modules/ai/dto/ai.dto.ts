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
  Min,
  ValidateNested,
} from 'class-validator';
import { MealType } from '@prisma/client';

export class StartAnalysisDto {
  @IsString()
  cloudinaryPublicId!: string;

  @IsOptional()
  @IsString()
  mediaDeliveryType?: string;

  @IsOptional()
  @IsString()
  mediaVersion?: string;

  @IsOptional()
  @IsString()
  mediaFormat?: string;

  @IsOptional()
  @IsInt()
  mediaBytes?: number;

  /** Dev-only: base64 image when Cloudinary mock */
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
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
