import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';

const TTL_MS = 24 * 60 * 60 * 1000;

type BeginResult =
  | null
  | { replay: true; statusCode: number; body: unknown }
  | { replay: false; requestHash: string };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashBody(body: unknown): string {
    return createHash('sha256')
      .update(this.stableJson(body ?? {}))
      .digest('hex');
  }

  async begin(
    userId: string,
    key: string | undefined,
    route: string,
    body: unknown,
  ): Promise<BeginResult> {
    if (!key) return null;
    if (!userId) {
      throw new AppException(
        'USER_NOT_SYNCED',
        'Panggil /v1/users/sync terlebih dahulu.',
        HttpStatus.NOT_FOUND,
      );
    }

    const requestHash = this.hashBody(body);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_MS);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key_route: { userId, key, route } },
    });

    if (existing) {
      if (existing.expiresAt.getTime() <= now.getTime()) {
        await this.prisma.idempotencyKey.delete({ where: { id: existing.id } });
      } else if (existing.requestHash !== requestHash) {
        throw new AppException(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency-Key sama dengan body berbeda.',
          HttpStatus.CONFLICT,
        );
      } else if (existing.status === 'processing') {
        throw new AppException(
          'IDEMPOTENCY_IN_PROGRESS',
          'Request identik sedang diproses.',
          HttpStatus.CONFLICT,
        );
      } else if (existing.status === 'failed') {
        await this.prisma.idempotencyKey.update({
          where: { id: existing.id },
          data: {
            status: 'processing',
            statusCode: 0,
            responseBody: {},
            expiresAt,
          },
        });
        return { replay: false, requestHash };
      } else {
        return {
          replay: true,
          statusCode: existing.statusCode,
          body: existing.responseBody,
        };
      }
    }

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          userId,
          key,
          route,
          requestHash,
          status: 'processing',
          statusCode: 0,
          responseBody: {},
          expiresAt,
        },
      });
      return { replay: false, requestHash };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const raced = await this.prisma.idempotencyKey.findUnique({
          where: { userId_key_route: { userId, key, route } },
        });
        if (!raced) {
          throw new AppException(
            'IDEMPOTENCY_CONFLICT',
            'Gagal reservasi idempotency.',
            HttpStatus.CONFLICT,
          );
        }
        if (raced.requestHash !== requestHash) {
          throw new AppException(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency-Key sama dengan body berbeda.',
            HttpStatus.CONFLICT,
          );
        }
        if (raced.status === 'processing') {
          throw new AppException(
            'IDEMPOTENCY_IN_PROGRESS',
            'Request identik sedang diproses.',
            HttpStatus.CONFLICT,
          );
        }
        if (raced.status === 'completed') {
          return {
            replay: true,
            statusCode: raced.statusCode,
            body: raced.responseBody,
          };
        }
        throw new AppException(
          'IDEMPOTENCY_IN_PROGRESS',
          'Request identik sedang diproses.',
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  async save(
    userId: string,
    key: string,
    route: string,
    requestHash: string,
    statusCode: number,
    responseBody: unknown,
  ) {
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.idempotencyKey.upsert({
      where: { userId_key_route: { userId, key, route } },
      create: {
        userId,
        key,
        route,
        requestHash,
        status: 'completed',
        statusCode,
        responseBody: responseBody as object,
        expiresAt,
      },
      update: {
        requestHash,
        status: 'completed',
        statusCode,
        responseBody: responseBody as object,
        expiresAt,
      },
    });
  }

  async fail(userId: string, key: string | undefined, route: string) {
    if (!key || !userId) return;
    await this.prisma.idempotencyKey.updateMany({
      where: {
        userId,
        key,
        route,
        status: 'processing',
      },
      data: {
        status: 'failed',
        statusCode: 500,
        responseBody: { error: { code: 'REQUEST_FAILED' } },
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  }

  private stableJson(value: unknown): string {
    return JSON.stringify(value, (_k, v: unknown) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const obj = v as Record<string, unknown>;
        return Object.keys(obj)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = obj[key];
            return acc;
          }, {});
      }
      return v;
    });
  }
}
