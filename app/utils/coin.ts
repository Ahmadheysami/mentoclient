import { faNumber } from "./fa";

/**
 * Coin conversion — the ONLY place in this app where a raw token figure becomes
 * a coin figure, and the only place a coin figure becomes text.
 *
 * The upstream scale is **not uniform**, and that is the whole reason this file
 * exists:
 *
 * - `GET /balance` reports `base` alongside the raw balances, and
 *   `balances[].balance` is RAW.
 * - The astrology and goal responses report `balance` and `coins` RAW as well.
 * - The Pro Bot chat response reports `tokens` **already ÷ `base`** — a float
 *   that is coins and must NOT be divided again.
 *
 * So the two directions are separate, named functions rather than one
 * `convert(value, base)` a caller can use the wrong way round: a reader who
 * passed bot `tokens` through `toCoins` would see a balance of `0.0`, and
 * nothing about that would look like a bug.
 *
 * Every function here is **pure** — no state, no clock, no I/O — so the server
 * render and the client hydration produce the same string from the same input.
 */

/** `appConfig.token.base` upstream (`Server/src/app.config.json`). */
export const COIN_FALLBACK_BASE = 1000;

/**
 * A usable `base`, never zero and never negative.
 *
 * A `base` of `0` or less is not a scale, it is a divide-by-zero waiting to
 * happen, and it arrives as `null` from `/balance` before the first answer — so
 * it is guarded here rather than at each call site.
 */
function usableBase(base: number | null | undefined): number {
  return typeof base === "number" && base > 0 ? base : COIN_FALLBACK_BASE;
}

/**
 * RAW → display coins.
 *
 * Use for `balances[].balance` and for the `balance`/`coins` of the astrology
 * and goal responses — those are the raw ones.
 *
 * `null` in, `null` out: "not loaded yet" and "zero coins" are different
 * answers and must not collapse into `0`, which a wallet would render as a
 * broke reader.
 *
 * A negative figure is clamped to `0`. The server is not expected to send one,
 * and if it does, a debt is not something this app is entitled to invent.
 */
export function toCoins(
  raw: number | null | undefined,
  base: number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;

  return Math.max(0, raw / usableBase(base));
}

/**
 * display coins → RAW. Use for `POST /wallet/buy-token`, whose `token` is raw.
 *
 * No `null` case: this direction is always driven by a reader who has already
 * chosen a number, and refusing to send would be worse than sending the floor
 * of it. A non-finite or negative amount is clamped to `0` rather than
 * throwing, for the same reason.
 */
export function toRawTokens(
  coins: number,
  base: number | null | undefined,
): number {
  const amount = Number.isFinite(coins) ? Math.max(0, coins) : 0;

  return amount * usableBase(base);
}

/**
 * The one place a coin figure becomes text.
 *
 * Floors, because a fraction of a coin cannot be spent: showing `۱۲٫۵` next to a
 * button that spends `۱۲` is a promise the server will not keep.
 *
 * A missing figure is an em-dash, **never `«۰»`**. "Not loaded yet" and "you
 * have no coins" are different sentences, and a zero would say the second one
 * to a reader who simply has not asked yet.
 */
export function formatCoins(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";

  return faNumber(Math.floor(value));
}
