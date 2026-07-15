import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, PreviewTargetDto } from './dto/onboarding.dto';

@Controller('v1/onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('preview-target')
  preview(@Body() dto: PreviewTargetDto) {
    return this.onboarding.preview(dto);
  }

  @Post('complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompleteOnboardingDto) {
    return this.onboarding.complete(user.appUserId, dto);
  }
}
