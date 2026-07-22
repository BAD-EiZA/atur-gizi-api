/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const store = new Map<string, Record<string, unknown>>();

  const keyOf = (userId: string, key: string, route: string) =>
    `${userId}|${key}|${route}`;

  const prisma = {
    idempotencyKey: {
      findUnique: async ({
        where,
      }: {
        where: {
          userId_key_route: { userId: string; key: string; route: string };
        };
      }) => {
        const k = keyOf(
          where.userId_key_route.userId,
          where.userId_key_route.key,
          where.userId_key_route.route,
        );
        return store.get(k) ?? null;
      },
      create: async ({ data }: { data: any }) => {
        const k = keyOf(data.userId, data.key, data.route);
        if (store.has(k)) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            { code: 'P2002', clientVersion: 'test' },
          );
        }
        const row = { id: `id-${store.size + 1}`, ...data };
        store.set(k, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        for (const [k, v] of store.entries()) {
          if (v.id === where.id) {
            const next = { ...v, ...data };
            store.set(k, next);
            return next;
          }
        }
        return null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        for (const [k, v] of store.entries()) {
          if (v.id === where.id) store.delete(k);
        }
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          userId_key_route: { userId: string; key: string; route: string };
        };
        create: any;
        update: any;
      }) => {
        const k = keyOf(
          where.userId_key_route.userId,
          where.userId_key_route.key,
          where.userId_key_route.route,
        );
        if (store.has(k)) {
          const next = { ...store.get(k), ...update };
          store.set(k, next);
          return next;
        }
        const row = { id: `id-${store.size + 1}`, ...create };
        store.set(k, row);
        return row;
      },
      updateMany: async () => ({ count: 0 }),
    },
  };

  const service = new IdempotencyService(prisma as never);

  beforeEach(() => store.clear());

  it('creates processing reservation then completes', async () => {
    const begin = await service.begin('u1', 'k1', 'POST /x', { a: 1 });
    expect(begin && !begin.replay).toBe(true);
    if (!begin || begin.replay) return;
    await service.save('u1', 'k1', 'POST /x', begin.requestHash, 201, {
      ok: true,
    });
    const replay = await service.begin('u1', 'k1', 'POST /x', { a: 1 });
    expect(replay && replay.replay).toBe(true);
    if (replay && replay.replay) {
      expect(replay.body).toEqual({ ok: true });
      expect(replay.statusCode).toBe(201);
    }
  });

  it('conflicts on same key different body', async () => {
    const begin = await service.begin('u1', 'k1', 'POST /x', { a: 1 });
    if (!begin || begin.replay) return;
    await service.save('u1', 'k1', 'POST /x', begin.requestHash, 200, {
      ok: 1,
    });
    await expect(
      service.begin('u1', 'k1', 'POST /x', { a: 2 }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects concurrent processing reservation', async () => {
    await service.begin('u1', 'k1', 'POST /x', { a: 1 });
    await expect(
      service.begin('u1', 'k1', 'POST /x', { a: 1 }),
    ).rejects.toMatchObject({
      response: { error: { code: 'IDEMPOTENCY_IN_PROGRESS' } },
    });
  });

  it('uses stable hash independent of key order', () => {
    const a = service.hashBody({ b: 1, a: 2 });
    const b = service.hashBody({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});
