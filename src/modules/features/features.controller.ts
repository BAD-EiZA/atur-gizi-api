import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { FeaturesService } from './features.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';
import { MealType } from '@prisma/client';
import type { Request } from 'express';

@Controller('v1')
@UseGuards(AuthGuard)
export class FeaturesController {
  constructor(
    private readonly features: FeaturesService,
    private readonly rateLimit: RateLimitService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('insights/weekly')
  async weekly(
    @CurrentUser() user: AuthenticatedUser,
    @Query('weekStart') weekStart?: string,
  ) {
    const data = await this.features.weeklySummary(user.appUserId, weekStart);
    await this.analytics.track(user.appUserId, 'weekly_summary_viewed');
    return data;
  }

  @Get('macros/targets')
  macros(@CurrentUser() user: AuthenticatedUser) {
    return this.features.macroTargets(user.appUserId);
  }

  @Get('favorites/foods')
  favFoods(@CurrentUser() user: AuthenticatedUser) {
    return this.features.listFavoriteFoods(user.appUserId);
  }

  @Post('favorites/foods')
  createFavFood(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      name: string;
      portionAmount: number;
      portionUnit: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
    },
  ) {
    return this.features.createFavoriteFood(user.appUserId, body);
  }

  @Delete('favorites/foods/:id')
  delFavFood(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.features.deleteFavoriteFood(user.appUserId, id);
  }

  @Get('favorites/activities')
  favActs(@CurrentUser() user: AuthenticatedUser) {
    return this.features.listFavoriteActivities(user.appUserId);
  }

  @Post('favorites/activities')
  createFavAct(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { activityTypeId?: string; customName?: string; defaultMinutes?: number },
  ) {
    return this.features.createFavoriteActivity(user.appUserId, body);
  }

  @Delete('favorites/activities/:id')
  delFavAct(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.features.deleteFavoriteActivity(user.appUserId, id);
  }

  @Get('meal-plans')
  mealPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.features.listMealPlans(user.appUserId, from, to);
  }

  @Post('meal-plans')
  createMealPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      title: string;
      planDate: string;
      mealType: MealType;
      items: unknown[];
      totalCalories: number;
      notes?: string;
    },
  ) {
    return this.features.createMealPlan(user.appUserId, body);
  }

  @Delete('meal-plans/:id')
  delMealPlan(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.features.deleteMealPlan(user.appUserId, id);
  }

  @Get('barcodes/:code')
  async barcode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Req() req: Request,
  ) {
    await this.rateLimit.hit({
      userId: user.appUserId,
      ip: req.ip,
      routeKey: 'barcode',
      limit: 60,
    });
    const data = await this.features.lookupBarcode(user.appUserId, code);
    await this.analytics.track(user.appUserId, 'barcode_lookup');
    return data;
  }

  @Post('barcodes')
  registerBarcode(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      barcode: string;
      name: string;
      brand?: string;
      calories: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      servingSize?: string;
    },
  ) {
    return this.features.registerBarcode(user.appUserId, body);
  }

  @Get('wearables')
  wearables(@CurrentUser() user: AuthenticatedUser) {
    return this.features.listWearables(user.appUserId);
  }

  @Post('wearables/:provider/connect')
  connectWearable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ) {
    return this.features.connectWearable(user.appUserId, provider);
  }

  @Post('wearables/:provider/sync')
  syncWearable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ) {
    return this.features.syncWearable(user.appUserId, provider);
  }

  @Delete('wearables/:provider')
  disconnectWearable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('provider') provider: string,
  ) {
    return this.features.disconnectWearable(user.appUserId, provider);
  }

  @Get('social/feed')
  feed(@CurrentUser() user: AuthenticatedUser) {
    return this.features.listFeed(user.appUserId);
  }

  @Post('social/posts')
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { body: string; visibility?: string },
  ) {
    return this.features.createPost(user.appUserId, body.body, body.visibility);
  }

  @Delete('social/posts/:id')
  delPost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.features.deletePost(user.appUserId, id);
  }

  @Post('exports')
  export(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { format?: 'json' | 'csv' },
  ) {
    return this.features.exportData(user.appUserId, body.format ?? 'json');
  }

  @Get('billing/subscription')
  subscription(@CurrentUser() user: AuthenticatedUser) {
    return this.features.getSubscription(user.appUserId);
  }

  @Post('billing/checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() body: { plan: string }) {
    return this.features.checkout(user.appUserId, body.plan);
  }

  @Post('analytics/events')
  async track(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { name: string; props?: Record<string, unknown> },
  ) {
    await this.analytics.track(user.appUserId, body.name, body.props);
    return { ok: true };
  }
}
