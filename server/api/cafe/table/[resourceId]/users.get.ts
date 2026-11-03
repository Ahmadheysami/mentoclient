/**
 * `GET /api/cafe/table/{tableId}/users` → `GET /cafe/table/{tableId}/users` — the
 * roster of one table (its active members), which is what the thread screen's
 * «اعضای فعال» sheet, presence marks and sender names are drawn from (§4, §7).
 *
 * ## ⚠️ `{tableId}` IS INTERPOLATED INTO THE UPSTREAM PATH, SO IT IS GUARDED
 *
 * The same double-dot argument `table/[resourceId]/[tableId]/single.get.ts` writes out:
 * ofetch joins the path onto `apiUrl` through `new URL()`, whose WHATWG parser
 * collapses a `..` segment — so a traversal spelled in this param would walk the
 * request out of `/cafe/table/` and onto another endpoint of our own API, carrying
 * this server's `X-Api-Key`. `isResourceId` has no `.` in its charset, so the
 * spelling is impossible rather than merely filtered.
 *
 * ## ⚠️ NO QUERY IS FORWARDED, BECAUSE THE ENDPOINT HAS NO QUERY
 *
 * §4 lists `params` and nothing else for the table routes, and this is a *member
 * list*, not a paginated collection: relaying `getQuery(event)` would put
 * `?limit=100000` and `?role[$ne]=banned` — a Mongo operator, per `qs` — on a
 * request whose backend has no filter to apply them to. A key nobody read here is
 * a key nobody reviewed, so the allowlist is empty and the answer is upstream's
 * whole member set.
 *
 * ## ⚠️ AN EMPTY `users` ARRAY IS **NOT** AN ERROR
 *
 * This endpoint answers `{ success: true, users: [] }` to a reader who is not a
 * member, and "no members" and "not allowed to look" are then the SAME answer. The
 * body is returned untouched for exactly that reason: this route must not add an
 * emptiness check of its own, because there is no fact here for it to check. The
 * screen is the only place that knows whether an empty list means a table nobody is
 * in or a table the reader may not see, and `ICafeUsersResponse` is what hands it
 * both possibilities as one value.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "resourceId");

    // ⚠ THE TRAVERSAL GUARD — see the header.
    if (!isResourceId(tableId)) return connectionResponseError();

    return await api(event, "access-token")(`/cafe/table/${tableId}/users`);
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});
