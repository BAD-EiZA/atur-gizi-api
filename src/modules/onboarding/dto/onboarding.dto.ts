import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ActivityLevel, FitnessGoal, MetabolicFormula, UnitSystem } from '@prisma/client';

export class PreviewTargetDto {
  @IsDateString()
  dateOfBirth!: string;

  @IsNumber()
  @Min(50)
  @Max(250)
  heightCm!: number;

  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg!: number;

  @IsEnum(MetabolicFormula)
  metabolicFormula!: MetabolicFormula;

  @ValidateIf((o: PreviewTargetDto) => o.metabolicFormula !== 'manual' && o.fitnessGoal !== 'manual')
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @IsEnum(FitnessGoal)
  fitnessGoal!: FitnessGoal;

  @IsOptional()
  @IsNumber()
  targetRate?: number;

  @ValidateIf((o: PreviewTargetDto) => o.fitnessGoal === 'manual' || o.metabolicFormula === 'manual')
  @IsNumber()
  @Min(800)
  @Max(10000)
  manualTarget?: number;
}

export class CompleteOnboardingDto extends PreviewTargetDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(UnitSystem)
  unitSystem?: UnitSystem;

  @IsBoolean()
  estimatesAccepted!: boolean;
}
