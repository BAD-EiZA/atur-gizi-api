import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ScreeningAnswer } from '@prisma/client';

export class GoalPlanDto {
  @IsIn(['lose', 'maintain', 'gain'])
  type!: 'lose' | 'maintain' | 'gain';

  @ValidateIf((o: GoalPlanDto) => o.type !== 'maintain')
  @IsIn(['weekly_rate', 'target_date'])
  method?: 'weekly_rate' | 'target_date';

  @ValidateIf((o: GoalPlanDto) => o.type !== 'maintain')
  @IsNumber()
  @Min(20)
  @Max(350)
  targetWeightKg?: number;

  @ValidateIf(
    (o: GoalPlanDto) => o.type !== 'maintain' && o.method === 'weekly_rate',
  )
  @IsNumber()
  @Min(0.01)
  @Max(5)
  weeklyChangeKg?: number;

  @ValidateIf(
    (o: GoalPlanDto) => o.type !== 'maintain' && o.method === 'target_date',
  )
  @IsDateString()
  targetDate?: string;
}

export class PreviewGoalDto {
  @ValidateNested()
  @Type(() => GoalPlanDto)
  goal!: GoalPlanDto;
}

export class CreateGoalFromPreviewDto {
  @IsUUID()
  previewId!: string;
}

export class RecalculateGoalDto {
  @IsUUID()
  previewId!: string;
}

export class ListGoalsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ActivateGoalDto {
  @IsArray()
  @IsString({ each: true })
  acceptedWarningCodes!: string[];

  @IsString()
  confirmationTextVersion!: string;

  @IsOptional()
  @IsBoolean()
  aggressiveRiskAccepted?: boolean;
}

export class UpsertScreeningDto {
  @IsOptional()
  @IsNumber()
  expectedVersion?: number | null;

  @IsString()
  consentVersion!: string;

  @IsEnum(ScreeningAnswer)
  isPregnant!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  isBreastfeeding!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  hasKidneyDisease!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  hasLiverDisease!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  hasHeartFailureOrFluidRetention!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  usesHypoglycemiaRiskMedication!: ScreeningAnswer;

  @IsEnum(ScreeningAnswer)
  hasEatingDisorderHistory!: ScreeningAnswer;
}

export class ManualGoalDto {
  @IsNumber()
  @Min(20)
  @Max(350)
  targetWeightKg!: number;

  @IsOptional()
  @IsIn(['personal_goal', 'clinician_goal', 'guardian_supported'])
  noteCode?: 'personal_goal' | 'clinician_goal' | 'guardian_supported';
}
