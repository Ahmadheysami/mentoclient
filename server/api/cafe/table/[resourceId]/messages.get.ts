import { isCafeMessagesDirection } from "~/types/cafe";

/**
 * `GET /api/cafe/table/{tableId}/messages` → `GET /cafe/table/{tableId}/messages`
 * — one page of one conversation's history.
 *
 * ## ⚠️ `{tableId}` IS INTERPOLATED INTO THE UPSTREAM PATH, SO IT IS GUARDED
 *
 * h3 does not decode a router param — `%2F` cannot smuggle a segment in — but the
 * WHATWG URL parser ofetch uses to join the path onto `apiUrl` still reads `..`
 * (and `%2e%2e`) as a double-dot segment and pops the one before it, walking this
 * request out of `/cafe/table/` and onto a different endpoint of our own API,
 * carrying this server's `X-Api-Key`. `isResourceId`
 * (`server/utils/resource-id.ts`) has no `.` in its charset, so no traversal can
 * be spelled in this param at all.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST, NOT `...getQuery(event)`
 *
 * Three documented parameters, named here, and nothing else. Relaying the
 * caller's whole query set hands a Mongo OPERATOR to a backend that cannot use
 * it: `?cursor[$gt]=0` is parsed by Express's default `qs` into
 * `{ cursor: { $gt: 0 } }` — a filter, smuggled past a proxy that only ever
 * meant to relay a number. The reasoning is written once, in `feet.get.ts`.
 *
 * - **`cursor` is coerced to a finite integer ≥ 0.** A `cursor` is a message
 *   `sequence`, so it is a number or it is nothing: `?cursor=abc` must not put
 *   `NaN` on the wire, and `?cursor[$gt]=0` must not put an object there either.
 *   ⚠️ An unusable value is **DROPPED, not refused** — and dropping it is not
 *   «show the first window», it is a *different* window: with no `cursor` the
 *   upstream starts from **the reader's own `lastReadMessageId`** (§15), which is
 *   the documented behaviour for a first load and would silently replace an
 *   «older history» request with a read-receipt-relative one. Same trade as
 *   `toLimit`: refusing would turn a hand-typed query into a failure of a screen
 *   that is otherwise fine.
 * - **`direction` is narrowed to its documented pair** (`isCafeMessagesDirection`)
 *   rather than merely string-checked, because it is the branch a history read
 *   takes — `old` prepends, `new` appends — and a third value is not a default,
 *   it is the opposite of what was asked for.
 * - **`loadAll` is the LITERAL STRING `"1"` (or `"true"`), not a truthiness
 *   test.** §15 says "any truthy value" raises the batch cap from 15 to 500, and
 *   that is exactly why it is matched by hand here: `?loadAll[$ne]=` is an object
 *   (truthy, and a Mongo operator), and a boolean `true` — which is what
 *   `ICafeMessagesQuery.loadAll?: boolean` serialises to — has to be recognised as
 *   well or the «load all history» control would silently keep asking for 15.
 *   `""` is deliberately NOT in the set: upstream's own truthiness check treats it
 *   as absent, so forwarding nothing here is what it would have done anyway.
 *
 * ## ⚠️ THE ANSWER IS RETURNED UNTOUCHED, AND THAT IS LOAD-BEARING
 *
 * This is the one café success that carries **no `success` field** — a real page
 * is `{ messages, hasMore, nextCursor }`, and `isCafeSuccess()` answers `false`
 * for it. Its refusal for a closed table is HTTP **201** with
 * `{ messages: [], success: true, reason: "INFO_TABLE_NOT_FOUND" }`, so the status
 * is a success and the payload is a refusal, and re-wrapping either one here would
 * destroy the only signal that separates «this conversation has no messages yet»
 * from «this table is closed». Read it with `isCafeMessagesPayload()` +
 * `isTableNotFoundFailure()` in `~/utils/cafe-response`; both are the reason that
 * module exists.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "resourceId");
    const query = getQuery(event);
    const direction = query?.direction;
    const cursor = toCursor(query?.cursor);
    const loadAll = query?.loadAll;

    // ⚠ THE TRAVERSAL GUARD — see the header. It also refuses `undefined`, which
    // is what a request with no `resourceId` router param at all arrives with.
    if (!isResourceId(tableId)) return connectionResponseError();

    return await api(event, "access-token")(`/cafe/table/${tableId}/messages`, {
      query: {
        ...(isCafeMessagesDirection(direction) && { direction }),
        ...(cursor !== undefined && { cursor }),
        ...((loadAll === "1" || loadAll === "true") && { loadAll }),
      },
    });
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});

/**
 * A `cursor` this proxy may forward: a plain decimal integer, or nothing.
 *
 * ⚠️ **NOT `toPage` / `toLimit`.** `server/utils/pagination.ts` exists for a
 * `page`/`limit` pair, where a figure above the cap is clamped and a page index
 * 0 is a real page; a `cursor` is neither. It is a message `sequence`, so the
 * question is only «is this a non-negative integer I can put on the wire without
 * lying to the upstream» — and anything else must NOT be forwarded, because a
 * `NaN`, a float or an object there is not a default the upstream applies, it is
 * a comparison it has to guess at.
 *
 * Typed as `unknown` because `getQuery` hands back `string | string[] | …` for a
 * key nobody controlled, and `?cursor=1&cursor=2` arrives as an ARRAY: the
 * charset test refuses it, which is the right answer for a cursor that cannot be
 * both numbers at once.
 */
function toCursor(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }

  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) return undefined;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
