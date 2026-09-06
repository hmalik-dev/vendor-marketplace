/**
 * Rebuilds `src/us-cities-data.ts` from its two public upstream sources.
 *
 * **Run by hand, never by the build.** It reaches the network and takes ~90
 * seconds, and the places of the United States change about once a decade —
 * so the dataset is committed and this script exists to say exactly how it was
 * produced and to make refreshing it a command rather than an archaeology
 * project. `pnpm --filter @vendor-marketplace/db cities:build`.
 *
 * ## The sources, and why both
 *
 * 1. **US Census Bureau 2024 Gazetteer Places file** — every legally defined
 *    place in the country, incorporated and census-designated alike. Public
 *    domain, as a work of the US government. It is the authority on *what
 *    places exist*, which is the half a marketplace cannot get wrong: a
 *    customer whose town is missing has no way to ask the question.
 * 2. **GeoNames** (`https://download.geonames.org/export/dump/US.zip`) —
 *    populated places with **population**, licensed CC BY 4.0. It supplies the
 *    ranking key the Gazetteer has no column for, and the names people
 *    actually type: the Gazetteer calls Honolulu *"Urban Honolulu CDP"*.
 *
 * Neither alone is enough. The Census population series (`sub-est`) covers
 * incorporated places only, so on Census data alone `Arlington, VA` and
 * `Paradise, NV` — both census-designated places, both larger than most of the
 * cities they would be ranked under — sort to the bottom of their own name.
 * GeoNames alone drops ~4,400 real Census places whose population it does not
 * carry. The union is 1.13x the size of either and wrong in neither way.
 *
 * ## Attribution
 *
 * GeoNames data is used under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * The credit is carried in the header this script writes into the dataset, so
 * it ships with the data rather than in a file someone has to go and find.
 */
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { US_STATE_CODES, normaliseForMatch } from '@vendor-marketplace/shared';

const run = promisify(execFile);

const GAZETTEER_URL =
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip';
const GEONAMES_URL = 'https://download.geonames.org/export/dump/US.zip';

const STATES = new Set<string>(US_STATE_CODES);

/**
 * The legal or statistical class the Gazetteer appends to every name —
 * `Abbeville city`, `Abanda CDP`, `Sitka city and borough`. It is a
 * classification, not part of what anyone calls the place, so it comes off.
 *
 * The `+` matters: several stack, so `Athens-Clarke County unified government
 * (balance)` has to shed `government` and then `balance` in one pass.
 */
const PLACE_CLASS_SUFFIX =
  /(?:\s+(?:city|town|village|borough|municipality|CDP|comunidad|zona urbana|consolidated government|metro government|metropolitan government|unified government|corporation|plantation|charter township|township|city and borough|and borough|balance))+$/i;

function stripPlaceClass(raw: string): string {
  return raw
    .replace(/\s*\((?:balance|part)\)\s*$/i, '')
    .replace(PLACE_CLASS_SUFFIX, '')
    .trim();
}

interface Place {
  name: string;
  state: string;
  population: number;
}

async function download(url: string, into: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`${url} answered ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(into));
}

/** `unzip` rather than a dependency: this script is not part of any build. */
async function unzipInto(archive: string, directory: string): Promise<void> {
  await run('unzip', ['-o', '-q', archive, '-d', directory]);
}

function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim() !== '');
}

/** Later wins only when it is bigger — the union keeps the best population. */
function merge(into: Map<string, Place>, place: Place): void {
  const key = `${normaliseForMatch(place.name)}|${place.state}`;
  const held = into.get(key);
  if (held === undefined || place.population > held.population) {
    into.set(key, place);
  }
}

async function readGeoNames(directory: string): Promise<Map<string, Place>> {
  const raw = await readFile(join(directory, 'US.txt'), 'utf8');
  const places = new Map<string, Place>();

  for (const line of splitLines(raw)) {
    const columns = line.split('\t');
    // 6: feature class (`P` is a populated place), 10: state, 14: population.
    if (columns[6] !== 'P') {
      continue;
    }
    const state = columns[10] ?? '';
    const name = columns[1] ?? '';
    const population = Number.parseInt(columns[14] ?? '0', 10) || 0;
    // Population 0 in GeoNames means "unknown", and admits a long tail of
    // hamlets and subdivisions. The Census file below is the authority on
    // whether an unpopulated name is a real place.
    if (!STATES.has(state) || name === '' || population <= 0) {
      continue;
    }
    merge(places, { name, state, population });
  }

  return places;
}

async function readGazetteer(directory: string): Promise<Place[]> {
  const raw = await readFile(join(directory, '2024_Gaz_place_national.txt'), 'latin1');
  const lines = splitLines(raw);
  const header = (lines.shift() ?? '').split('\t').map((column) => column.trim());
  const stateAt = header.indexOf('USPS');
  const nameAt = header.indexOf('NAME');
  if (stateAt < 0 || nameAt < 0) {
    throw new Error('Gazetteer header no longer carries USPS and NAME');
  }

  const places: Place[] = [];
  for (const line of lines) {
    const columns = line.split('\t');
    const state = (columns[stateAt] ?? '').trim();
    const name = stripPlaceClass((columns[nameAt] ?? '').trim());
    if (!STATES.has(state) || name === '') {
      continue;
    }
    places.push({ name, state, population: 0 });
  }

  return places;
}

function render(places: readonly Place[]): string {
  const rows = [...places].sort(
    (left, right) => left.state.localeCompare(right.state) || left.name.localeCompare(right.name),
  );

  const body = rows
    .map((place) => `${place.name}\t${place.state}\t${place.population}`)
    .join('\n')
    // A backslash or a backtick in a place name would end the template literal.
    // None exists today; a silent syntax error the day one does is not a risk
    // worth leaving open.
    .replace(/[\\`]/g, (character) => `\\${character}`)
    .replace(/\$\{/g, '\\${');

  return `/**
 * Every US place the \`City\` typeahead may suggest, one per line as
 * \`name<TAB>state<TAB>population\`.
 *
 * **Generated — do not edit by hand.** Rebuild with
 * \`pnpm --filter @vendor-marketplace/db cities:build\`, whose header explains
 * both sources and why it takes two of them. Committed rather than fetched
 * because the places of the United States change about once a decade and a
 * seed that needs the network is a seed that fails in CI.
 *
 * A tab-separated blob rather than ${rows.length.toLocaleString('en-US')} object
 * literals: it parses as one string, which is roughly a tenth of the work, and
 * it diffs a line per place when the decade turns.
 *
 * Sources:
 * - US Census Bureau, 2024 Gazetteer Places file — public domain.
 * - GeoNames (https://www.geonames.org), used under CC BY 4.0
 *   (https://creativecommons.org/licenses/by/4.0/), for population.
 *
 * \`population\` is a **ranking key only**. It never leaves the API — see
 * \`placeSuggestionSchema\` — because #384's instruction was that the field must
 * not indicate how many of anything is in a city.
 */
export const US_CITY_TSV = \`${body}\`;
`;
}

async function main(): Promise<void> {
  const workspace = await mkdtemp(join(tmpdir(), 'us-cities-'));

  try {
    const gazetteerZip = join(workspace, 'gazetteer.zip');
    const geoNamesZip = join(workspace, 'geonames.zip');
    await Promise.all([download(GAZETTEER_URL, gazetteerZip), download(GEONAMES_URL, geoNamesZip)]);
    await unzipInto(gazetteerZip, workspace);
    await unzipInto(geoNamesZip, workspace);

    const places = await readGeoNames(workspace);
    const geoNamesCount = places.size;
    for (const place of await readGazetteer(workspace)) {
      merge(places, place);
    }

    const rendered = render([...places.values()]);
    const target = fileURLToPath(new URL('../us-cities-data.ts', import.meta.url));
    await writeFile(target, rendered, 'utf8');

    process.stdout.write(
      `${places.size} places (${geoNamesCount} from GeoNames, ${places.size - geoNamesCount} Census-only) -> ${target}\n`,
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

await main();
