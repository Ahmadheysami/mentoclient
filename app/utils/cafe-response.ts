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