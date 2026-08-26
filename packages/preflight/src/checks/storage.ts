import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { type Check, fail, pass } from '../types.js';

export const storageCheck: Check = {
  id: 7,
  title: 'Object storage',
  async run(context) {
    if (!context.capabilities.has('storage')) {
      return [];
    }

    const name = 'Upload bucket is reachable';
    const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET } = context.env;

    if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
      return [
        fail(
          'storage',
          name,
          'not checked — the S3_* variables are incomplete',
          'Fix the storage variables above first',
        ),
      ];
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: S3_ENDPOINT,
      forcePathStyle: context.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      return [pass('storage', name, `${S3_BUCKET} at ${S3_ENDPOINT}`)];
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'HeadBucket failed';
      const fix =
        context.target === 'production'
          ? 'Create the R2 bucket and token: https://developers.cloudflare.com/r2/buckets/create-buckets/'
          : 'docker compose up -d storage storage-init';

      return [fail('storage', name, `${S3_BUCKET} at ${S3_ENDPOINT}: ${reason}`, fix)];
    } finally {
      client.destroy();
    }
  },
};
