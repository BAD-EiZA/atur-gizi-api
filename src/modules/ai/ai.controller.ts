import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AiService } from './ai.service';
import { ConfirmAnalysisDto, StartAnalysisDto } from './dto/ai.dto';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import type { Request } from 'express';

@Controller('v1/food-analyses')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly rateLimit: RateLimitService,
    private readonly idempotency: IdempotencyService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Post()
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartAnalysisDto,
    @Req() req: Request,
  ) {
    await this.rateLimit.hit({
      userId: user.appUserId,
      ip: req.ip,
      routeKey: 'food-analyses',
      limit: 20,
      windowMinutes: 1,
    });
    await this.analytics.track(user.appUserId, 'food_ai_analysis_started');
    try {
      const result = await this.ai.start(user.appUserId, dto);
      await this.analytics.track(user.appUserId, 'food_ai_analysis_succeeded');
      return result;
    } catch (e) {
      await this.analytics.track(user.appUserId, 'food_ai_analysis_failed');
      throw e;
    }
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.get(user.appUserId, id);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.retry(user.appUserId, id);
  }

  @Post(':id/confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmAnalysisDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v1/food-analyses/${id}/confirm`;
    const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
    if (started?.replay) return started.body;
    const result = await this.ai.confirm(user.appUserId, id, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
    }
    await this.analytics.track(user.appUserId, 'food_ai_result_confirmed');
    return result;
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.cancel(user.appUserId, id);
  }
}
