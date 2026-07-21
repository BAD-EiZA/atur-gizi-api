import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { UsersService } from './users.service';
import {
  CreateWeightLogDto,
  PatchMacroTargetsDto,
  PatchProfileDto,
  PatchSettingsDto,
} from './dto/profile.dto';

@Controller('v1')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('users/sync')
  sync(@CurrentUser() user: AuthenticatedUser) {
    return this.users.sync(user.claims);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.appUserId);
  }

  @Patch('me/profile')
  patchProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatchProfileDto) {
    return this.users.patchProfile(user.appUserId, dto);
  }

  @Patch('me/settings')
  patchSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatchSettingsDto) {
    return this.users.patchSettings(user.appUserId, dto);
  }

  @Get('weight-logs')
  listWeight(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.users.listWeightLogs(user.appUserId, limit ? parseInt(limit, 10) : 30);
  }

  @Post('weight-logs')
  createWeight(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWeightLogDto) {
    return this.users.createWeightLog(user.appUserId, dto);
  }

  @Patch('me/macro-targets')
  patchMacros(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatchMacroTargetsDto) {
    return this.users.patchMacroTargets(user.appUserId, dto);
  }
}
