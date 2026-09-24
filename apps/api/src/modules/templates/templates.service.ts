import { Injectable } from '@nestjs/common';
import { materializeTemplate, type TemplateContent, type Tier } from '@momentpath/contracts';
import { Problem } from '../../common/problem';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplateContentSchema } from './template-content';

function summary(content: TemplateContent) {
  return {
    stepCount: content.steps.length,
    occasion: content.occasion,
    emoji: content.emoji,
    theme: content.theme,
    fields: content.fields,
  };
}

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
        ...summary(TemplateContentSchema.parse(t.content)),
        tier: t.tier,
      })),
    };
  }

  /**
   * A playable demo of a template with its example values, for the gallery and landing page.
   * Templates contain no private data, so this is public and needs no experience.
   */
  async preview(key: string) {
    const content = await this.find(key);
    if (!content) throw Problem.notFound('Template');
    const t = materializeTemplate(content, {}, 'preview');
    return { title: t.title, theme: t.theme, steps: t.steps, media: [] };
  }

  /** Every template, including hidden ones, for the operator console. */
  async adminList() {
    const templates = await this.prisma.template.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return {
      items: templates.map((t) => {
        const content = TemplateContentSchema.parse(t.content);
        return {
          key: t.key,
          name: t.name,
          occasion: content.occasion,
          emoji: content.emoji,
          tier: t.tier,
          isActive: t.isActive,
          position: t.position,
        };
      }),
    };
  }

  /**
   * The operator decides which templates are free or paid and which are shown. The seed never
   * overwrites these, so the choice survives every deploy.
   */
  async update(key: string, input: { tier?: Tier; isActive?: boolean }) {
    const existing = await this.prisma.template.findUnique({ where: { key } });
    if (!existing) throw Problem.notFound('Template');
    return this.prisma.template.update({
      where: { key },
      data: {
        ...(input.tier ? { tier: input.tier } : {}),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
  }

  async find(key: string): Promise<TemplateContent | null> {
    const template = await this.prisma.template.findFirst({ where: { key, isActive: true } });
    return template ? TemplateContentSchema.parse(template.content) : null;
  }
}
