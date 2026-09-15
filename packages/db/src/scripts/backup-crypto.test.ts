import { generateX25519Identity, identityToRecipient } from 'age-encryption';
import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, parseRecipients, sha256Hex } from './backup-crypto.js';

/*
 * Keys are minted per run rather than committed: a committed secret key, even a
 * test one, is exactly what the secret scan exists to stop.
 */
describe('backup encryption', () => {
  const plaintext = new TextEncoder().encode('PGDMP custom-format bytes');

  it('round-trips through the matching identity', async () => {
    const identity = await generateX25519Identity();
    const ciphertext = await encryptBackup(plaintext, [await identityToRecipient(identity)]);

    expect(Buffer.from(ciphertext).includes(Buffer.from('PGDMP'))).toBe(false);
    expect(await decryptBackup(ciphertext, identity)).toEqual(plaintext);
  });

  it('refuses to decrypt with any other key', async () => {
    const ciphertext = await encryptBackup(plaintext, [
      await identityToRecipient(await generateX25519Identity()),
    ]);

    await expect(decryptBackup(ciphertext, await generateX25519Identity())).rejects.toThrow(
      "The backup could not be decrypted with BACKUP_AGE_IDENTITY: no identity matched any of the file's recipients",
    );
  });

  it('digests bytes as lowercase hex', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('parseRecipients', () => {
  it('reads one recipient per line, skipping comments and blanks', () => {
    const text = '# operator laptop\n\nage1abc\n  age1def  \n';

    expect(parseRecipients(text)).toEqual(['age1abc', 'age1def']);
  });

  it('refuses a file with no recipient, so a backup is never stored unencrypted', () => {
    expect(() => parseRecipients('# generate one with age-keygen\n')).toThrow(/no age recipient/);
  });

  it('refuses a secret key pasted where the public key belongs', () => {
    expect(() => parseRecipients('AGE-SECRET-KEY-1QQQ\n')).toThrow(/secret key/);
  });
});
