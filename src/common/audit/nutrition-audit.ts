import type { Prisma } from '@prisma/client';

type Tx = {
  auditEvent: {
    create: (args: {
      data: {
        userId: string;
        action: string;
        entityType: string;
        entityId?: string | null;
        metadata?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

const ALLOWED_META_KEYS = new Set([
  'goalId',
  'previewId',
  'rootGoalId',
  'parentGoalId',
  'revisionNumber',
  'status',
  'source',
  'warningCount',
  'blockingCount',
  'hasAggressive',
  'confirmationTextVersion',
  'eligible',
  'evidenceCount',
  'screeningVersion',
  'route',
]);

export async function trackNutritionAudit(
  db: Tx,
  input: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const metadata = sanitizeMetadata(input.metadata);
  await db.auditEvent.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> {
  if (!metadata) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (!ALLOWED_META_KEYS.has(k)) continue;
    if (v == null) continue;
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    ) {
      out[k] = v;
    }
  }
  return out;
}
