import Link from 'next/link';
import type { LegalBlock, LegalSpan } from '@/lib/legal-markdown';

/**
 * The three content blocks a legal page may contain, and no more — frame `31`.
 *
 * Three is the whole list on purpose: an emphasis panel for a clause with
 * commercial consequence, a data table where the content is genuinely tabular,
 * and one sage note for a reassurance that is a statement of fact. A fourth
 * would be a fourth thing to keep in parity across three pages nobody reads
 * twice.
 */

/** The prose scale, used on these pages and nowhere else in the product. */
export const LEGAL_PROSE = 'text-md leading-legal text-stone-800 text-pretty';

function Spans({ spans }: { spans: LegalSpan[] }): React.ReactElement {
  return (
    <>
      {spans.map((span, index) => {
        const key = `${index}-${span.text}`;

        if (span.href) {
          return (
            <Link
              key={key}
              href={span.href}
              className="text-clay-500 underline-offset-4 hover:underline"
            >
              {span.text}
            </Link>
          );
        }
        if (span.bold) {
          return (
            <strong key={key} className="font-semibold">
              {span.text}
            </strong>
          );
        }
        if (span.code) {
          return (
            <code key={key} className="font-mono text-sm">
              {span.text}
            </code>
          );
        }

        return <span key={key}>{span.text}</span>;
      })}
    </>
  );
}

/**
 * The data table.
 *
 * The admin `DataTable`'s **idiom** rather than the component: hairline border,
 * `rounded-panel`, a `stone-150` header row of micro-labels, 13px body rows on
 * a `stone-200` separator, first column at 600. The component itself carries a
 * contract this content does not have — declared grid tracks, a card list below
 * 768, a per-row `cell` callback — and bending five static rows through it
 * would be more code, not less.
 */
function LegalTable({
  header,
  rows,
}: {
  header: string[];
  rows: LegalSpan[][][];
}): React.ReactElement {
  const template = { gridTemplateColumns: `repeat(${header.length}, minmax(0, 1fr))` };

  return (
    <div className="my-6.5 overflow-x-auto">
      <div className="min-w-[560px] overflow-hidden rounded-panel border border-stone-300">
        <div
          style={template}
          className="grid border-b border-stone-300 bg-stone-150 text-label font-semibold tracking-label text-stone-600 uppercase"
        >
          {header.map((cell) => (
            <span key={cell} className="px-3.5 py-2.5">
              {cell}
            </span>
          ))}
        </div>
        {rows.map((row, index) => (
          <div
            key={row.map((cell) => cell.map((span) => span.text).join('')).join('|')}
            style={template}
            className={`grid text-action leading-prose text-stone-800 ${
              index === rows.length - 1 ? '' : 'border-b border-stone-200'
            }`}
          >
            {row.map((cell, column) => (
              <span
                key={`${column}-${cell.map((span) => span.text).join('')}`}
                className={
                  column === 0 ? 'px-3.5 py-3 font-semibold' : 'px-3.5 py-3 text-stone-700'
                }
              >
                <Spans spans={cell} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The shield-check glyph the sage note carries. Frame `31`, `/privacy`. */
function ShieldCheck(): React.ReactElement {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.75 flex-none text-sage-600"
    >
      <path d="M12 3l7 2.6v5.6c0 4.4-2.9 7.6-7 9.2-4.1-1.6-7-4.8-7-9.2V5.6z" />
      <path d="M8.8 12l2.3 2.3 4.1-4.4" strokeLinecap="round" />
    </svg>
  );
}

export function LegalBlocks({ blocks }: { blocks: LegalBlock[] }): React.ReactElement {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'paragraph') {
          return (
            <p key={index} className={`${LEGAL_PROSE} mb-4`}>
              <Spans spans={block.spans} />
            </p>
          );
        }

        if (block.kind === 'table') {
          return <LegalTable key={index} header={block.header} rows={block.rows} />;
        }

        if (block.kind === 'panel') {
          return (
            <div key={index} className="my-6.5 rounded-panel bg-stone-150 px-4.75 py-4.25">
              {block.paragraphs.map((paragraph, at) => (
                <p
                  key={at}
                  className="text-[14.5px] leading-[1.75] text-stone-800 not-first:mt-3 text-pretty"
                >
                  <Spans spans={paragraph} />
                </p>
              ))}
            </div>
          );
        }

        return (
          <div
            key={index}
            className="my-6.5 flex items-start gap-2.75 rounded-panel bg-sage-50 px-4.25 py-3.75"
          >
            <ShieldCheck />
            <div>
              {block.paragraphs.map((paragraph, at) => (
                <p key={at} className="text-base leading-[1.7] text-stone-800 not-first:mt-3">
                  <Spans spans={paragraph} />
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
