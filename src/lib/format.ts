// Small helpers for text the screens show. No imports, so they work in server and client code.

/** The singular for a count of exactly 1, otherwise the plural: pluralNoun(1, 'service') is "service". */
export function pluralNoun(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** A count with its noun: pluralize(1, 'service') is "1 service", pluralize(2, 'business', 'businesses') is "2 businesses". */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralNoun(count, singular, plural)}`;
}

/** A rating with one decimal, so 4 reads "4.0". Anything that is not a number reads "0.0". */
export function formatRating(value: number | string | null | undefined): string {
  const rating = Number(value);
  return Number.isFinite(rating) ? rating.toFixed(1) : '0.0';
}
