/**
 * `DELETE /api/cafe/table/{tableId}/messages/{messageId}` →
 * `DELETE /cafe/table/messages/{tableId}/{messageId}` — deleting one message
 * (§13). The deletion is **SOFT**: upstream flips `status` to `"deleted"` and the
 * document stays, which is why the client tombstone rule in `ICafeTableMessage`
 * (`status` is a state, not a filter) is a rendering rule and not a filter.
 *
 * ## ⚠️ THE IDS ARE REORDERED, AND BOTH ARE GUARDED
 *
 * Same arrangement as `[messageId].put.ts` — the upstream path puts the two ids
 * under a `messages` segment, this app's route keeps the resource first so Nitro's
 * static-segment precedence can separate it from
 * `/table/messages/{tableId}/seen` — and the same reason it is done in the proxy:
 * a caller must never have to know two URL shapes for one action.
 *
 * Both ids are interpolated into that path, so both go through `isResourceId`: the
 * WHATWG parser ofetch joins the path with collapses a `..` segment, and this
 * server's `X-Api-Key` is on the request that would walk out of `/cafe/table/`.
 *
 * ## ⚠️ NO BODY IS READ, AND NO BODY IS FORWARDED
 *
 * §13: «No body.» That is a decision, not an omission. A `DELETE` that relayed
 * whatever JSON arrived would carry the caller's document onto a request the
 * upstream does not read — dead weight on the wire at best — so `readBody` is never
 * called and the upstream call has no `body` option at all. A route that cannot be
 * talked into forwarding an unknown key is the cheapest kind of mass-assignment
 * guard there is.
 *
 * The 200 answer is returned untouched: `data` is `{ tableId, messageId }`, and
 * the room broadcast `cafe:table:delete-message:response` is what the OTHER
 * members of the table learn from — this call is only the actor's half.
 *
 * Nothing is logged: neither id nor the bearer appears in a log line.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "resourceId");
    const messageId = getRouterParam(event, "messageId");

    // ⚠ THE TWO TRAVERSAL GUARDS — see the header.
    if (!isResourceId(tableId)) return connectionResponseError();
    if (!isResourceId(messageId)) return connectionResponseError();

    return await api(
      event,
      "access-token",
    )(`/cafe/table/messages/${tableId}/${messageId}`, { method: "delete" });
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});
