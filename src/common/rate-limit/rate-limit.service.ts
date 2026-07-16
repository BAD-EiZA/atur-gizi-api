import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  private windowStart(minutes = 1) {
    const d = new Date();
    d.setUTCSeconds(0, 0);
    d.setUTCMinutes(Math.floor(d.getUTCMinutes() / minutes) * minutes);
    return d;
  }

  async hit(opts: {
    userId?: string;
    ip?: string;
    routeKey: string;
    limit: number;
    windowMinutes?: number;
  }) {
    const windowStart = this.windowStart(opts.windowMinutes ?? 1);
    const bucketKey = opts.userId
      ? `u:${opts.userId}`
      : `ip:${createHash('sha256').update(opts.ip ?? 'unknown').digest('hex').slice(0, 32)}`;

    const row = await this.prisma.rateLimitBucket.upsert({
      where: {
        bucketKey_routeKey_windowStart: {
          bucketKey,
          routeKey: opts.routeKey,
          windowStart,
        },
      },
      create: {
        bucketKey,
        routeKey: opts.routeKey,
        windowStart,
        count: 1,
        userId: opts.userId,
      },
      update: { count: { increment: 1 } },
    });

    if (row.count > opts.limit) {
      throw new AppException(
        'RATE_LIMITED',
        'Terlalu banyak permintaan. Coba lagi sebentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return row.count;
  }
}
