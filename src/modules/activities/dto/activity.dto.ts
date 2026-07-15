import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Intensity } from '@prisma/client';

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
}
