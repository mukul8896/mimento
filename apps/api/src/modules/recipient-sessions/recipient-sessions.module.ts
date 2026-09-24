import { Module } from '@nestjs/common';
import { GiftsModule } from '../gifts/gifts.module';
import { MediaModule } from '../media/media.module';
import { PublicController, ShortLinkController } from './public.controller';
import { RecipientSessionsService } from './recipient-sessions.service';

@Module({
  imports: [MediaModule, GiftsModule],
  controllers: [PublicController, ShortLinkController],
  providers: [RecipientSessionsService],
})
export class RecipientSessionsModule {}
