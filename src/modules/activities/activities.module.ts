import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { MediaModule } from '../media/media.module';
import { GeminiClient } from '../ai/gemini.client';

@Module({
  imports: [MediaModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, GeminiClient],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
