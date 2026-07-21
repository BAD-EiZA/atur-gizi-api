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
import {
  ActivityLevel,
  BiologicalSex,
  CalorieBudgetMode,
  FitnessGoal,
  MetabolicFormula,
  UnitSystem,
} from '@prisma/client';

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
  @IsEnum(BiologicalSex)
  sex?: BiologicalSex;

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

  @IsOptional()
  @IsEnum(CalorieBudgetMode)
  calorieBudgetMode?: CalorieBudgetMode;
}

export class CreateWeightLogDto {
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg!: number;

  @IsOptional()
  @IsDateString()
  loggedAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class PatchMacroTargetsDto {
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
}
