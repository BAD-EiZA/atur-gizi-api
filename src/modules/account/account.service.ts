import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { AppException } from '../../common/errors/app.exception';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async requestDeletion(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppException(
        'USER_NOT_FOUND',
        'Pengguna tidak ditemukan.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (user.status === 'deleted') {
      return { status: 'deleted' };
    }

    await this.prisma.appUser.update({
      where: { id: userId },
      data: { status: 'deletion_requested' },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'account_deletion_requested',
        entityType: 'app_users',
        entityId: userId,
      },
    });

    // Best-effort immediate cleanup (idempotent-ish)
    const analyses = await this.prisma.aiAnalysisRun.findMany({
      where: { userId },
      select: { cloudinaryPublicId: true },
    });
    for (const a of analyses) {
      await this.media.destroy(a.cloudinaryPublicId);
    }
    const foods = await this.prisma.foodLog.findMany({
      where: { userId, cloudinaryPublicId: { not: null } },
      select: { cloudinaryPublicId: true },
    });
    for (const f of foods) {
      if (f.cloudinaryPublicId) await this.media.destroy(f.cloudinaryPublicId);
    }

    await this.prisma.$transaction([
      this.prisma.foodItem.deleteMany({
        where: { foodLog: { userId } },
      }),
      this.prisma.foodLog.deleteMany({ where: { userId } }),
      this.prisma.activityLog.deleteMany({ where: { userId } }),
      this.prisma.aiAnalysisRun.deleteMany({ where: { userId } }),
      this.prisma.aiUsageDaily.deleteMany({ where: { userId } }),
      this.prisma.dailyTarget.deleteMany({ where: { userId } }),
      this.prisma.idempotencyKey.deleteMany({ where: { userId } }),
      this.prisma.favoriteFood.deleteMany({ where: { userId } }),
      this.prisma.favoriteActivity.deleteMany({ where: { userId } }),
      this.prisma.mealPlan.deleteMany({ where: { userId } }),
      this.prisma.barcodeScan.deleteMany({ where: { userId } }),
      this.prisma.wearableLink.deleteMany({ where: { userId } }),
      this.prisma.socialPost.deleteMany({ where: { userId } }),
      this.prisma.weeklyInsight.deleteMany({ where: { userId } }),
      this.prisma.exportJob.deleteMany({ where: { userId } }),
      this.prisma.subscription.deleteMany({ where: { userId } }),
      this.prisma.rateLimitBucket.deleteMany({ where: { userId } }),
      this.prisma.analyticsEvent.deleteMany({ where: { userId } }),
      this.prisma.mealMemory.deleteMany({ where: { userId } }),
      this.prisma.nutritionGoalAcceptance.deleteMany({ where: { userId } }),
      this.prisma.nutritionGoal.deleteMany({ where: { userId } }),
      this.prisma.nutritionPreview.deleteMany({ where: { userId } }),
      this.prisma.nutritionSafetyScreening.deleteMany({ where: { userId } }),
      this.prisma.userProfile.deleteMany({ where: { userId } }),
      this.prisma.userSettings.deleteMany({ where: { userId } }),
      this.prisma.appUser.update({
        where: { id: userId },
        data: {
          status: 'deleted',
          email: null,
          displayName: 'deleted',
          deletedAt: new Date(),
          kindeUserId: `deleted_${userId}`,
        },
      }),
    ]);

    return { status: 'deleted' };
  }

  async status(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return { status: 'not_found' };
    }
    return { status: user.status };
  }
}
