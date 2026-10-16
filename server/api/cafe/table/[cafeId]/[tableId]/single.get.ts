/**
 * `GET /api/cafe/table/{cafeId}/{tableId}/single` → the same path upstream —
 * one conversation.
 *
 * ## ⚠️ BOTH PARAMS ARE INTERPOLATED INTO THE UPSTREAM PATH, SO BOTH ARE GUARDED
 *
 * h3 does not decode a router param — `%2F` cannot smuggle a segment in — but
 * the WHATWG URL parser ofetch uses to join the path onto `apiUrl` still reads
 * `..` (and `%2e%2e`) as a double-dot segment and pops the one before it. So a
 * double-dot in either param walks this request out of `/cafe/table/` and onto
 * a different endpoint of our own API — carrying this server's `X-Api-Key`.
 *
 * `isResourceId` (see `server/utils/resource-id.ts`) has no `.` in its set, and
 * it is the other half of the pair `app/stores/cafe.ts` already writes: that
 * store `encodeURIComponent`s every id it sends, so this guard is where an id
 * that did NOT come from that store is stopped.
 */
export default defineEventHandler(async (event) => {
  try {
    const cafeId = getRouterParam(event, "cafeId");
    const tableId = getRouterParam(event, "tableId");

    // ⚠ THE TRAVERSAL GUARDS — neither value may reach the upstream path unproven.
    if (!isResourceId(cafeId)) return connectionResponseError();
    if (!isResourceId(tableId)) return connectionResponseError();
    const response = await api(event, "access-token")(
      `/cafe/table/${cafeId}/${tableId}/single`,
    );

    return response
  } catch (err) {
    return connectionResponseError();
  }
});