import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { MediaService } from './media.service';

@Controller('v1/media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-signature')
  signature(@CurrentUser() user: AuthenticatedUser) {
    return this.media.createUploadSignature(user.appUserId);
  }
}
