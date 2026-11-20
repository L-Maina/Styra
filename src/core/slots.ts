export interface AvailabilityRule {
  /** 0 = Sunday */
  weekday: number;
  /** "HH:MM" local wall time */
  start: string;
  end: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotQuery {
  /** "YYYY-MM-DD" in the business time zone */
  date: string;
  timeZone: string;
  rules: AvailabilityRule[];
  busy: Interval[];
  durationMin: number;
  bufferMin?: number;
  stepMin?: number;
  now: Date;
  leadMin?: number;
}

const MIN = 60_000;

/** Offset of `timeZone` from UTC at instant `at`, in minutes (e.g. +180 for Nairobi). */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / MIN);
}

/** Converts a local wall time in `timeZone` to the UTC instant, using only Intl (no dependency). */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset around DST changes.
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * MIN;
  guess = naive - offsetMinutes(new Date(guess), timeZone) * MIN;
  return new Date(guess);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const overlaps = (aStart: number, aEnd: number, b: Interval) => aStart < b.end.getTime() && b.start.getTime() < aEnd;

/** Bookable start instants (UTC) for one local date (blueprint Appendix F). */
export function computeSlots(q: SlotQuery): Date[] {
  const step = (q.stepMin ?? 15) * MIN;
  const duration = q.durationMin * MIN;
  const buffer = (q.bufferMin ?? 0) * MIN;
  const earliest = q.now.getTime() + (q.leadMin ?? 60) * MIN;
  const weekday = weekdayOf(q.date);
  const out = new Set<number>();
  for (const rule of q.rules) {
    if (rule.weekday !== weekday) continue;
    const winStart = zonedWallTimeToUtc(q.date, rule.start, q.timeZone).getTime();
    const winEnd = zonedWallTimeToUtc(q.date, rule.end, q.timeZone).getTime();
    for (let s = winStart; s + duration <= winEnd; s += step) {
      if (s < earliest) continue;
      if (q.busy.some((b) => overlaps(s, s + duration + buffer, b))) continue;
      out.add(s);
    }
  }
  return [...out].sort((a, b) => a - b).map((t) => new Date(t));
}
