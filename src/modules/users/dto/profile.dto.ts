import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ActivityLevel, FitnessGoal, MetabolicFormula, UnitSystem } from '@prisma/client';

export class PatchProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(400)
  currentWeightKg?: number;

  @IsOptional()
  @IsEnum(MetabolicFormula)
  metabolicFormula?: MetabolicFormula;

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsEnum(FitnessGoal)
  fitnessGoal?: FitnessGoal;

  @IsOptional()
  @IsNumber()
  targetRate?: number;
}

export class PatchSettingsDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(UnitSystem)
  unitSystem?: UnitSystem;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsBoolean()
  retainFoodPhotos?: boolean;

  @IsOptional()
  @IsBoolean()
  analyticsConsent?: boolean;
}
