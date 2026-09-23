import { Module } from '@nestjs/common';
import { GiftsModule } from '../gifts/gifts.module';
import { MediaModule } from '../media/media.module';
import { PublicController } from './public.controller';
import { RecipientSessionsService } from './recipient-sessions.service';

@Module({
  imports: [MediaModule, GiftsModule],
  controllers: [PublicController],
  providers: [RecipientSessionsService],
})
export class RecipientSessionsModule {}
