import { describe, expect, test } from 'bun:test';
import { computeSlots, zonedWallTimeToUtc } from '../../src/core/slots';

const iso = (ds: Date[]) => ds.map((d) => d.toISOString());
const NBO = 'Africa/Nairobi'; // UTC+3, no DST
const longAgo = new Date('2020-01-01T00:00:00Z');
// 2026-12-01 is a Tuesday (weekday 2)
const tue = (start: string, end: string) => ({ weekday: 2, start, end });

describe('wall time to UTC', () => {
  test('Nairobi is UTC+3', () => {
    expect(zonedWallTimeToUtc('2026-12-01', '09:00', NBO).toISOString()).toBe('2026-12-01T06:00:00.000Z');
  });
  test('London switches to BST on 2026-03-29', () => {
    expect(zonedWallTimeToUtc('2026-03-28', '09:00', 'Europe/London').toISOString()).toBe('2026-03-28T09:00:00.000Z');
    expect(zonedWallTimeToUtc('2026-03-29', '09:00', 'Europe/London').toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });
});

describe('computeSlots', () => {
  test('walks the window in 15-minute steps and keeps starts that fit', () => {
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '10:00')], busy: [], durationMin: 30, now: longAgo });
    expect(iso(s)).toEqual(['2026-12-01T06:00:00.000Z', '2026-12-01T06:15:00.000Z', '2026-12-01T06:30:00.000Z']);
  });
  test('rules for other weekdays are ignored', () => {
    expect(computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [{ weekday: 3, start: '09:00', end: '17:00' }], busy: [], durationMin: 30, now: longAgo })).toEqual([]);
  });
  test('a busy interval blocks overlapping starts; touching edges are fine', () => {
    const busy = [{ start: new Date('2026-12-01T06:30:00Z'), end: new Date('2026-12-01T07:00:00Z') }]; // 09:30-10:00 local
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '11:00')], busy, durationMin: 30, now: longAgo });
    expect(iso(s)).toEqual(['2026-12-01T06:00:00.000Z', '2026-12-01T07:00:00.000Z', '2026-12-01T07:15:00.000Z', '2026-12-01T07:30:00.000Z']);
  });
  test('buffer extends the blocked span after a slot', () => {
    const busy = [{ start: new Date('2026-12-01T06:45:00Z'), end: new Date('2026-12-01T07:00:00Z') }];
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '10:00')], busy, durationMin: 30, bufferMin: 15, now: longAgo });
    // 09:00 + 30 min + 15 min buffer ends at 09:45, touching the busy start: allowed. 09:15 and 09:30 overlap.
    expect(iso(s)).toEqual(['2026-12-01T06:00:00.000Z']);
  });
  test('lead time removes starts too soon', () => {
    const now = new Date('2026-12-01T05:50:00Z'); // 08:50 local; lead 60 -> earliest 09:50
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '11:00')], busy: [], durationMin: 60, now });
    expect(iso(s)).toEqual(['2026-12-01T07:00:00.000Z']);
  });
  test('split shifts give slots in both windows', () => {
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '09:30'), tue('14:00', '14:30')], busy: [], durationMin: 30, now: longAgo });
    expect(iso(s)).toEqual(['2026-12-01T06:00:00.000Z', '2026-12-01T11:00:00.000Z']);
  });
  test('slots across the London DST change use the right offset', () => {
    // 2026-03-29 is a Sunday (weekday 0)
    const s = computeSlots({ date: '2026-03-29', timeZone: 'Europe/London', rules: [{ weekday: 0, start: '09:00', end: '09:30' }], busy: [], durationMin: 30, now: longAgo });
    expect(iso(s)).toEqual(['2026-03-29T08:00:00.000Z']);
  });
  test('results are sorted and unique when windows overlap', () => {
    const s = computeSlots({ date: '2026-12-01', timeZone: NBO, rules: [tue('09:00', '09:45'), tue('09:15', '10:00')], busy: [], durationMin: 30, now: longAgo });
    expect(iso(s)).toEqual(['2026-12-01T06:00:00.000Z', '2026-12-01T06:15:00.000Z', '2026-12-01T06:30:00.000Z']);
  });
});
