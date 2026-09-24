import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { TemplatesModule } from '../templates/templates.module';
import { AdminController } from './admin.controller';

@Module({ imports: [ModerationModule, TemplatesModule], controllers: [AdminController] })
export class AdministrationModule {}
