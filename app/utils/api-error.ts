/**
 * The ONE rule for turning an API refusal into a sentence a reader may see.
 *
 * ## THE PROBLEM IT SOLVES
 *
 * Upstream answers **every** failure with HTTP 200 and the real status inside
 * `statusCode`, next to a machine `reason` and a human `message`. The `message`
 * is already-translated Persian and is worth showing — it is the only place a
 * reader gets the specific reason their request was refused.
 *
 * **Except** when `reason` is absent AND `statusCode >= 500`. That combination is
 * an uncaught exception inside the backend that reached the error middleware
 * untranslated, so its `message` is raw JavaScript in English — «Cannot read
 * properties of undefined (reading 'x')». Rendering that puts an implementation
 * detail of our own backend in front of a Persian reader, tells them nothing they
 * can act on, and (on a page about their own birth data, their goals or their
 * conversation) describes our internals to them.
 *
 * Those refusals get the caller's **written Persian sentence** instead, and
 * `message` is never read for them.
 *
 * ## WHY IT IS ONE FUNCTION AND NOT THREE
 *
 * `stores/astrology.ts` and `stores/pro-bot.ts` each had this rule privately, in
 * a module-local `refusalMessage`, while `stores/goal.ts` had six error paths
 * that read `response.message` with no guard at all. Three copies of a security
 * rule is three places for the next feature to forget the fourth one, so the rule
 * lives here — a pure function beside `utils/fa.ts` and `utils/coin.ts`, with no
 * state and no clock, so the server render and the client hydration produce the
 * same string from the same input.
 *
 * The per-store Persian copy stays with the caller, because **the sentence that is
 * right depends on what was being attempted**: a failed astrology activation and a
 * failed chat turn are different sentences, and neither store may borrow the
 * other's.
 */

/**
 * The part of a failure envelope this rule is allowed to look at.
 *
 * Structural on purpose: every store's own response interface
 * (`GoalListResponse`, `AstrologyActivateResponse`, `ProBotChatResponse`, …)
 * satisfies it, and a feature's own `reason` union — `GoalFailureReason`,
 * `AstrologyFailureReason` — is a subtype of `string | null`. No store has to cast
 * or reshape its response to hand it over.
 */
export interface ApiFailureEnvelope {
  message?: string;
  reason?: string | null;
  statusCode?: number;
}

/** `null` for "nothing worth saying" — never `0` and never an empty string. */
function toMessage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The sentence to SHOW for a refused request.
 *
 * `reason == null` is checked with `== null` semantics on purpose: a **missing**
 * reason and an explicit `null` mean the same thing here, and only one of them is
 * written by hand — so a `??` on `statusCode` is not a shortcut either. A crash
 * is identified by the *absence of a reason together with* a 5xx, never by the
 * `message`, because a crash is precisely the case where `message` is worthless.
 */
export function refusalMessage(
  payload: ApiFailureEnvelope | null | undefined,
  fallback: string,
): string {
  const isServerCrash =
    (payload?.reason === null || payload?.reason === undefined) &&
    typeof payload?.statusCode === "number" &&
    payload.statusCode >= 500;

  return isServerCrash ? fallback : (toMessage(payload?.message) ?? fallback);
}