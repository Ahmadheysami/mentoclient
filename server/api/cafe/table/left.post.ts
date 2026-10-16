/**
 * `POST /api/cafe/table/left?tableId=…` → `POST /cafe/table/{tableId}/left` —
 * leaving one conversation. Proxied but NOT called from anywhere in this repo
 * (see `app/pages/cafe/README.md`); it is wired with the membership wave.
 *
 * ## ⚠️ THE ID IS IN THE **QUERY**, SO IT IS GUARDED
 *
 * `getQuery()` percent-decodes, so
 * `POST /api/cafe/table/left?tableId=..%2F..%2F..%2Fuser%2Fdelete` arrives here
 * as `../../../user/delete`. ofetch then joins that onto the upstream
 * `apiUrl` through `new URL()`, and the WHATWG parser **collapses the dot
 * segments** — so this server issues `POST {apiUrl}/user/delete` carrying its
 * own `X-Api-Key`. And `api()` attaches that key whether or not a cookie was
 * presented, so an unauthenticated caller who finds this route can reach it too.
 * `isResourceId` (see `server/utils/resource-id.ts`) is the only thing between
 * a hand-typed query and the backend's other endpoints: it rejects `.`, `/`, `%`
 * outright, so no traversal can be spelled here at all.
 *
 * ## WHY THE ID IS NOT A ROUTER PARAM
 *
 * `table/[tableId]/left.post.ts` is the shape upstream has and it would be
 * tidier — but it MOVES this route, and `/api/cafe/table/left?tableId=…` is a
 * URL this server publishes today. A rename is not a security fix, so it is
 * scheduled with the membership wave that is going to call the route; the guard
 * is what makes it safe until then.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const tableId = query?.tableId;

    // ⚠ THE TRAVERSAL GUARD — see the header. Also refuses a repeated
    // `?tableId=a&tableId=b`, which arrives as an array rather than a string.
    if (!isResourceId(tableId)) return connectionResponseError();

    return await api(event, "access-token")(`/cafe/table/${tableId}/left`, {
      method: "post",
    });
  } catch (err) {
    return connectionResponseError();
  }
});