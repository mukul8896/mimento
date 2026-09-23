import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  imports: [MediaModule],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService, OutboxProcessor],
})
export class OutboxModule {}
