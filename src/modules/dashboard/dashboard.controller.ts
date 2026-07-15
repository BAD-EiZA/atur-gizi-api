import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { DashboardService } from './dashboard.service';
import { AppException } from '../../common/errors/app.exception';
import { HttpStatus } from '@nestjs/common';

@Controller('v1')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  daily(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    return this.dashboard.daily(user.appUserId, date);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from || !to) {
      throw new AppException(
        'HISTORY_RANGE_REQUIRED',
        'Parameter from dan to wajib (YYYY-MM-DD).',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.dashboard.history(user.appUserId, from, to);
  }
}
