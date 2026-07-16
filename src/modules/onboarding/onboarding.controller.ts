import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { AnalyticsService } from '../../common/analytics/analytics.service';

@Controller('v1/onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly idempotency: IdempotencyService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Post('preview-target')
  preview(@Body() dto: PreviewTargetDto) {
    return this.onboarding.preview(dto);
  }

  @Post('complete')
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteOnboardingDto,
    @Headers('idempotency-key') idemKey?: string,
  ) {
    const route = 'POST /v1/onboarding/complete';
    const started = await this.idempotency.begin(user.appUserId, idemKey, route, dto);
    if (started?.replay) return started.body;
    const result = await this.onboarding.complete(user.appUserId, dto);
    if (idemKey && started && !started.replay) {
      await this.idempotency.save(user.appUserId, idemKey, route, started.requestHash, 201, result);
    }
    await this.analytics.track(user.appUserId, 'onboarding_completed');
    return result;
  }
}
