import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { GiftsModule } from '../gifts/gifts.module';
import { MediaModule } from '../media/media.module';
import { TemplatesModule } from '../templates/templates.module';
import { AccountDeletionService } from './account-deletion.service';
import { ExperienceLifecycleService } from './experience-lifecycle.service';
import { ExperiencesController } from './experiences.controller';
import { ExperiencesService } from './experiences.service';

@Module({
  imports: [TemplatesModule, GiftsModule, MediaModule, EntitlementsModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService, ExperienceLifecycleService, AccountDeletionService],
  exports: [ExperiencesService, ExperienceLifecycleService, AccountDeletionService],
})
export class ExperiencesModule {}
