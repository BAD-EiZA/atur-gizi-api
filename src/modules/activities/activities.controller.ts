import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { ActivitiesService } from './activities.service';
import {
  AnalyzeActivityScreenshotDto,
  CreateActivityLogDto,
  EstimateActivityDto,
  UpdateActivityLogDto,
} from './dto/activity.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';

@Controller('v1')
@UseGuards(AuthGuard)
export class ActivitiesController {
  constructor(
    private readonly activities: ActivitiesService,
    private readonly idempotency: IdempotencyService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('activity-types')
  types() {
    return this.activities.listTypes();
  }

  @Post('activity-estimates')
  estimate(@CurrentUser() user: AuthenticatedUser, @Body() dto: EstimateActivityDto) {
    return this.activities.estimate(user.appUserId, dto);
  }

  @Post('activity-screenshot-analyses')
  async analyzeScreenshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AnalyzeActivityScreenshotDto,
  ) {
    const result = await this.activities.analyzeScreenshot(user.appUserId, dto);
    await this.analytics.track(user.appUserId, 'activity_screenshot_analyzed');
    return result;
  }

  @Post('activity-logs')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityLogDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'POST /v1/activity-logs';
    const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
    if (started?.replay) return started.body;
    const result = await this.activities.create(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
    }
    await this.analytics.track(user.appUserId, 'activity_log_created');
    return result;
  }

  @Get('activity-logs')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activities.list(user.appUserId, {
      from,
      to,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('activity-logs/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.activities.get(user.appUserId, id);
  }

  @Patch('activity-logs/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateActivityLogDto,
  ) {
    return this.activities.update(user.appUserId, id, dto);
  }

  @Delete('activity-logs/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.activities.remove(user.appUserId, id);
  }
}
