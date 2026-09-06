import { describe, expect, it } from 'vitest';
import { withoutComments } from './source-scan';

/**
 * The shared comment strip, which every source guard in this tree now reads
 * through.
 *
 * It has its own file because it had four hand-copied twins and no two agreed:
 * two preserved position and two guarded the URL case, none did both. Each
 * property below is one of those disagreements, settled — a guard reading this
 * helper is only as trustworthy as these four assertions.
 */
describe('withoutComments', () => {
  it('removes what a comment says, so prose about a pattern is not an instance of it', () => {
    expect(withoutComments('/* never write font-display here */')).not.toContain('font-display');
    expect(withoutComments('const a = 1; // text-[9px]')).not.toContain('text-[9px]');
    expect(withoutComments('const a = 1; // x')).toContain('const a = 1;');
  });

  it('leaves every line after a comment on the line it was on', () => {
    const source = ['const a = 1;', '/*', ' * two', ' * lines', ' */', 'const b = 2;'].join('\n');
    const lines = withoutComments(source).split('\n');

    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe('const b = 2;');
  });

  it('leaves every column after a comment where it was, so a reported column is real', () => {
    const stripped = withoutComments('const a = /* four */ 4;');

    expect(stripped).toHaveLength('const a = /* four */ 4;'.length);
    expect(stripped.indexOf('4;')).toBe('const a = /* four */ '.length);
  });

  /*
   * The case two of the four copies guarded and two did not. A `//` inside a
   * URL is not a comment, and treating it as one truncates the rest of the
   * line — so the guard reading that file silently stops seeing whatever came
   * after the string.
   */
  it('does not mistake the slashes in a URL for a line comment', () => {
    const source = "const help = 'https://example.com/docs'; const b = 'text-[9px]';";

    expect(withoutComments(source)).toBe(source);
  });

  /*
   * The harder half, and the one a `(^|[^:])//` guard gets wrong in the
   * opposite direction: `://*` in a CSP entry. The `:` stops the line-comment
   * rule, and then the second slash and the `*` open a **block** comment that
   * runs to the next `*​/` anywhere below — swallowing every line in between.
   * `security-headers.ts` lost 151 lines to exactly this.
   */
  it('does not let a wildcard URL open a block comment that eats the file', () => {
    const source = [
      "const csp = ['https://*.clerk.accounts.dev'];",
      'const between = 1;',
      '/* an ordinary block comment */',
      'const after = 2;',
    ].join('\n');
    const lines = withoutComments(source).split('\n');

    expect(lines[0]).toBe(source.split('\n')[0]);
    expect(lines[1]).toBe('const between = 1;');
    expect(lines[2]?.trim()).toBe('');
    expect(lines[3]).toBe('const after = 2;');
  });

  /*
   * The guard above must not have bought itself immunity by refusing to strip
   * comments that merely mention a URL. Both of these are comments and both go.
   */
  it('still strips a comment that contains a URL', () => {
    expect(withoutComments('const a = 1; // see https://example.com/docs')).toBe(
      'const a = 1;                                ',
    );
    expect(withoutComments('/* https://example.com */ const a = 1;')).toBe(
      '                          const a = 1;',
    );
  });
});
