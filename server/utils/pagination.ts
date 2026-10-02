/**
 * Reading a `page` / `limit` query **before** it is forwarded upstream.
 *
 * A proxy that forwards `Number(query.limit)` hands the upstream two things it
 * cannot use and this server cannot afford:
 *
 * - **an unbounded figure.** `?limit=100000` is passed straight through, so a
 *   client — not this server's own pagination — decides how many documents the
 *   upstream has to read, count and serialise for one request. Every goal list and
 *   every message ladder in this app is a paginated read for exactly this reason.
 * - **a non-number.** `?limit=abc` becomes `NaN`, and `NaN` on the wire is not a
 *   refusal: upstream has to discover it, and what it does with it is a guess
 *   this server cannot see.
 *
 * So a value is forwarded only when it is a plain decimal integer, and a `limit`
 * is additionally required to be positive and capped. **An unusable value is
 * dropped, not rejected** — the upstream contract has its own defaults for a
 * missing `page`/`limit`, and inventing a client-side error would turn a
 * hand-typed query into a failure the upstream never needed to see.
 *
 * Shared by every paginated proxy (`goal/index.get.ts`, `goal/[id]/messages.get.ts`,
 * `astrology/results.get.ts`) rather than copied into each: three private copies
 * of "what is a valid page size" is three places for the next route to answer
 * differently. Nitro auto-imports this directory, so a route uses these with no
 * import statement.
 */

/**
 * The most documents one page may ask for.
 *
 * Five times the app's own `GOAL_PAGE_SIZE` of 20: enough for any real client
 * (none of them asks for more than 20), and a hard ceiling on what one request can
 * cost the upstream.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Decimal digits only — no sign, no exponent, no fraction, no hex.
 *
 * `?page=1e3`, `?limit=0x10` and `?limit=-5` are all refused rather than guessed
 * at, so a forwarded query value is always a number a reader can recognise.
 */
const DECIMAL_INTEGER = /^\d{1,15}$/;

/** A `string | number` that is a plain, safe, non-negative integer. */
function toInteger(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }

  if (typeof value !== "string") return undefined;

  const raw = value.trim();

  if (!DECIMAL_INTEGER.test(raw)) return undefined;

  const parsed = Number(raw);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/**
 * A page index, or `undefined` to let the upstream apply its own default.
 *
 * `0` is the FIRST page, not "unset" — the stores send it from the very first
 * request, so dropping it here would silently shift every list by one page.
 */
export function toPage(value: unknown): number | undefined {
  return toInteger(value);
}

/**
 * A page size, or `undefined` to let the upstream apply its own default.
 *
 * Positive and at most `MAX_PAGE_SIZE`: `0` and negatives are not page sizes, and
 * a figure above the cap is clamped rather than refused, because a client asking
 * for "as much as possible" is better served by a large page than by an error.
 */
export function toLimit(value: unknown): number | undefined {
  const limit = toInteger(value);

  if (limit === undefined || limit < 1) return undefined;

  return Math.min(limit, MAX_PAGE_SIZE);
}