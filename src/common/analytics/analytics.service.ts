import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Product analytics — no food names, photos, or health values. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(userId: string | null, name: string, props?: Record<string, unknown>) {
    if (userId) {
      const settings = await this.prisma.userSettings.findUnique({
        where: { userId },
        select: { analyticsConsent: true },
      });
      if (!settings?.analyticsConsent) return;
    }
    const safe: Record<string, unknown> = {};
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (
          ['name', 'title', 'photo', 'weight', 'dob', 'email', 'image'].some((x) => k.toLowerCase().includes(x)) ||
          !['string', 'number', 'boolean'].includes(typeof v) ||
          (typeof v === 'string' && v.length > 100)
        ) {
          continue;
        }
        safe[k] = v;
      }
    }
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          userId: userId || null,
          name,
          props: Object.keys(safe).length ? (safe as object) : undefined,
        },
      });
    } catch {
      // never block user actions
    }
  }
}
