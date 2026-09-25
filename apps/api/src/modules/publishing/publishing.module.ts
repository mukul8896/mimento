import { Module } from '@nestjs/common';
import { GiftsModule } from '../gifts/gifts.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { PublishingController } from './publishing.controller';
import { PublishingService } from './publishing.service';

@Module({
  imports: [WorkflowModule, GiftsModule],
  controllers: [PublishingController],
  providers: [PublishingService],
  exports: [PublishingService],
})
export class PublishingModule {}
