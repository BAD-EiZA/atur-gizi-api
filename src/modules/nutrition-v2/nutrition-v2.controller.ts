import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { NutritionV2Service } from './nutrition-v2.service';
import { NutritionV2GoalsService } from './nutrition-v2-goals.service';
import { PreviewNutritionBasicsDto } from './dto/nutrition-basics.dto';
import {
  ActivateGoalDto,
  CreateGoalFromPreviewDto,
  ListGoalsQueryDto,
  ManualGoalDto,
  PreviewGoalDto,
  RecalculateGoalDto,
  UpsertScreeningDto,
} from './dto/nutrition-goal.dto';

@Controller('v2/nutrition')
@UseGuards(AuthGuard)
export class NutritionV2Controller {
  constructor(
    private readonly nutritionV2: NutritionV2Service,
    private readonly goals: NutritionV2GoalsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('basics/current')
  currentBasics(@CurrentUser() user: AuthenticatedUser) {
    return this.nutritionV2.basicsFromProfile(user.appUserId);
  }

  @Post('basics/preview')
  previewBasics(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewNutritionBasicsDto,
  ) {
    return this.nutritionV2.previewBasics(user.appUserId, dto);
  }

  @Get('safety-screening')
  getScreening(@CurrentUser() user: AuthenticatedUser) {
    return this.goals.getScreening(user.appUserId);
  }

  @Put('safety-screening')
  async putScreening(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertScreeningDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'PUT /v2/nutrition/safety-screening';
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      dto,
    );
    if (started?.replay) return started.body;
    const result = await this.goals.upsertScreening(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Delete('safety-screening')
  async deleteScreening(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'DELETE /v2/nutrition/safety-screening';
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      {},
    );
    if (started?.replay) return started.body;
    const result = await this.goals.deleteScreening(user.appUserId);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Post('preview')
  previewGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewGoalDto,
  ) {
    return this.goals.previewGoal(user.appUserId, dto);
  }

  @Post('goals')
  async createGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalFromPreviewDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'POST /v2/nutrition/goals';
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      dto,
    );
    if (started?.replay) return started.body;
    const result = await this.goals.createGoalFromPreview(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        201,
        result,
      );
    }
    return result;
  }

  @Post('goals/:goalId/activate')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Body() dto: ActivateGoalDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v2/nutrition/goals/${goalId}/activate`;
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      dto,
    );
    if (started?.replay) return started.body;
    const result = await this.goals.activateGoal(user.appUserId, goalId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Post('goals/:goalId/cancel')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v2/nutrition/goals/${goalId}/cancel`;
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      {},
    );
    if (started?.replay) return started.body;
    const result = await this.goals.cancelGoal(user.appUserId, goalId);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Get('goals/current')
  currentGoal(@CurrentUser() user: AuthenticatedUser) {
    return this.goals.currentGoal(user.appUserId);
  }

  @Get('goals')
  listGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.goals.listGoals(user.appUserId, query.cursor, query.limit);
  }

  @Post('goals/:goalId/recalculate')
  async recalculate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Body() dto: RecalculateGoalDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v2/nutrition/goals/${goalId}/recalculate`;
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      dto,
    );
    if (started?.replay) return started.body;
    const result = await this.goals.recalculateGoal(
      user.appUserId,
      goalId,
      dto,
    );
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        201,
        result,
      );
    }
    return result;
  }

  @Post('goals/:goalId/reevaluate-completion')
  async reevaluateCompletion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v2/nutrition/goals/${goalId}/reevaluate-completion`;
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      {},
    );
    if (started?.replay) return started.body;
    const result = await this.goals.reevaluateCompletion(
      user.appUserId,
      goalId,
    );
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Post('goals/:goalId/confirm-completion')
  async confirmCompletion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = `POST /v2/nutrition/goals/${goalId}/confirm-completion`;
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      {},
    );
    if (started?.replay) return started.body;
    const result = await this.goals.confirmCompletion(user.appUserId, goalId);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        200,
        result,
      );
    }
    return result;
  }

  @Post('manual-goals')
  async manualGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualGoalDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'POST /v2/nutrition/manual-goals';
    const started = await this.idempotency.begin(
      user.appUserId,
      idemKey,
      route,
      dto,
    );
    if (started?.replay) return started.body;
    const result = await this.goals.createManualGoal(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(
        user.appUserId,
        idemKey,
        route,
        started.requestHash,
        201,
        result,
      );
    }
    return result;
  }
}
