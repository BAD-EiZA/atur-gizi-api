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
import { NutritionService } from './nutrition.service';
import { CreateFoodLogDto, UpdateFoodLogDto } from './dto/food-log.dto';
import { MealType } from '@prisma/client';

@Controller('v1/food-logs')
@UseGuards(AuthGuard)
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFoodLogDto) {
    return this.nutrition.create(user.appUserId, dto);
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
