import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MediaModule } from '../media/media.module';
import { PublishValidatorService } from './publish-validator.service';

@Module({
  imports: [MediaModule, EntitlementsModule],
  providers: [PublishValidatorService],
  exports: [PublishValidatorService],
})
export class WorkflowModule {}
