/**
 * `POST /api/cafe/table/{tableId}/messages/{messageId}/like` →
 * `POST /cafe/table/messages/{tableId}/{messageId}/like` — §9.
 *
 * ## ⚠️ IT IS A TOGGLE, AND THERE IS NO SECOND ENDPOINT
 *
 * §9: there is no dislike API — «disliking» IS un-liking — and §18.5 says the same
 * a second time. So this route takes **no intent parameter**: a caller cannot
 * choose to like or to unlike, only to ask, and the answer says which happened
 * (`liked`, plus `likes` and `likeCount`). That is why the allowlist here is empty
 * on purpose — a body carrying `liked: true` would be ignored by the backend, and
 * a client that believed it worked would draw a like that never happened.
 *
 * `likes` is a **flat array of user ids** (§9, and §7's note that there are no
 * per-emoji reactions in this backend at all): `likeCount` is its `length` and the
 * caller's own state is `likes.includes(myId)`. Nothing in the response is a count
 * the client has to recompute.
 *
 * ## ⚠️ THE IDS ARE REORDERED, AND BOTH ARE GUARDED
 *
 * Same arrangement as `[messageId].put.ts`: the upstream path puts the two ids
 * under a `messages` segment, this route keeps the resource first so Nitro's
 * static-segment precedence can separate it from its own siblings. Both ids are
 * interpolated into that path, so both go through `isResourceId` — `..` is not in
 * its charset, and a `..` is the one spelling the WHATWG parser ofetch joins the
 * path with would resolve to a DIFFERENT endpoint of our own API, carrying this
 * server's `X-Api-Key`.
 *
 * ## ⚠️ NO BODY, AND THAT IS ALSO A GUARD
 *
 * §9: «No body.» `readBody` is therefore never called and the upstream call
 * carries none, so nothing a caller puts in a request to this route can reach the
 * backend. The room broadcast `cafe:table:like-message` is how everyone ELSE hears
 * about it (§9, §14.1) — the actor's own state comes from this response, and §9's
 * dedupe rule is why the two are told apart by `userId`.
 *
 * The 200 answer is returned untouched, and nothing is logged.
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
    )(`/cafe/table/messages/${tableId}/${messageId}/like`, {
      method: "post",
    });
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});
