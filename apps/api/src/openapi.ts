import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Wish Revealer API')
    .setDescription('Phase 1 REST API. Errors use application/problem+json with a requestId.')
    .setVersion('1.0.0')
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth()
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config), { version: '3.1' });
}
