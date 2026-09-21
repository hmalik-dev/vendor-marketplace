import { describe, expect, it } from 'vitest';
import { mirroredAuthName } from './users.service.js';

describe('mirroredAuthName (VEN-544)', () => {
  it('drops what free text refuses, so the mirror never writes what a response reader rejects', () => {
    expect(mirroredAuthName('  Jo​hn\u0000 ﻿Smith ')).toBe('John Smith');
  });

  it('normalises to NFC and leaves a joiner inside a name alone', () => {
    expect(mirroredAuthName('Renée')).toBe('Renée'.normalize('NFC'));
    expect(mirroredAuthName('Zar‌in')).toBe('Zar‌in');
  });
});
