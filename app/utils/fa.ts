import { jalaliToGregorianString } from "./jalali";

/**
 * Persian (Jalali) formatting helpers.
 *
 * The timezone is pinned to Tehran so the server and the client always render
 * the same calendar day and there is no hydration mismatch.
 *
 * The Jalali helpers at the bottom keep that promise literally: every number they
 * return is derived through `Intl` **in that zone**. There is no `getMonth()`, no
 * `getFullYear()` and no local-midnight `Date` anywhere in this file, because a
 * single one of those would answer with the *phone's* zone on the client and with
 * the *server's* on the server — the two disagree for eight hours a day and the
 * report's month is exactly the kind of thing that sits on a boundary.
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

const faTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
  hourCycle: "h23",
});

const faNumberFormatter = new Intl.NumberFormat("fa-IR");

/** «۱۲ آبان ۱۴۰۴» */
export function faDate(value: string | number | Date | undefined | null): string {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : faDateFormatter.format(date);
}

/**
 * «۱۴:۳۰» — the wall clock of one instant, in the zone, with no date.
 *
 * This is `faDate`'s other half: a window that opens at 14:30 and shuts at 16:00
 * is two times on one day, and printing the Jalali date twice beside them is
 * noise the reader has to look past. Callers that need to know whether two
 * instants share a day compare `faDate(a) === faDate(b)` — the same formatter,
 * the same zone, so the answer is a fact and not an approximation.
 *
 * `hourCycle: "h23"` is explicit for the reason `zoneClockFormatter` above
 * records: under `hour12: false` some ICU builds answer midnight as `"24"`,
 * which is not an hour of the day.
 *
 * `""` for an unusable value, like `faDate`.
 */
export function faTimeOfDay(value: string | number | Date | undefined | null): string {
  if (value === undefined || value === null) return "";

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : faTimeFormatter.format(date);
}

/** «۳» — Persian digits, so counts sit naturally next to Persian dates. */
export function faNumber(value: number): string {
  return faNumberFormatter.format(value);
}

/* ------------------------------------------------------------- Jalali parts -- */

/**
 * The part kinds this file reads back out of a formatter.
 *
 * Narrower than `Intl`'s own union on purpose: it is the set this file has a
 * reader for, so a typo cannot become a `find()` that silently answers `NaN`.
 */
type ClockPart = "year" | "month" | "day" | "hour" | "minute" | "second";

/**
 * `fa-IR` + the Persian calendar + **Latin** digits.
 *
 * - `-u-ca-persian` is explicit although `fa-IR` already defaults to it: the
 *   calendar a locale defaults to is a property of the *CLDR version*, not of the
 *   tag, and the server's Node and the phone's browser ship different ones.
 * - `-nu-latn` asks for ASCII digits, because these fields are read back as
 *   `Number`s by the boundary math below and by anything comparing a month.
 *   `toLatinDigits` still normalizes, because an ICU old enough to ignore the
 *   keyword would otherwise hand back Persian digits and this function would
 *   return `null` on the client and a number on the server — a hydration
 *   mismatch manufactured by a date.
 */
const faJalaliFormatter = new Intl.DateTimeFormat(
  "fa-IR-u-ca-persian-nu-latn",
  {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TIME_ZONE,
  },
);

/**
 * The month as a **number**, which is the other half of what the formatter above
 * cannot give.
 *
 * A second formatter because `month: "long"` and `month: "numeric"` are two
 * renderings of one field, not one field with two spellings: asked for the name,
 * ICU answers «مهر» and there is no number in it, while `jalaliMonthWindow`
 * needs the index to roll month 12 into the next year. Both are pinned to the
 * same locale, calendar, digits and zone, so they cannot disagree.
 *
 * Only `month` is asked for, so this one formats the smallest possible part.
 */
const faJalaliMonthFormatter = new Intl.DateTimeFormat(
  "fa-IR-u-ca-persian-nu-latn",
  { month: "numeric", timeZone: TIME_ZONE },
);

/**
 * The zone's wall clock as numbers — read, never looked at.
 *
 * `en-US` is deliberate: the parts below go straight into `Date.UTC`, so ASCII
 * digits and zero-padded fields are wanted and nothing here is ever rendered.
 * `hourCycle: "h23"` is explicit because `hour12: false` yields `"24"` for
 * midnight in some ICU versions, and `Date.UTC` would read that as the next day.
 */
const zoneClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** U+06F0..U+06F9, the digits a Persian keyboard and `fa-IR` both produce. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** U+0660..U+066F — what an Arabic locale in the same ICU would produce. */
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * The two non-ASCII digit blocks this app can be handed, mapped onto ASCII —
 * which passes through untouched.
 *
 * Applied to formatter output rather than to user input: these values never reach
 * the screen, they only have to be parseable, and guessing wrong about which block
 * an ICU chose is exactly the failure that would differ between the server and the
 * phone.
 */
function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}

/**
 * How far `TIME_ZONE` is from UTC at `instant`, in milliseconds.
 *
 * **Read from the zone, never assumed.** Tehran has been a flat `+03:30` since
 * 1401 and every report this app reads is newer than that, so a hard-coded
 * `210` would be right today and quietly wrong for any historical value — and
 * this file's whole reason to exist is that a date must not be read two ways.
 */
function zoneOffsetMs(instant: Date): number {
  const parts = zoneClockFormatter.formatToParts(instant);

  const read = (type: ClockPart): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return (
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
    ) - instant.getTime()
  );
}

/**
 * The first moment of a `YYYY-MM-DD` day **in Tehran**, or `null`.
 *
 * Midnight in a zone that is not UTC is an instant, not a date, so it cannot be
 * written as a string: `new Date("2026-09-23")` is UTC midnight and lands on the
 * wrong calendar day in Tehran. The offset is therefore measured and subtracted,
 * then measured **again** at the instant that produced — because Iran used to move
 * its clock at midnight, and a day whose offset changes inside it must not be one
 * hour off. Two passes converge for every offset a real zone has.
 *
 * `null` rather than a wrong `Date`: the caller decides what an unreadable date
 * means, and this file's convention is to answer nothing rather than something
 * plausible (see `faDate`, which answers `""`).
 */
function firstMomentOfTehranDay(dateText: string): Date | null {
  // `jalaliToGregorianString` produces this exact shape, so it is never parsed
  // from anything a reader typed.
  const wallClock = Date.parse(`${dateText}T00:00:00Z`);

  if (Number.isNaN(wallClock)) return null;

  let instant = new Date(wallClock - zoneOffsetMs(new Date(wallClock)));
  instant = new Date(wallClock - zoneOffsetMs(instant));

  return Number.isFinite(instant.getTime()) ? instant : null;
}

/** One numeric formatter part as an ASCII number, or `null`. */
function numericPart(
  parts: Intl.DateTimeFormatPart[],
  type: ClockPart,
): number | null {
  const raw = parts.find((part) => part.type === type)?.value;

  if (raw === undefined) return null;

  const value = Number(toLatinDigits(raw));

  return Number.isFinite(value) ? value : null;
}

/** A Jalali date as numbers plus the month's name. */
export interface FaJalaliParts {
  /** «۱۴۰۵» → `1405` — **Latin** digits. */
  year: number;
  /** «۷» → `7`, always `1..12`. **Latin** digits. */
  month: number;
  /** «مهر» — **Persian**, the spelling a reader is shown. */
  monthName: string;
  /** «۲» → `2`. **Latin** digits. */
  day: number;
}

/**
 * A moment's Jalali calendar date in Tehran — «طالع‌بینی مهر» is `monthName`, and
 * a report's progress window is this date arithmetic.
 *
 * ## DIGIT CONVENTION
 *
 * `monthName` is Persian («مهر», «اسفند»); `year`, `month` and `day` are **Latin**
 * numbers, because they are arithmetic rather than prose — they are compared, fed
 * into `jalaliToGregorian*`, and turned into a percentage, and a Persian-digit
 * number is a string this file would then have to translate before using. A screen
 * that wants to *show* one of them runs it through `faNumber` first.
 *
 * ## WHY IT IS NOT `faDate(value).split(" ")`
 *
 * `faDate` returns a formatted sentence whose shape (and whose digits) belongs to
 * the CLDR data of whichever ICU runs it. Parsing a display string back into
 * numbers is how a date silently becomes `NaN` on the one runtime that ordered its
 * fields differently. `formatToParts` asks for the fields, and this is the same
 * construction `faDate` already uses.
 *
 * ## WHY IT IS SAFE ON THE SERVER
 *
 * It reads **no clock** — only `value` — and every field is taken through the
 * pinned `TIME_ZONE`, so the server and the client answer identically for the same
 * input. It reads `monthName` from the formatter as well, so the title of a report
 * cannot differ between the two either.
 *
 * @returns `null` for an absent, unparseable or out-of-range date — the same
 * «answer nothing rather than something plausible» rule `faDate` follows by
 * answering `""`.
 */
export function faJalaliParts(
  value: string | number | Date | undefined | null,
): FaJalaliParts | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = faJalaliFormatter.formatToParts(date);

  const year = numericPart(parts, "year");
  const day = numericPart(parts, "day");
  const monthName = parts.find((part) => part.type === "month")?.value ?? "";
  const month = numericPart(
    faJalaliMonthFormatter.formatToParts(date),
    "month",
  );

  // The range check is where a refusal is prevented rather than caught: `month` is
  // what `jalaliToGregorian` below is handed, and it throws on anything outside
  // `1..12`.
  if (year === null || month === null || day === null || monthName === "") {
    return null;
  }

  if (month < 1 || month > 12) return null;

  return { year, month, monthName, day };
}

/** The Jalali month a moment belongs to, as the two moments that bound it. */
export interface JalaliMonthWindow {
  /**
   * The first moment of that month in Tehran — `1405/07/01 00:00 +03:30`, i.e.
   * `2026-09-22T20:30:00Z`.
   */
  start: Date;
  /**
   * The first moment of the **next** Jalali month in Tehran, which is this
   * month's exclusive end. Month 12 rolls the year over; month 1 is an ordinary
   * step.
   */
  end: Date;
}

/**
 * The Jalali month a moment falls in, as the two Tehran moments that bound it —
 * the numbers a month-long progress indicator needs.
 *
 * ## WHAT THE CALLER DOES WITH IT
 *
 * `end - start` is the length of the month (29, 30 or 31 days) and
 * `now - start` is how much of it has passed, so the bar is one subtraction in
 * either direction:
 *
 *     const window = jalaliMonthWindow(report.createdAt);
 *     const length = window.end.getTime() - window.start.getTime();
 *     const passed = now - window.start.getTime();
 *
 * **`now` stays the caller's.** This function reads no clock — the same argument
 * `faRelative` is given one for — so a screen may render the window itself during
 * SSR and only the *fraction* after mount, and nothing here can disagree with
 * itself between the two renders.
 *
 * ## THE CONVERSION IS NOT REWRITTEN HERE
 *
 * `jalaliToGregorianString` (from `./jalali`, the Borkowski-corrected 2820-year
 * cycle) answers the only question this needs answered: which Gregorian day is the
 * 1st of a Jalali month. A second converter would be a second opinion about the
 * Persian calendar, and the two would disagree by a day somewhere far from now —
 * which is precisely the class of bug a chart must not have.
 *
 * ## WHY IT ANSWERS `null`
 *
 * Three honest ways to fail, all of which would otherwise produce a plausible
 * `Date`: an unparseable input, a moment whose Jalali year is outside the leap
 * table (`jalaliToGregorian` throws `RangeError` outside `-61..3177`), or a zone
 * this runtime cannot measure. `null` says «this moment has no month here», and
 * a screen that draws no bar is right where a wrong bar is not. Same rule as
 * `faDate` returning `""`.
 */
export function jalaliMonthWindow(
  value: string | number | Date | undefined | null,
): JalaliMonthWindow | null {
  const parts = faJalaliParts(value);

  if (parts === null) return null;

  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1;

  try {
    const start = firstMomentOfTehranDay(
      jalaliToGregorianString(parts.year, parts.month, 1),
    );

    const end = firstMomentOfTehranDay(
      jalaliToGregorianString(nextYear, nextMonth, 1),
    );

    if (start === null || end === null) return null;

    return { start, end };
  } catch {
    // `jalaliToGregorian` throws for a year its leap table does not cover. That is
    // a value this app never produces and cannot title, so it is answered as
    // «no window» rather than as a wrong one.
    return null;
  }
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

/**
 * Arabic → Persian orthography, for text this app did not write.
 *
 * The external city list
 * (`https://iran-locations-api.ir/api/v1/fa/cities`) was fetched and verified:
 * 119 of its 344 names are typed in **Arabic** code points — «تبريز» with ي
 * (U+064A), «ميانه», «اروميه» — although the app is hard-coded RTL Persian.
 * They render identically to the eye and are different code points, so a
 * reader's Persian keyboard output never matches them by string equality:
 * `IRAN_PROVINCES` (already normalized) and that list would disagree about
 * every one of those cities, and a submitted name would not match a province.
 *
 * Three mappings, applied in this order:
 * - `ي` (U+064A) → `ی` (U+06CC), and `ك` (U+0643) → `ک` (U+06A9): the letters
 *   Persian has and Arabic does not.
 * - `ة` (U+0629, teh marbuta) → `ه` (U+0647, heh): the same letter in its
 *   final form, which Arabic-scripted Persian text uses and a Persian keyboard
 *   cannot type.
 * - Arabic harakat (U+064B–U+0652) and the superscript alef (U+0670) are
 *   **stripped**, not mapped: they are pronunciation marks, and a Persian
 *   keyboard produces none, so leaving them makes the comparison fail for a
 *   reason no reader could see on screen.
 *
 * ZWNJ (U+200C) and the Persian ی/ک are deliberately left alone — they are
 * already correct — and no whitespace is collapsed, so «حاجي آباد» keeps the
 * space the reader sees.
 *
 * Pure: no state, no I/O, same output on the server and on the phone.
 */
export function faNormalize(value: string): string {
  return value
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[يكة]/g, (character) =>
      character === "ي" ? "ی" : character === "ك" ? "ک" : "ه",
    );
}
