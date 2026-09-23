import { Injectable } from '@nestjs/common';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import type { ActorType } from '../../generated/prisma/client';

export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  actorType: ActorType;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  requestId: string | null;
  /** Identifiers and counts only. Never message bodies, answers, tokens or gift values. */
  metadata?: AuditMetadata;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        requestId: entry.requestId,
        metadata: entry.metadata ?? {},
      },
    });
  }
}
