import type { Check } from '../types.js';
import { toolchainCheck } from './toolchain.js';
import { environmentCheck } from './environment.js';
import { databaseCheck } from './database.js';
import { storageCheck } from './storage.js';
import { webhookCheck } from './webhooks.js';
import { browserCheck } from './browser.js';
import { portsCheck } from './ports.js';

/** Every check, in the order the ticket's check table lists them. */
export const CHECKS: readonly Check[] = [
  toolchainCheck,
  environmentCheck,
  databaseCheck,
  storageCheck,
  webhookCheck,
  browserCheck,
  portsCheck,
];
