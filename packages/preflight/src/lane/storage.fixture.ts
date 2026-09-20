import { LANE_STORAGE_KEYS, type LaneStorageEnv } from './storage.js';

const ENDPOINT = 'https://br-fixture.storage.c-4.us-east-2.aws.neon.tech';

const VALUES: Readonly<Record<(typeof LANE_STORAGE_KEYS)[number], string>> = Object.fromEntries(
  LANE_STORAGE_KEYS.map((key) => [key, `${key.toLowerCase()}-fixture`]),
) as LaneStorageEnv;

/** A lane's storage rows as `ensureLaneStorage` returns them, with fixture values only. */
export const laneStorageFixture: LaneStorageEnv = {
  ...VALUES,
  STORAGE_ENDPOINT: ENDPOINT,
  STORAGE_PUBLIC_URL: `${ENDPOINT}/uploads`,
  NEXT_PUBLIC_STORAGE_PUBLIC_URL: `${ENDPOINT}/uploads`,
  STORAGE_BUCKET: 'uploads',
  STORAGE_REGION: 'us-east-2',
};
