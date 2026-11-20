/**
 * Display formats from design-language.md section 11. All times are shown in Nairobi time (EAT).
 * Money formatting lives in ./money (formatMoney).
 */
export const DISPLAY_TIME_ZONE = 'Africa/Nairobi';

function parts(d: Date, tz: string, opts: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "2:30 pm" */
export function formatTime(d: Date, tz = DISPLAY_TIME_ZONE): string {
  const p = parts(d, tz, { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });
  return `${Number(p.hour)}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`.trim();
}

/** "Sat 22 Nov", or "Sat 2 Jan 2027" outside the current year. */
export function formatDate(d: Date, now = new Date(), tz = DISPLAY_TIME_ZONE): string {
  const p = parts(d, tz, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const thisYear = parts(now, tz, { year: 'numeric' }).year;
  return `${p.weekday} ${p.day} ${p.month}${p.year !== thisYear ? ` ${p.year}` : ''}`;
}

/** "Sat 22 Nov, 2:30 pm" */
export function formatDateTime(d: Date, now = new Date(), tz = DISPLAY_TIME_ZONE): string {
  return `${formatDate(d, now, tz)}, ${formatTime(d, tz)}`;
}

/** "in 2 hours" / "45 minutes ago" inside 24 hours; otherwise the date and time. */
export function formatRelative(d: Date, now = new Date(), tz = DISPLAY_TIME_ZONE): string {
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs >= 24 * 3600_000) return formatDateTime(d, now, tz);
  const minutes = Math.round(abs / 60_000);
  const [n, unit] = minutes < 60 ? [minutes, 'minute'] : [Math.round(minutes / 60), 'hour'];
  const phrase = `${n} ${unit}${n === 1 ? '' : 's'}`;
  return diff >= 0 ? `in ${phrase}` : `${phrase} ago`;
}

/** "45 min", "1 h", "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Normalises a Kenyan mobile number to E.164 (+2547XXXXXXXX or +2541XXXXXXXX); null if it is not one. */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const m = /^(?:\+?254|0)?([71]\d{8})$/.exec(digits);
  return m ? `+254${m[1]}` : null;
}

/** "0712 345 678" */
export function formatPhone(input: string): string {
  const e164 = toE164(input);
  if (!e164) return input;
  const local = `0${e164.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** "4.8 (120)", or "New" with no reviews. */
export function formatRating(avg: number, count: number): string {
  return count ? `${avg.toFixed(1)} (${count})` : 'New';
}
