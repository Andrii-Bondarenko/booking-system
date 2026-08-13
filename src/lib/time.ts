/**
 * Small time helpers. We store times as ISO 8601 UTC strings (e.g.
 * "2026-09-01T14:00:00.000Z"). A useful property: two ISO-8601 UTC
 * strings compare correctly with plain `<`/`>` because their
 * lexicographic order matches their chronological order.
 */

/** True if the string parses as a valid date. */
export function isValidIso(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

/** True if the timestamp is a valid date in the future. */
export function isFutureIso(iso: string): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t > Date.now();
}

/** Current time as an ISO string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Do two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap?
 * They overlap iff each starts before the other ends. Touching edges
 * (one ends exactly when the other starts) do NOT overlap.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}
