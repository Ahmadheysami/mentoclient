/**
 * Persian (Jalali) formatting helpers.
 *
 * The timezone is pinned to Tehran so the server and the client always render
 * the same calendar day and there is no hydration mismatch.
 */

const TIME_ZONE = "Asia/Tehran";

const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: TIME_ZONE,
});

const faNumberFormatter = new Intl.NumberFormat("fa-IR");

/** «۱۲ آبان ۱۴۰۴» */
export function faDate(value: string | number | Date | undefined | null): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : faDateFormatter.format(date);
}

/** «۳» — Persian digits, so counts sit naturally next to Persian dates. */
export function faNumber(value: number): string {
  return faNumberFormatter.format(value);
}
