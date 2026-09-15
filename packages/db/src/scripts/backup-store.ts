import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/** The four operations the backup and the drill need from a bucket. */
export interface BackupStore {
  put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<Uint8Array>;
  list: (prefix: string) => Promise<string[]>;
  remove: (keys: readonly string[]) => Promise<void>;
}

type StoreVariable =
  | 'BACKUP_S3_ENDPOINT'
  | 'BACKUP_S3_ACCESS_KEY_ID'
  | 'BACKUP_S3_SECRET_ACCESS_KEY'
  | 'BACKUP_S3_BUCKET';
/** S3's ceiling on keys per `DeleteObjects` call. */
const DELETE_BATCH = 1000;

function required(name: StoreVariable): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. The backups bucket takes its own token — see docs/runbook-restore.md.`,
    );
  }
  return value;
}

/**
 * The **separate** backups bucket, with credentials of its own — deliberately
 * not the `S3_*` uploads bucket, so the token the API holds can neither read
 * nor delete a backup.
 */
export function backupStoreFromEnv(): BackupStore {
  const bucket = required('BACKUP_S3_BUCKET');
  const client = new S3Client({
    endpoint: required('BACKUP_S3_ENDPOINT'),
    region: 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: required('BACKUP_S3_ACCESS_KEY_ID'),
      secretAccessKey: required('BACKUP_S3_SECRET_ACCESS_KEY'),
    },
  });

  return {
    put: async (key, body, contentType) => {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    get: async (key) => {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) {
        throw new Error(`The backups bucket returned no body for ${key}.`);
      }
      return response.Body.transformToByteArray();
    },
    list: async (prefix) => {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        for (const object of page.Contents ?? []) {
          if (object.Key) keys.push(object.Key);
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    remove: async (keys) => {
      for (let start = 0; start < keys.length; start += DELETE_BATCH) {
        const batch = keys.slice(start, start + DELETE_BATCH);
        const result = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })) },
          }),
        );
        const failed = result.Errors?.[0];
        if (failed) {
          throw new Error(
            `Could not prune ${failed.Key ?? 'a backup'}: ${failed.Code ?? 'unknown'}.`,
          );
        }
      }
    },
  };
}
