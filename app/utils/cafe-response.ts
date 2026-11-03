/**
 * The ONE reader of a cafe answer.
 *
 * ## THE PROBLEM IT SOLVES
 *
 * `expressErrorHandler` answers **every** failure with HTTP 200/201 and the real
 * status inside `statusCode`. So `await $fetch(...)` resolving tells you nothing
 * at all, and the trap is a very comfortable one: the status check passes, the
 * code looks correct, and the screen quietly renders an empty state over a
 * refusal. Success is `success === true`, the kind of refusal is `reason`, and
 * nothing here branches on `statusCode`.
 *
 * ## WHY IT IS ONE MODULE AND NOT A `switch` PER STORE
 *
 * The same envelope is read by every cafe caller, and three of them needed it in
 * three different shapes already: the store wanted a reason to branch on, the
 * socket plugin wanted a sentence, and the error component wanted neither. One
 * rule per feature means the next endpoint added to `stores/cafe.ts` cannot be
 * the one that forgets the `200` trap.
 *
 * ## ⚠️ AND THE ONE ANSWER THAT IS **NOT** AN ANSWER
 *
 * §1.4 has exactly one exception, and it is what `parseCafeError` / `isCafeThrottle`
 * at the bottom are for: **HTTP 429 sets the real status**, so `$fetch` REJECTS
 * instead of resolving and there is no payload for anything above to read. A read
 * path that catches every rejection and answers `null` therefore cannot tell
 * «this café is throttling me» from «this request never reached a server» — two
 * answers that want opposite sentences, one of which tells a reader on a perfect
 * connection that their connection is at fault. Those two functions read a
 * rejection the way the rest of this module reads a payload, so a throttled
 * reader is told to slow down rather than to check their internet.
 *
 * Pure functions, no state and no clock, so the server render and the client
 * hydration read the same payload the same way.
 */

import { refusalMessage } from "~/utils/api-error";
import {
  isCafeFailureReason,
  type CafeFailure,
  type ICafeErrorData,
  type ICafeErrorPayload,
  type ICafeMessagesResponse,
} from "~/types/cafe";

/**
 * What a reader is told when the payload gave nothing usable.
 *
 * It also stands in for a backend crash: a 5xx with no `reason` carries an
 * untranslated English `TypeError` as its `message`, and `refusalMessage` — the
 * one rule, from `~/utils/api-error` — is what refuses to show it.
 */
const GENERIC_REFUSAL =
  "در حال حاضر نشد درخواست کافه انجام شود. لطفاً کمی بعد دوباره تلاش کنید.";

/**
 * The only structural check every read below makes.
 *
 * A Nitro proxy answers a dead upstream with `connectionResponseError()` rather
 * than rejecting, but a route that does not exist at all answers with a
 * `createError` payload, so "is this an object" is genuinely load-bearing and not
 * defensive noise.
 */
function asEnvelope(payload: unknown): ICafeErrorPayload | null {
  return typeof payload === "object" && payload !== null
    ? (payload as ICafeErrorPayload)
    : null;
}

/** The status the rate limiters set for real — §1.4's one documented exception. */
const TOO_MANY_REQUESTS = 429;

/** The two reasons a limiter answers with; §1.3's own two-rule rule. */
const THROTTLE_REASONS: readonly string[] = [
  "ERR_TOO_MANY_REQUESTS",
  "ERR_RATE_LIMIT",
];

const isThrottleReason = (value: unknown): boolean =>
  typeof value === "string" && THROTTLE_REASONS.some((reason) => reason === value);

/**
 * The HTTP status a value carries, or `null` when it carries none.
 *
 * `ofetch` rejects with a `FetchError` whose `response` is the server's
 * `Response`-like object, and `status` is how a refusal that actually reached a
 * server is told apart from a transport failure that never did — the same
 * discrimination `server/api/goal/chart.get.ts` makes, and for the same reason:
 * they are different facts and the answer must be read rather than assumed.
 *
 * `FetchError` DECLARES `response` on its class, so on a transport failure the
 * property is present and `undefined`; testing for its presence would therefore
 * read every dropped request as an answered one. The narrowing below is on the
 * value at every step, so a malformed value answers `null` — the "never
 * completed" side, which `parseCafeError` leaves to the caller.
 *
 * ⚠️ The status is read from `status` and `statusCode` BECAUSE both spellings
 * exist in the wild: `ofetch`'s `FetchError` exposes `statusCode` as a getter and
 * the underlying `Response` as `status`, and an H3 rejection carries `statusCode`
 * with no `response` at all.
 */
function caughtStatus(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;

  const { response, status, statusCode } = value as {
    response?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  if (typeof response === "object" && response !== null) {
    const upstream = (response as { status?: unknown }).status;

    if (typeof upstream === "number") return upstream;
  }

  if (typeof statusCode === "number") return statusCode;

  return typeof status === "number" ? status : null;
}

/**
 * The JSON body a value carries, or `null` when it carries none.
 *
 * A resolved payload IS its own body — which is what lets `isCafeThrottle` and
 * `parseCafeError` accept either shape. For a rejection, `ofetch` puts the parsed
 * body on `data` and the unparsed copy on `response._data`, and only one of the
 * two exists depending on the layer that threw, so both are read.
 */
function caughtPayload(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  const { data, response } = value as { data?: unknown; response?: unknown };

  if (data !== undefined) return data;

  if (typeof response === "object" && response !== null) {
    const body = (response as { _data?: unknown })._data;

    if (body !== undefined) return body;
  }

  // An envelope is its own body — this is the resolved-payload case, and the
  // absence of `data` is exactly what makes it recognisable.
  return value;
}

/**
 * Did the backend accept this?
 *
 * ⚠️ **NOT the test for message history.** `GET /table/:tableId/messages` is the
 * one endpoint whose success carries NO `success` field, and its
 * `INFO_TABLE_NOT_FOUND` refusal carries `success: true` — so this function
 * answers `true` for a refusal there. History must be read with
 * `isCafeMessagesPayload` + `isTableNotFoundFailure`, never with this alone.
 */
export function isCafeSuccess<T extends { success?: unknown }>(
  payload: T | null | undefined,
): payload is T & { success: true } {
  return asEnvelope(payload)?.success === true;
}

/**
 * Is this a message-history page, success or `INFO_TABLE_NOT_FOUND`?
 *
 * The genuine exception to the "always check `success`" rule, and the reason is
 * upstream: this endpoint's successful payload omits `success` entirely, so the
 * only thing its two shapes have in common is the array. Guarding on
 * `success === true` would therefore throw away every real page, and a
 * connection failure — which has no `messages` at all — is the only thing this
 * correctly refuses.
 */
export function isCafeMessagesPayload(
  payload: unknown,
): payload is ICafeMessagesResponse {
  const envelope = asEnvelope(payload);

  return Array.isArray((envelope as ICafeMessagesResponse | null)?.messages);
}

/** The Zod issues, as plain sentences, from EITHER transport's spelling. */
function validationMessages(data: ICafeErrorData | null | undefined) {
  // REST sends `data.errors` (plural); the socket sends `data.error`
  // (singular, still an array). Both arrive on the same feature, so both are
  // read here rather than in each caller.
  const issues = data?.errors ?? data?.error;

  if (!Array.isArray(issues)) return null;

  const sentences = issues
    .map((issue) =>
      typeof issue === "string" ? issue : issue?.message ?? null,
    )
    .filter((sentence): sentence is string => sentence !== null);

  // `null` for "nothing worth saying" — the same convention as `refusalMessage`.
  return sentences.length > 0 ? sentences : null;
}

/**
 * Turn any cafe answer into the four things a caller may act on.
 *
 * `fallback` is the sentence to show when the payload has none worth showing.
 * Callers with a more specific sentence of their own (a failed join, a failed
 * send) pass it; the default is the generic one.
 *
 * `reason` is the branch key and is narrowed to `CafeFailureReason`, so an
 * unrecognised reason becomes `null` instead of a string nobody can compare.
 */
export function parseCafeFailure(
  payload: unknown,
  fallback: string = GENERIC_REFUSAL,
): CafeFailure {
  const envelope = asEnvelope(payload);

  return {
    reason: isCafeFailureReason(envelope?.reason) ? envelope.reason : null,
    statusCode:
      typeof envelope?.statusCode === "number" ? envelope.statusCode : null,
    message: refusalMessage(envelope, fallback),
    errors: validationMessages(envelope?.data),
  };
}

/**
 * The message-history endpoint's own "this table is not there".
 *
 * It arrives as `success: true` (the `$lookup` writes the collection name as
 * `"caves"`, finds nothing, `$unwind`s without `preserveNullAndEmptyArrays` and
 * the handler still reports success), so a reader would otherwise sit on a
 * permanent empty history with no way to tell it from an empty conversation.
 * It is a STATE, not a crash: the screen says "not available" and offers a
 * retry rather than looping.
 */
export function isTableNotFoundFailure(payload: unknown): boolean {
  return parseCafeFailure(payload).reason === "INFO_TABLE_NOT_FOUND";
}

/**
 * ⚠️ THE ONE CAFÉ REFUSAL THAT **REJECTS** RATHER THAN ANSWERS.
 *
 * Every other café failure is delivered with HTTP 200/201 and the real status
 * inside `statusCode` (§1.4), so it arrives as a resolved value and is read by
 * `parseCafeFailure` above. **HTTP 429 is the exception**: the rate limiters are
 * the only café handlers that set the real status, so `$fetch` throws and the
 * envelope never reaches a caller that only inspects resolved answers.
 *
 * Two shapes of it, and they need two different names:
 *
 * - the **message routes'** limiter (send / edit / delete — 30–60 per 60s per
 *   user) answers a body of exactly two keys, `{ success: false, reason }`: no
 *   `message` to show and no `statusCode` inside it;
 * - the **global** limiter (500 per 60s) answers the full envelope, `message`
 *   included, and says `ERR_RATE_LIMIT`.
 *
 * Accepted either as an ENVELOPE or as a CAUGHT ERROR, because the two callers
 * that need it hold the two shapes: an action that reads a resolved payload
 * (where the limiter is upstream of us and the envelope arrives whole) and a read
 * whose `$fetch` threw (where only the rejection is left).
 *
 * ⚠️ A rate limit is **not** a connection failure and must never be reported as
 * one. That is why this exists at all: the read path catches every rejection and
 * answers `null`, and the sentence a caller substitutes for a request that never
 * completed is «اتصال اینترنت را بررسی کنید» — which tells a reader on a perfect
 * connection that their connection is the problem, and invites them to retry a
 * request the backend has just asked them to slow down on.
 */
export function isCafeThrottle(value: unknown): boolean {
  const envelope = asEnvelope(caughtPayload(value));

  if (envelope?.success === false && isThrottleReason(envelope?.reason)) {
    return true;
  }

  return caughtStatus(value) === TOO_MANY_REQUESTS;
}

/**
 * A caught fetch error that actually carries a café answer, read as one.
 *
 * `null` means **the request never completed** — no response object at all, which
 * is a dropped connection or a backend that is not running — so the caller keeps
 * whatever it does for that case. Anything that DID reach a server becomes the
 * same `CafeFailure` shape a resolved payload produces, through the same
 * `parseCafeFailure`, which is what keeps «one failure shape» true for the
 * rejection path too.
 *
 * One answer gets an explicit arm here because reading it any other way is
 * actively misleading:
 *
 * **HTTP 429** → a throttle, and `reason` becomes `ERR_TOO_MANY_REQUESTS` when the
 * body carries none. That is the doc's own client rule (§1.3) for a 429 on a
 * message route; the global limiter's `ERR_RATE_LIMIT` is preserved because it IS
 * in the body. `message` is the caller's written Persian sentence for every one of
 * these, because the message routes' 429 body has no `message` of its own — there
 * is nothing upstream to translate, and a limiter is not a translator.
 *
 * ⚠️ `INFO_TABLE_NOT_FOUND` needs NO arm here and gets none: it arrives with HTTP
 * **201**, which `ofetch` resolves rather than rejects, so it is always read by
 * `isTableNotFoundFailure` on a resolved payload and never by this function. It is
 * called out because that is the other café refusal whose status looks like a
 * success, and the two are the same trap from opposite ends — this one is a
 * *rejection* wearing a success status, that one is a *success* carrying a
 * refusal.
 *
 * `fallback` is the sentence for when the payload has none worth showing — the
 * same contract as `parseCafeFailure`, passed through it rather than duplicated.
 *
 * Typed as `unknown` on purpose: in a `catch` the value is genuinely unknown and
 * may be `null`, a thrown string, or an error from a layer below `ofetch` that
 * carries no response at all. Every step narrows instead of casting, so a
 * malformed value answers `null` — the retryable side — instead of throwing inside
 * the handler that is trying to recover.
 */
export function parseCafeError(
  error: unknown,
  fallback: string = GENERIC_REFUSAL,
): CafeFailure | null {
  const status = caughtStatus(error);

  if (status === null) return null;

  const failure = parseCafeFailure(caughtPayload(error), fallback);

  if (!isCafeThrottle(error)) return failure;

  return {
    ...failure,
    // ⚠️ §1.3's client rule: a 429 on a message route carries NO `reason` of its
    // own, and `parseCafeFailure` correctly refuses to guess one — so it is
    // guessed HERE, once, with the rule written down. The global limiter's
    // `ERR_RATE_LIMIT` IS in its body and was already kept.
    reason: failure.reason ?? "ERR_TOO_MANY_REQUESTS",
    // The message routes' 429 body has no `statusCode` either, and the status a
    // caller needs is the one its own fetch rejected with — not a missing one.
    statusCode: status,
  };
}