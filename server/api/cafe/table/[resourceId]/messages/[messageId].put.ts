/**
 * `PUT /api/cafe/table/{tableId}/messages/{messageId}` →
 * `PUT /cafe/table/messages/{tableId}/{messageId}` — editing one message (§12).
 *
 * ## ⚠️ THE PATH IS **NOT** THE UPSTREAM PATH, AND THAT IS NOT A TYPO HERE
 *
 * The upstream route is `table/messages/:tableId/:messageId` — the two ids sit
 * UNDER a `messages` segment, while this app's own route keeps the resource first
 * (`table/{tableId}/messages/{messageId}`) so that `messages.get.ts`,
 * `messages.post.ts` and this file are siblings under one folder and Nitro's
 * static-segment precedence can tell `/table/messages/{tableId}/seen` apart from
 * `/table/{tableId}/messages` on the segment alone. The ids are therefore
 * REORDERED here, in the one place that knows both shapes, and every caller only
 * ever sees the resource-first URL.
 *
 * ## ⚠️ BOTH IDS ARE INTERPOLATED INTO THE UPSTREAM PATH, SO BOTH ARE GUARDED
 *
 * Two of them, so the `..` argument from `single.get.ts` applies twice: the WHATWG
 * parser ofetch uses to join the path onto `apiUrl` collapses a double-dot
 * segment and pops the one before it, so a traversal in either param would leave
 * `/cafe/table/` and reach a different endpoint of our own API carrying this
 * server's `X-Api-Key`. `isResourceId` (`server/utils/resource-id.ts`) has no `.`
 * in its charset, so neither can be spelled. ⚠️ A message id is NOT one of the
 * load-bearing wire typos — `messageSecunce`, `reaplayTo` and `thubmnail` are
 * payload keys, and this file reads none of them.
 *
 * ## ⚠️ THE BODY IS REBUILT HERE, NEVER RELAYED
 *
 * §12's body is strict and has exactly ONE key: `text`, required, non-empty, max
 * 2000. `body: await readBody(event)` would hand the caller whatever else it sent
 * on a request authenticated with this server's key — so a NEW object is built and
 * only `text` is copied into it.
 *
 * A missing, non-string or over-long `text` is **DROPPED** rather than refused:
 * `{}` is not a valid edit either, so the upstream's own
 * `ERR_VALIDATION` answers, and its Zod message is already Persian and points at
 * the field. Forwarding a truncated string instead would overwrite the reader's
 * own words with a shortened version of them, which is the one outcome that cannot
 * be undone by a retry.
 *
 * Nothing is logged: the body is a reader's own text and both ids name other
 * people's content.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "resourceId");
    const messageId = getRouterParam(event, "messageId");

    // ⚠ THE TWO TRAVERSAL GUARDS — see the header.
    if (!isResourceId(tableId)) return connectionResponseError();
    if (!isResourceId(messageId)) return connectionResponseError();

    const body = await readBody(event);
    const text = toEditText(body?.text);

    return await api(
      event,
      "access-token",
    )(`/cafe/table/messages/${tableId}/${messageId}`, {
      method: "put",
      body: { ...(text !== undefined && { text }) },
    });
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});

/** §12: `text` — required, non-empty, max 2000. */
const MAX_EDIT_TEXT = 2000;

/** A non-empty string of at most 2000 characters; `undefined` drops the key. */
function toEditText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;

  return value.length <= MAX_EDIT_TEXT ? value : undefined;
}
