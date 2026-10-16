/**
 * `GET /api/cafe/{cafeId}` → `GET /cafe/{cafeId}/single` — one café.
 *
 * ## ⚠️ `{cafeId}` IS INTERPOLATED INTO THE UPSTREAM PATH, SO IT IS GUARDED
 *
 * h3 does not decode a router param — `%2F` cannot smuggle a segment in — but
 * the WHATWG URL parser ofetch uses to join the path onto `apiUrl` still reads
 * `..` (and `%2e%2e`) as a double-dot segment and pops the one before it. So
 * `GET /api/cafe/..` reaches `GET {apiUrl}/single` while carrying this server's
 * `X-Api-Key`.
 *
 * `isResourceId` (see `server/utils/resource-id.ts`) has no `.` in its set at
 * all, which is the other half of the pair the café store already writes:
 * `app/stores/cafe.ts` `encodeURIComponent`s every id it sends, and this is
 * where an id arrives that was not built by that store.
 */
export default defineEventHandler(async (event) => {
  try {
    const cafeId = getRouterParam(event, "cafeId");

    // ⚠ THE TRAVERSAL GUARD — a `cafeId` this proxy may not paste into a path.
    if (!isResourceId(cafeId)) return connectionResponseError();

    return await api(event, "access-token")(`/cafe/${cafeId}/single`);
  } catch (err) {
    return connectionResponseError();
  }
});