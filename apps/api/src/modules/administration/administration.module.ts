import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { AdminController } from './admin.controller';

@Module({ imports: [ModerationModule], controllers: [AdminController] })
export class AdministrationModule {}
