import type { UsStateCode } from '../constants/index.js';

/**
 * The IANA zone most of each state keeps. Twelve states straddle a boundary;
 * `MINORITY_ZONE_CITIES` names the places that keep the other one.
 */
const STATE_TIME_ZONES: Record<UsStateCode, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  DC: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  MT: 'America/Denver',
  NE: 'America/Chicago',
  NV: 'America/Los_Angeles',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NY: 'America/New_York',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WA: 'America/Los_Angeles',
  WV: 'America/New_York',
  WI: 'America/Chicago',
  WY: 'America/Denver',
};

/**
 * Cities in a split state that keep the state's *other* zone, keyed
 * `STATE:lowercased name`. The larger places on the far side of each line —
 * not exhaustive, because `us_cities` carries no coordinates to derive it from.
 * A place missing here falls back to its state's zone, which is wrong by an
 * hour at most.
 */
const MINORITY_ZONE_CITIES: Readonly<Record<string, string>> = {
  'FL:pensacola': 'America/Chicago',
  'FL:panama city': 'America/Chicago',
  'FL:panama city beach': 'America/Chicago',
  'FL:destin': 'America/Chicago',
  'FL:fort walton beach': 'America/Chicago',
  'FL:crestview': 'America/Chicago',
  'FL:navarre': 'America/Chicago',
  'ID:coeur d alene': 'America/Los_Angeles',
  'ID:post falls': 'America/Los_Angeles',
  'ID:moscow': 'America/Los_Angeles',
  'ID:lewiston': 'America/Los_Angeles',
  'ID:sandpoint': 'America/Los_Angeles',
  'IN:gary': 'America/Chicago',
  'IN:hammond': 'America/Chicago',
  'IN:merrillville': 'America/Chicago',
  'IN:valparaiso': 'America/Chicago',
  'IN:crown point': 'America/Chicago',
  'IN:michigan city': 'America/Chicago',
  'IN:evansville': 'America/Chicago',
  'KS:goodland': 'America/Denver',
  'KY:bowling green': 'America/Chicago',
  'KY:owensboro': 'America/Chicago',
  'KY:paducah': 'America/Chicago',
  'KY:hopkinsville': 'America/Chicago',
  'KY:murray': 'America/Chicago',
  'MI:menominee': 'America/Menominee',
  'MI:iron mountain': 'America/Menominee',
  'NE:scottsbluff': 'America/Denver',
  'NE:alliance': 'America/Denver',
  'NE:sidney': 'America/Denver',
  'ND:dickinson': 'America/Denver',
  'OR:ontario': 'America/Boise',
  'SD:rapid city': 'America/Denver',
  'SD:spearfish': 'America/Denver',
  'SD:sturgis': 'America/Denver',
  'TN:knoxville': 'America/New_York',
  'TN:chattanooga': 'America/New_York',
  'TN:johnson city': 'America/New_York',
  'TN:kingsport': 'America/New_York',
  'TN:bristol': 'America/New_York',
  'TN:cleveland': 'America/New_York',
  'TN:maryville': 'America/New_York',
  'TN:oak ridge': 'America/New_York',
  'TN:morristown': 'America/New_York',
  'TX:el paso': 'America/Denver',
  'TX:socorro': 'America/Denver',
  'TX:horizon city': 'America/Denver',
};

function isUsStateCode(state: string): state is UsStateCode {
  return Object.hasOwn(STATE_TIME_ZONES, state);
}

/** `Coeur d'Alene` and `Coeur d Alene` are one key; so are the spacings of a name. */
function cityKey(state: UsStateCode, city: string): string {
  const name = city
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();

  return `${state}:${name}`;
}

/**
 * The IANA zone an event with this vendor happens in, from the vendor's city
 * and state (VEN-647). `null` when the vendor has no state on file — a legacy
 * or incomplete profile — because a guessed zone would be a fact nobody stated.
 *
 * Recorded on the request and the booking; it does **not** move the refund
 * cutoff, which stays midnight UTC on the event date until the account holder
 * rules otherwise (VEN-615).
 */
export function eventTimeZoneFor(city: string | null, state: string | null): string | null {
  if (state === null || !isUsStateCode(state)) {
    return null;
  }

  return (city && MINORITY_ZONE_CITIES[cityKey(state, city)]) || STATE_TIME_ZONES[state];
}
