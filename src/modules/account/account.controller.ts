import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AccountService } from './account.service';

@Controller('v1/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('deletion-request')
  request(@CurrentUser() user: AuthenticatedUser) {
    return this.account.requestDeletion(user.appUserId);
  }

  @Get('deletion-status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.account.status(user.appUserId);
  }
}
