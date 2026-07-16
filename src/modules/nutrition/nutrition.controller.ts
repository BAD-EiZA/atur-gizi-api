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
import { NutritionService } from './nutrition.service';
import { CreateFoodLogDto, UpdateFoodLogDto } from './dto/food-log.dto';
import { MealType } from '@prisma/client';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';

@Controller('v1/food-logs')
@UseGuards(AuthGuard)
export class NutritionController {
  constructor(
    private readonly nutrition: NutritionService,
    private readonly idempotency: IdempotencyService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFoodLogDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'POST /v1/food-logs';
    const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
    if (started?.replay) return started.body;
    const result = await this.nutrition.create(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
    }
    await this.analytics.track(user.appUserId, 'food_log_created_manual');
    return result;
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('mealType') mealType?: MealType,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nutrition.list(user.appUserId, {
      from,
      to,
      mealType,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutrition.get(user.appUserId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFoodLogDto,
  ) {
    return this.nutrition.update(user.appUserId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.nutrition.remove(user.appUserId, id);
  }
}
