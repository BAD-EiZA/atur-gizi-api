import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashBody(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  async begin(userId: string, key: string | undefined, route: string, body: unknown) {
    if (!key) return null;
    const requestHash = this.hashBody(body);
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key_route: { userId, key, route } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppException(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key sama dengan body berbeda.',
          HttpStatus.CONFLICT,
        );
      }
      return { replay: true as const, statusCode: existing.statusCode, body: existing.responseBody };
    }
    return { replay: false as const, requestHash };
  }

  async save(
    userId: string,
    key: string,
    route: string,
    requestHash: string,
    statusCode: number,
    responseBody: unknown,
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.idempotencyKey.upsert({
      where: { userId_key_route: { userId, key, route } },
      create: {
        userId,
        key,
        route,
        requestHash,
        statusCode,
        responseBody: responseBody as object,
        expiresAt,
      },
      update: {
        statusCode,
        responseBody: responseBody as object,
        expiresAt,
      },
    });
  }
}
