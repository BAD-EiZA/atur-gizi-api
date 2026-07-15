import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateActivityLogDto,
  EstimateActivityDto,
  UpdateActivityLogDto,
} from './dto/activity.dto';

@Controller('v1')
@UseGuards(AuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get('activity-types')
  types() {
    return this.activities.listTypes();
  }

  @Post('activity-estimates')
  estimate(@CurrentUser() user: AuthenticatedUser, @Body() dto: EstimateActivityDto) {
    return this.activities.estimate(user.appUserId, dto);
  }

  @Post('activity-logs')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateActivityLogDto) {
    return this.activities.create(user.appUserId, dto);
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
