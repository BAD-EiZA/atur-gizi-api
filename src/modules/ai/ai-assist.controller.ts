import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AiAssistService } from './ai-assist.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';

@Controller('v1/ai')
@UseGuards(AuthGuard)
export class AiAssistController {
  constructor(
    private readonly assist: AiAssistService,
    private readonly rateLimit: RateLimitService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async guard(userId: string) {
    await this.rateLimit.hit({ userId, routeKey: 'ai-assist', limit: 30, windowMinutes: 1 });
  }

  @Get('food-search')
  async search(@CurrentUser() user: AuthenticatedUser, @Query('q') q = '') {
    await this.guard(user.appUserId);
    await this.analytics.track(user.appUserId, 'ai_food_search');
    return this.assist.smartSearch(user.appUserId, q);
  }

  @Post('alias-resolve')
  async alias(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { text: string },
  ) {
    await this.guard(user.appUserId);
    return this.assist.resolveAlias(user.appUserId, body.text);
  }

  @Get('meal-memory')
  memory(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.listMemory(user.appUserId);
  }

  @Post('meal-memory')
  saveMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      alias: string;
      resolvedName: string;
      portionAmount?: number;
      portionUnit?: string;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      notes?: string;
    },
  ) {
    return this.assist.upsertMemory(user.appUserId, body);
  }

  @Delete('meal-memory/:id')
  delMemory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assist.deleteMemory(user.appUserId, id);
  }

  @Post('meal-memory/reset')
  resetMemory(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.resetMemory(user.appUserId);
  }

  @Post('plate-completion')
  plate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { detectedItems: string[] },
  ) {
    return this.assist.plateCompletion(body.detectedItems ?? []);
  }

  @Post('compare-foods')
  compare(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { foodA: string; foodB: string },
  ) {
    return this.assist.compareFoods(body.foodA, body.foodB);
  }

  @Get('contextual-suggestions')
  contextual(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.contextualSuggestions(user.appUserId);
  }

  @Post('missed-log-recovery')
  missed(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
      snacks?: string;
      drinks?: string;
      location?: string;
    },
  ) {
    return this.assist.missedLogRecovery(user.appUserId, body);
  }

  @Get('habit-patterns')
  habits(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.habitPatterns(user.appUserId);
  }

  @Get('data-quality')
  quality(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.dataQuality(user.appUserId);
  }

  @Get('explain-target')
  explain(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.explainTarget(user.appUserId);
  }

  @Post('simulate-goal')
  simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      activityLevel?: 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
      goal?: 'lose_weight' | 'maintain' | 'gain_weight' | 'manual';
      manualTarget?: number;
      targetRate?: number;
    },
  ) {
    return this.assist.simulateGoal(user.appUserId, body);
  }

  @Get('weekly-planning-brief')
  brief(@CurrentUser() user: AuthenticatedUser) {
    return this.assist.weeklyPlanningBrief(user.appUserId);
  }
}
