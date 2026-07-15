import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { AiService } from './ai.service';
import { ConfirmAnalysisDto, StartAnalysisDto } from './dto/ai.dto';

@Controller('v1/food-analyses')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartAnalysisDto) {
    return this.ai.start(user.appUserId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.get(user.appUserId, id);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.retry(user.appUserId, id);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmAnalysisDto,
  ) {
    return this.ai.confirm(user.appUserId, id, dto);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ai.cancel(user.appUserId, id);
  }
}
