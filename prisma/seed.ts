/**
 * Idempotent seed: curated templates only. There are no user accounts to seed — creators are
 * anonymous (ADR 0005) and the operator authenticates with ADMIN_TOKEN.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { DraftStepSchema } from '@momentpath/contracts';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';
import { TEMPLATES } from './templates';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    for (const t of TEMPLATES) {
      // Fail the seed if a template ever drifts from the step schemas.
      t.content.steps.forEach((s) => DraftStepSchema.parse(s));
      await prisma.template.upsert({
        where: { key: t.key },
        create: {
          key: t.key,
          name: t.name,
          description: t.description,
          tier: t.tier,
          version: t.version,
          position: t.position,
          content: t.content,
        },
        update: {
          name: t.name,
          description: t.description,
          tier: t.tier,
          version: t.version,
          position: t.position,
          content: t.content,
          isActive: true,
        },
      });
    }
    console.warn(`Seeded ${TEMPLATES.length} templates`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
