/**
 * Persian (Jalali) formatting helpers.
 *
 * The timezone is pinned to Tehran so the server and the client always render
 * the same calendar day and there is no hydration mismatch.
 */

const TIME_ZONE = "Asia/Tehran";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

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

/** A plan price, split so the figure can be huge and the unit can stay small. */
export interface TomanPrice {
  /** The figure, in Persian digits — «۵۰ هزار». */
  value: string;
  /** The spoken unit, ready to sit beside the figure — «تومان». */
  unit: string;
}

/**
 * The API quotes every plan price in **ریال**; customers are quoted in **تومان**,
 * which is what they actually say and pay: 1 تومان = 10 ریال.
 *
 * The two parts come back separately because the price is set with the figure
 * huge and the unit small.
 *
 * Trimming happens **only on clean multiples**, so the spoken price reads the
 * way a person says it: «۵۰ هزار تومان», not «۵۰٬۰۰۰ تومان». Anything that is not
 * a clean multiple keeps its full figure, which is also what a speaker does —
 * «۱٬۲۳۴ تومان» is said, «۱٬۲۳۴ هزار تومان» is not.
 *
 * Magnitude first: the millions tier is tested before the thousands tier, and
 * it accepts divisibility by 100 000 rather than by a full million, so the
 * quotient carries at most one decimal — «۱٫۲ میلیون تومان» — and never a long
 * tail. The thousands tier is the fallback for clean thousands that are not
 * clean millions. Without that cap a price like 1 234 567 تومان would print as
 * «۱٫۲۳۴۵۶۷ میلیون تومان».
 *
 * A free plan is `۰ تومان`, not an error: a non-finite or negative amount is
 * clamped to zero rather than throwing, and `Infinity` in particular would
 * otherwise sail through both tiers and render as «∞ تومان».
 */
export function faToman(rial: number): TomanPrice {
  const toman = Number.isFinite(rial) ? Math.max(0, Math.round(rial / 10)) : 0;

  if (toman >= 1_000_000 && toman % 100_000 === 0) {
    return { value: faNumber(toman / 1_000_000), unit: "میلیون تومان" };
  }

  if (toman >= 1_000 && toman % 1_000 === 0) {
    return { value: faNumber(toman / 1_000), unit: "هزار تومان" };
  }

  return { value: faNumber(toman), unit: "تومان" };
}

/** `faToman` joined for the places that quote the whole price in one string. */
export function faTomanText(rial: number): string {
  const price = faToman(rial);

  return `${price.value} ${price.unit}`;
}

/**
 * «۱ ماه» / «۳ ماه» / «۱ سال» — the biggest whole unit that fits, so a 30-day
 * plan never reads as «۳۰ ماه». Falls back to days for any other length.
 */
export function faDuration(days: number): string {
  if (days < 30) return `${faNumber(days)} روز`;
  if (days % 365 === 0) return `${faNumber(days / 365)} سال`;
  if (days % 30 === 0) return `${faNumber(days / 30)} ماه`;

  return `${faNumber(days)} روز`;
}

/**
 * «همین الان» / «۳ دقیقه پیش» / «دیروز», falling back to `faDate`.
 *
 * `now` is a parameter so a caller can decide what "now" is. Relative time is
 * the one string in this app that cannot be rendered on the server — it depends
 * on the clock, so producing it during SSR guarantees a hydration mismatch the
 * moment the server and the client disagree about which bucket they are in.
 * Passing `undefined` yields `faDate(value)`, which is deterministic, and lets
 * the caller render that during SSR and this after mount.
 *
 * A future `value` (clock skew between the server and the phone) reads as
 * «همین الان» rather than a negative duration.
 */
export function faRelative(
  value: string | number | Date | undefined | null,
  now?: number,
): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  if (Number.isNaN(time)) return "";
  // Without a `now` the caller is on the server (or wants determinism), so
  // fall back to the deterministic absolute date rather than guess.
  if (now === undefined) return faDate(date);

  const diff = now - time;
  if (diff < MINUTE) return "همین الان";
  if (diff < HOUR) return `${faNumber(Math.floor(diff / MINUTE))} دقیقه پیش`;
  if (diff < DAY) return `${faNumber(Math.floor(diff / HOUR))} ساعت پیش`;
  if (diff < 2 * DAY) return "دیروز";
  if (diff < 7 * DAY) return `${faNumber(Math.floor(diff / DAY))} روز پیش`;

  return faDate(date);
}
