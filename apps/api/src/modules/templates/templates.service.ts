import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplateContentSchema, type TemplateContent } from './template-content';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const templates = await this.prisma.template.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return {
      items: templates.map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
        stepCount: TemplateContentSchema.parse(t.content).steps.length,
        tier: t.tier,
      })),
    };
  }

  async find(key: string): Promise<TemplateContent | null> {
    const template = await this.prisma.template.findFirst({ where: { key, isActive: true } });
    return template ? TemplateContentSchema.parse(template.content) : null;
  }
}
