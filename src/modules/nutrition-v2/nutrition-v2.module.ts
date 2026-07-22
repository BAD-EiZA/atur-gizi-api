import { Module } from '@nestjs/common';
import { NutritionV2Controller } from './nutrition-v2.controller';
import { NutritionV2Service } from './nutrition-v2.service';
import { NutritionV2GoalsService } from './nutrition-v2-goals.service';

@Module({
  controllers: [NutritionV2Controller],
  providers: [NutritionV2Service, NutritionV2GoalsService],
  exports: [NutritionV2Service, NutritionV2GoalsService],
})
export class NutritionV2Module {}
