import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A form that validates itself must stop the browser validating it first.
 *
 * This is #388, as a rule rather than as two repaired files. The storefront
 * editor and the package editor both wired up the three-tier validation model
 * correctly — the summary, the per-field messages, `aria-invalid`, the counted
 * headline — and then left `required` on their inputs with no `noValidate` on
 * the form. The browser's own constraint validation runs first and **cancels
 * the submit event**, so React's `onSubmit` never fires: no summary, no
 * `aria-invalid`, no message, no POST. The button reads as broken, and the only
 * signal is a focus move that says nothing to a screen reader.
 *
 * The trap is that it is invisible from every angle that usually catches
 * things. The validation code is present and correct, so review passes. The
 * markup is valid, so lint passes. And jsdom implements the cancellation
 * faithfully, so a unit test that fires a submit on a *partly filled* form
 * exercises the real path while the pristine case — the one every new vendor
 * hits — is never tested.
 *
 * `search-bar.tsx` already knew this and said so in a comment. Knowing it in
 * one file is what let it recur in three others.
 *
 * The rule: a `<form>` with its own `onSubmit` owns validation, so it carries
 * `noValidate`. A form with no `onSubmit` — a plain `method="get"` filter that
 * navigates — is left alone; the platform is genuinely doing the work there.
 */
const COMPONENTS_DIR = path.dirname(fileURLToPath(import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(full)));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      found.push(full);
    }
  }

  return found;
}

/**
 * The attribute list of every `<form …>` in a file.
 *
 * Reads to the closing `>` of the opening tag rather than matching attributes
 * across the whole file, so two forms in one component are judged separately —
 * which is the case that a file-scoped grep would get wrong in the direction
 * that matters, by letting one form's `noValidate` excuse another's absence.
 *
 * The scan is brace-aware rather than `[^>]*`, because `=>` contains a `>`:
 * with a regex, `<form onKeyDown={(event) => …} onSubmit={save}>` ends at the
 * arrow, and the form is skipped entirely — the guard would go blind on a
 * prop reorder. Depth counting stops only at the `>` that closes the tag.
 */
function formOpeningTags(code: string): string[] {
  const tags: string[] = [];

  for (const match of code.matchAll(/<form\b/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;

    for (let index = start; index < code.length; index += 1) {
      const character = code[index];

      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
      else if (character === '>' && depth === 0) {
        tags.push(code.slice(start, index));
        break;
      }
    }
  }

  return tags;
}

describe('forms that validate themselves', () => {
  it('finds the forms it is meant to be guarding', async () => {
    const files = await sourceFiles(COMPONENTS_DIR);
    const withForms = [];

    for (const file of files) {
      if (formOpeningTags(await readFile(file, 'utf8')).length > 0) {
        withForms.push(file);
      }
    }

    // Guards the guard: a scan that matched nothing would pass forever while
    // the rule it encodes went unenforced.
    expect(withForms.length).toBeGreaterThanOrEqual(6);
  });

  /*
   * The scanner itself, on the shape that broke the first version: `=>` in a
   * prop before `onSubmit`. A regex bounded by `[^>]*` stops at the arrow and
   * reports no attributes at all, so the form silently leaves the guard.
   */
  it('reads a whole opening tag even when a prop contains an arrow function', () => {
    const [attributes] = formOpeningTags(
      '<form onKeyDown={(event) => handle(event)} onSubmit={save} noValidate>',
    );

    expect(attributes).toContain('onSubmit');
    expect(attributes).toContain('noValidate');
  });

  it('never leaves native validation able to cancel a custom submit', async () => {
    const files = await sourceFiles(COMPONENTS_DIR);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      // Prose explaining the trap is not an instance of it.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

      for (const attributes of formOpeningTags(code)) {
        if (/\bonSubmit\b/.test(attributes) && !/\bnoValidate\b/.test(attributes)) {
          offenders.push(path.relative(COMPONENTS_DIR, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
