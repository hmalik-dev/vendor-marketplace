import { createHash } from 'node:crypto';
import { Decrypter, Encrypter } from 'age-encryption';

/**
 * `age` in-process rather than the CLI, so the workflow and the drill share one
 * implementation and the wrong-key refusal is a unit test. The format is the
 * standard one: `age -d -i key.txt` decrypts these objects too.
 */
export async function encryptBackup(
  plaintext: Uint8Array,
  recipients: readonly string[],
): Promise<Uint8Array> {
  const encrypter = new Encrypter();
  for (const recipient of recipients) {
    encrypter.addRecipient(recipient);
  }
  return encrypter.encrypt(plaintext);
}

export async function decryptBackup(ciphertext: Uint8Array, identity: string): Promise<Uint8Array> {
  const decrypter = new Decrypter();
  decrypter.addIdentity(identity.trim());
  try {
    return await decrypter.decrypt(ciphertext);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`The backup could not be decrypted with BACKUP_AGE_IDENTITY: ${reason}`, {
      cause: error,
    });
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** One `age1…` public key per line; `#` comments and blank lines are ignored. */
export function parseRecipients(text: string): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (lines.some((line) => line.startsWith('AGE-SECRET-KEY-'))) {
    throw new Error(
      'The recipients file holds an age secret key. Only the public key belongs in the repository — rotate that key.',
    );
  }
  if (lines.length === 0) {
    throw new Error(
      'The recipients file lists no age recipient. See docs/runbook-restore.md to generate one.',
    );
  }
  return lines;
}
