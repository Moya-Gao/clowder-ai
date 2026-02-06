/**
 * Uploads Static File Route
 * Serves uploaded images from the uploads directory.
 */

import type { FastifyPluginAsync } from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';

export interface UploadsRoutesOptions {
  uploadDir: string;
}

export const uploadsRoutes: FastifyPluginAsync<UploadsRoutesOptions> =
  async (app, opts) => {
  await app.register(fastifyStatic, {
    root: resolve(opts.uploadDir),
    prefix: '/uploads/',
    decorateReply: false,
  });
};
