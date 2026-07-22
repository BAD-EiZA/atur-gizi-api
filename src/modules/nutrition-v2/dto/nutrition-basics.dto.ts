import { ActivityLevel, BiologicalSex } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PreviewNutritionBasicsDto {
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(350)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(250)
  heightCm?: number;

  @IsOptional()
  @IsEnum(BiologicalSex)
  sex?: BiologicalSex;

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;
}
