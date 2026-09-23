import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ExperiencesModule } from '../experiences/experiences.module';
import { AuthGuard } from './auth.guard';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [ExperiencesModule],
  controllers: [IdentityController],
  providers: [IdentityService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [IdentityService],
})
export class IdentityModule {}
