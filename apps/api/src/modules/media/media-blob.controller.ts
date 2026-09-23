import { Controller, Get, Inject, Param, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MAX_IMAGE_BYTES } from '@momentpath/contracts';
import { Problem } from '../../common/problem';
import { PrismaService } from '../../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../providers/storage';
import { Public } from '../identity/decorators';
import { FilesystemStorage } from './storage/filesystem-storage';

/**
 * Serves signed filesystem-storage URLs in development and tests (the S3 adapter never
 * routes here). Authorization is the HMAC signature on the URL, like an S3 presigned URL.
 */
@ApiExcludeController()
@Public()
@Controller('media/blob')
export class MediaBlobController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly prisma: PrismaService,
  ) {}

  private fs(): FilesystemStorage {
    if (!(this.storage instanceof FilesystemStorage)) throw Problem.notFound();
    return this.storage;
  }

  @Put(':key')
  async put(
    @Param('key') key: string,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const grant = this.fs().verify(key, query);
    if (!grant || grant.op !== 'put')
      throw Problem.forbidden('INVALID_SIGNATURE', 'Invalid or expired link');
    if ((req.headers['content-type'] ?? '') !== grant.contentType) {
      throw Problem.badRequest(
        'CONTENT_TYPE_MISMATCH',
        'Content type does not match the upload grant',
      );
    }
    const body = req.body as unknown;
    if (
      !Buffer.isBuffer(body) ||
      body.length === 0 ||
      body.length > MAX_IMAGE_BYTES ||
      body.length !== grant.size
    ) {
      throw Problem.badRequest('SIZE_MISMATCH', 'Upload size does not match the upload grant');
    }
    // Only pending assets accept bytes; a completed asset cannot be overwritten with a replayed URL.
    const asset = await this.prisma.mediaAsset.findUnique({ where: { storageKey: grant.key } });
    if (!asset || asset.status !== 'PENDING_UPLOAD')
      throw Problem.forbidden('UPLOAD_CLOSED', 'Upload is closed');
    await this.fs().write(grant.key, body);
    res.status(200).end();
  }

  @Get(':key')
  async get(
    @Param('key') key: string,
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const grant = this.fs().verify(key, query);
    if (!grant || grant.op !== 'get') throw Problem.notFound();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { storageKey: grant.key } });
    if (!asset || asset.status !== 'READY') throw Problem.notFound();
    const bytes = await this.fs().read(grant.key, MAX_IMAGE_BYTES);
    if (!bytes) throw Problem.notFound();
    res
      .status(200)
      .setHeader('content-type', asset.mimeType)
      .setHeader('cache-control', 'private, max-age=300')
      .setHeader('x-content-type-options', 'nosniff')
      .setHeader('content-security-policy', "default-src 'none'; sandbox")
      .setHeader('cross-origin-resource-policy', 'same-site')
      .end(bytes);
  }
}
