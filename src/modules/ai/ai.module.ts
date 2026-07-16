import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiClient } from './gemini.client';
import { AiAssistController } from './ai-assist.controller';
import { AiAssistService } from './ai-assist.service';
import { MediaModule } from '../media/media.module';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [MediaModule, NutritionModule],
  controllers: [AiController, AiAssistController],
  providers: [AiService, GeminiClient, AiAssistService],
})
export class AiModule {}
