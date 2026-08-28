import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The display faces, as bytes, for `next/og`.
 *
 * Satori renders the share card in its own context with no access to the
 * page's `next/font` output, so a card that does not pass the faces in falls
 * back to a generic serif. The design contract treats font family as one of
 * the five parity axes, and "close" is not a pass — so the real faces are
 * committed beside this file and read from disk.
 *
 * `process.cwd()` is `apps/web` for both `next dev` and `next build`.
 */
const FONT_DIR = path.join(process.cwd(), 'src/app/_fonts');

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: 'normal' | 'italic';
}

async function read(file: string): Promise<ArrayBuffer> {
  const buffer = await readFile(path.join(FONT_DIR, file));

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

/** Both serif cuts plus the body face — everything the card sets. */
export async function shareCardFonts(): Promise<OgFont[]> {
  const [serif, serifItalic, sans] = await Promise.all([
    read('instrument-serif-regular.ttf'),
    read('instrument-serif-italic.ttf'),
    read('instrument-sans-regular.ttf'),
  ]);

  return [
    { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
    { name: 'Instrument Serif', data: serifItalic, weight: 400, style: 'italic' },
    { name: 'Instrument Sans', data: sans, weight: 400, style: 'normal' },
  ];
}
