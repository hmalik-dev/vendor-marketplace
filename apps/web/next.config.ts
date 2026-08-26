import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';
import { assertWebEnv } from './src/config/env';

// Next.js only reads `.env` files beside the app, but the file developers edit
// is the one at the repository root — the same one `apps/api` loads explicitly.
// `dotenv` never overwrites a real process variable, so a value supplied by the
// deployment platform still wins.
loadDotenv({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

// Fail the build here rather than shipping a bundle with an undefined Clerk key
// baked in. `process.env` is complete at config time; after the build only the
// inlined NEXT_PUBLIC_* values remain, so this is the last place to check.
assertWebEnv();

const nextConfig: NextConfig = {};

export default nextConfig;
