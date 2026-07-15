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

export class FoodItemDto {
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

export class CreateFoodLogDto {
  @IsDateString()
  consumedAt!: string;

  @IsOptional()
  @IsDateString()
  logDate?: string;

  @IsEnum(MealType)
  mealType!: MealType;

  @IsString()
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodItemDto)
  items!: FoodItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFoodLogDto {
  @IsOptional()
  @IsDateString()
  consumedAt?: string;

  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FoodItemDto)
  items?: FoodItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
