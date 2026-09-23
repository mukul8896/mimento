import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MediaModule } from '../media/media.module';
import { ModerationService } from './moderation.service';

@Module({
  imports: [MediaModule, EntitlementsModule],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
