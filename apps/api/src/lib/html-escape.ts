/**
 * The five characters that turn an interpolated value into markup.
 *
 * Every email body this API renders interpolates user input — a vendor's
 * business name, a customer's note, and now a visitor's support message — and
 * an unescaped `<` in any of them is markup in somebody's inbox.
 *
 * A module of its own rather than a copy in each template: two templates now
 * need it, and `31-content-voice.md` requires a business name to render exactly
 * as entered, which means the escaping has to be identical wherever it happens
 * or the same name renders two ways.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
