import Link from 'next/link';

/**
 * Frame `13`'s `Export CSV`: the ghost link right-anchored in the Refine bar,
 * and the one every console list that draws it shares (VEN-388).
 *
 * `prefetch={false}` because the target is a route handler that walks every
 * page of the filtered set — prefetching it would run the export on hover.
 */
export function ExportCsvLink({ href }: { href: string }): React.ReactElement {
  return (
    <Link
      href={href}
      prefetch={false}
      className="text-sm font-semibold whitespace-nowrap text-clay-500 hover:underline"
    >
      Export CSV
    </Link>
  );
}
