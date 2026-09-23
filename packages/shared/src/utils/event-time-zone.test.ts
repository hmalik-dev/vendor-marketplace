import { describe, expect, it } from 'vitest';
import { US_STATE_CODES } from '../constants/index.js';
import { eventTimeZoneFor } from './event-time-zone.js';

describe('eventTimeZoneFor', () => {
  it('captures Pacific time for a Los Angeles vendor', () => {
    expect(eventTimeZoneFor('Los Angeles', 'CA')).toBe('America/Los_Angeles');
  });

  it('takes the minority zone for a city across a state line', () => {
    expect(eventTimeZoneFor('El Paso', 'TX')).toBe('America/Denver');
    expect(eventTimeZoneFor('Austin', 'TX')).toBe('America/Chicago');
    expect(eventTimeZoneFor("Coeur d'Alene", 'ID')).toBe('America/Los_Angeles');
    expect(eventTimeZoneFor('  KNOXVILLE ', 'TN')).toBe('America/New_York');
  });

  it("falls back to the state's zone for a city it does not list", () => {
    expect(eventTimeZoneFor('Somewhere New', 'FL')).toBe('America/New_York');
    expect(eventTimeZoneFor(null, 'HI')).toBe('Pacific/Honolulu');
  });

  it('records nothing for a vendor with no state, rather than a guess', () => {
    expect(eventTimeZoneFor('Austin', null)).toBeNull();
    expect(eventTimeZoneFor('Austin', 'Texas')).toBeNull();
  });

  it('names a zone the runtime knows for every state', () => {
    const unknown = US_STATE_CODES.filter((state) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: eventTimeZoneFor(null, state) ?? 'invalid' });
        return false;
      } catch {
        return true;
      }
    });

    expect(unknown).toEqual([]);
  });
});
