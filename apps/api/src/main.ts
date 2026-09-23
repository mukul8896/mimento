import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SwaggerModule } from '@nestjs/swagger';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';
import { buildOpenApi } from './openapi';

async function main(): Promise<void> {
  const rootEnv = path.resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const env = loadEnv();
  const app = await createApp(env);
  if (env.APP_ENV !== 'production') {
    SwaggerModule.setup('api/v1/docs', app, buildOpenApi(app), {
      jsonDocumentUrl: 'api/v1/docs-json',
    });
  }
  await app.listen(env.API_PORT);
}

void main();
