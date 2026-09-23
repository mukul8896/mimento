import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../identity/decorators';

@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. */
  @Get('health')
  @Header('cache-control', 'no-store')
  health() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies (database) are reachable. */
  @Get('ready')
  @Header('cache-control', 'no-store')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
