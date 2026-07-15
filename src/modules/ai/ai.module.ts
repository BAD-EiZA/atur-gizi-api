import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiClient } from './gemini.client';
import { MediaModule } from '../media/media.module';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [MediaModule, NutritionModule],
  controllers: [AiController],
  providers: [AiService, GeminiClient],
})
export class AiModule {}
