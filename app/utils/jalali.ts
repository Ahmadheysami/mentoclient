/**
 * Jalali (شمسی) → Gregorian conversion.
 *
 * No Jalali library is installed and none may be added for a single date
 * conversion, so the arithmetic is done here. The algorithm is the **2820-year
 * leap cycle** — Borkowski's correction of the Khayyam/Birashk rule — which
 * walks a table of leap-year breaks to find where the Jalali year starts in the
 * Gregorian one, then counts forward by plain month lengths.
 *
 * Pure by construction: no `Date`, no clock, no I/O. The caller owns "now", and
 * the same input yields the same output on the server and on the phone, so
 * nothing here can cause a hydration mismatch.
 *
 * SPECIFICATION — these conversions are executable, not illustrative. Every one
 * was checked against the `persian` calendar built into ICU, which is an
 * entirely independent implementation:
 *
 *     jalaliToGregorianString(1370, 5, 15) === "1991-08-06"
 *     jalaliToGregorianString(1390, 1,  1) === "2011-03-21"
 *     jalaliToGregorianString(1399, 12, 30) === "2021-03-20"  // 1399 is a leap year
 *     jalaliToGregorianString(1400, 12, 29) === "2022-03-20"
 *     jalaliToGregorianString(1401, 1,  1) === "2022-03-21"
 *     jalaliToGregorianString(1403, 1,  1) === "2024-03-20"
 *     jalaliToGregorianString(1404, 7,  1) === "2025-09-23"
 *
 * The 1400 row is the one worth reading twice: **1400 is NOT a leap year**, so
 * its last day is `1400/12/29` and `1400/12/30` is not a date at all. Passing
 * it still returns the next real day, `2022-03-21`, which is the documented
 * rollover below and not a conversion error. A form that offers 30 Esfand must
 * gate it on the leap year; this function deliberately does not, because "is
 * 1400 a leap year" is the caller's question and answering it here would be a
 * second source of truth.
 *
 * The leap table spans Jalali years `-61` through `3177`. Outside that the leap
 * arithmetic has no breaks to walk and the result is meaningless; only the
 * month and the day are range-checked here, and a caller passing a birth year
 * far from those bounds is passing a year no one was born in.
 */

/** First and last Jalali year the leap table below covers. */
const LEAP_EPOCH = -61;
const LEAP_HORIZON = 3178;

/**
 * The leap-year breaks of the 2820-year cycle, in Jalali years.
 *
 * `as const` and the two named endpoints: the walk below iterates the values
 * rather than indexing them, and the range check reads `LEAP_EPOCH` and
 * `LEAP_HORIZON` instead of the first and last element — so the bound and the
 * table cannot drift apart, and nothing here depends on an index that could be
 * out of range.
 */
const LEAP_BREAKS = [
  LEAP_EPOCH, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, LEAP_HORIZON,
] as const;

/** Days in the first six Jalali months, which are 31 long each. */
const LONG_MONTH_DAYS = 186;

/**
 * Truncating division, not `Math.floor`.
 *
 * The leap arithmetic subtracts into negative ranges (year 1399 lands on
 * `-61 + 0`), and `Math.floor(-1 / 33)` is `-1` where the algorithm means `0`.
 * `Math.trunc` is what the published algorithm specifies.
 */
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** The remainder that pairs with `div`, in the same truncating convention. */
function mod(a: number, b: number): number {
  return a - div(a, b) * b;
}

function isGregorianLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Gregorian month length. Written as a `switch` rather than a table lookup
 * because the 30-day months are exactly four named months (April, June,
 * September, November) and everything else is 31 — which states the fact
 * outright instead of hiding it behind an index that could be out of range.
 */
function gregorianDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isGregorianLeap(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Where a Jalali year starts in the Gregorian one: the Gregorian year, and the
 * day of March on which 1 Farvardin of that Jalali year falls. Always the 20th
 * or the 21st.
 */
function jalaliYearStart(jalaliYear: number): { year: number; march: number } {
  if (jalaliYear < LEAP_EPOCH || jalaliYear >= LEAP_HORIZON) {
    throw new RangeError(`سال جلالی خارج از محدوده جدول است: ${jalaliYear}`);
  }

  const gregorianYear = jalaliYear + 621;

  // `leapJ` accumulates the days Solar Hijri is ahead of Gregorian by the end
  // of the Jalali year, walking each break the year has passed.
  let leapJ = -14;
  let previousBreak = LEAP_EPOCH;
  let jump = 0;

  // Starting at the epoch rather than one break in: its own jump is 0, so the
  // first pass adds nothing and the walk is unchanged.
  for (const currentBreak of LEAP_BREAKS) {
    jump = currentBreak - previousBreak;

    if (jalaliYear < currentBreak) break;

    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    previousBreak = currentBreak;
  }

  const yearsPast = jalaliYear - previousBreak;

  leapJ += div(yearsPast, 33) * 8 + div(mod(yearsPast, 33) + 3, 4);

  // The 4-in-33 correction: a break that both lands on a leap year and is
  // exactly 4 years long has not actually shortened the year.
  if (mod(jump, 33) === 4 && jump - yearsPast === 4) leapJ += 1;

  // The same count on the Gregorian side: leap years suppressed by the century
  // rule, and the Gregorian year does not start on 1 Farvardin.
  const leapG =
    div(gregorianYear, 4) - div((div(gregorianYear, 100) + 1) * 3, 4) - 150;

  return { year: gregorianYear, march: 20 + leapJ - leapG };
}

/** Zero-based day of the Jalali year for a validated `(month, day)`. */
function jalaliDayOfYear(month: number, day: number): number {
  if (month <= 7) {
    // Months 1..6 are 31 days, so the gap grows by one day per skipped short
    // month: 186 days of long months, then month 7 begins.
    return (month - 1) * 31 - div(month, 7) * (month - 7) + day - 1;
  }

  return LONG_MONTH_DAYS + (month - 7) * 30 + day - 1;
}

/** A Gregorian date moved forward by `days`, by month lengths. `days >= 0`. */
function addGregorianDays(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  let rest = days;

  while (rest > 0) {
    const leftInMonth = gregorianDaysInMonth(year, month) - day;

    if (rest <= leftInMonth) {
      return { year, month, day: day + rest };
    }

    rest -= leftInMonth + 1;
    day = 1;
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { year, month, day };
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

/**
 * A Jalali date as a Gregorian one.
 *
 * The month and the day are range-checked and a `RangeError` is thrown rather
 * than a plausible-looking date being returned: the caller is expected to
 * validate a birth date, but a silent wrong answer here would be indistinguishable
 * from a correct one on a chart that has to stay correct forever.
 *
 * `day` is checked against 31 and not against the length of that particular
 * month, so `1400/12/30` rolls into the next year instead of throwing. See the
 * note at the top of this file for why that boundary is the caller's.
 */
export function jalaliToGregorian(
  year: number,
  month: number,
  day: number,
): GregorianDate {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`ماه جلالی نامعتبر است: ${month}`);
  }

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`روز جلالی نامعتبر است: ${day}`);
  }

  const start = jalaliYearStart(year);

  return addGregorianDays(
    start.year,
    3,
    start.march,
    jalaliDayOfYear(month, day),
  );
}

/**
 * `"YYYY-MM-DD"`, zero-padded — the exact shape the astrology form's
 * `gregorianDate` field is validated against: a 19xx/20xx year, two digits each
 * for month and day, joined by **dashes**, where `solarDate` uses slashes. The
 * padding is what makes the two fields impossible to swap by formatting alone.
 */
export function jalaliToGregorianString(
  year: number,
  month: number,
  day: number,
): string {
  const date = jalaliToGregorian(year, month, day);
  const monthText = String(date.month).padStart(2, "0");
  const dayText = String(date.day).padStart(2, "0");

  return `${date.year}-${monthText}-${dayText}`;
}
