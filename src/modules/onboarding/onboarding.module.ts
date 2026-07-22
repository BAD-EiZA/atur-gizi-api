import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from '../users/users.module';
import { NutritionV2Module } from '../nutrition-v2/nutrition-v2.module';

@Module({
  imports: [UsersModule, NutritionV2Module],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
