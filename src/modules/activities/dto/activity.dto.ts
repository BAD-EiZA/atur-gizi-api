import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivitySource, Intensity } from '@prisma/client';

export class EstimateActivityDto {
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  metValue?: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsNumber()
  @Min(20)
  weightKg?: number;

  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceM?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(220)
  avgHr?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;
}

export class CreateActivityLogDto {
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  @IsOptional()
  @IsString()
  customName?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  logDate?: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  metValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceM?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(220)
  avgHr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sets?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loadKg?: number;

  @IsOptional()
  @IsEnum(ActivitySource)
  source?: ActivitySource;

  @IsOptional()
  @IsInt()
  @Min(0)
  deviceCalories?: number;
}

export class AnalyzeActivityScreenshotDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cloudinaryPublicId?: string;

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
  mediaBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(Math.ceil(50 * 1024 * 1024 * (4 / 3)))
  imageBase64?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  mimeType?: string;
}

export class UpdateActivityLogDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @IsOptional()
  @IsInt()
  @Min(0)
  caloriesBurned?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceM?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(220)
  avgHr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sets?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loadKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  metValue?: number;
}
