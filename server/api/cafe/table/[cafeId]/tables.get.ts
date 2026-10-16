import { isCafeBooleanFilter, isCafeSort } from "~/types/cafe";

/**
 * `GET /api/cafe/table/{cafeId}/tables` → the same upstream — one café's tables,
 * with every filter applied BY THE SERVER for a reader too.
 *
 * ## ⚠️ `{cafeId}` IS INTERPOLATED INTO THE UPSTREAM PATH, SO IT IS GUARDED
 *
 * The WHATWG URL parser ofetch uses to join the path onto `apiUrl` still reads
 * `..` (and `%2e%2e`) as a double-dot segment and pops the one before it, so a
 * double-dot in `{cafeId}` walks this request out of `/cafe/table/` onto another
 * endpoint of our own API, carrying this server's `X-Api-Key`. `isResourceId`
 * (`server/utils/resource-id.ts`) has no `.` in its set — see `[cafeId].get.ts`
 * for the rest of the argument.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST
 *
 * The eight documented filters — `page`, `limit`, `status`, `q`, `sort`, `type`,
 * `isActive`, `enabled`, `free` — and nothing else. See `feet.get.ts` for why the
 * caller's whole query set cannot be relayed: unbounded `?limit=1000000`, an
 * unvalidated `sort`, and invented keys that Express's default `qs` turns into
 * Mongo OPERATORS (`?status[$ne]=…`, `?populate=…`).
 *
 * Three of the eight are NARROWED FURTHER rather than merely string-checked,
 * because upstream they are not words either:
 *
 * - **`sort`** decides the direction of a Mongo `$sort`, so only
 *   `"asc" | "desc"` (`isCafeSort`) is relayed.
 * - **`isActive` / `enabled` / `free`** are STRINGS upstream (`'yes' | 'no'`),
 *   and any other value filters on nothing: the whole unfiltered list comes back,
 *   which reads as «the filter does not work» (`isCafeBooleanFilter`).
 * - **`status` / `type` / `q`** are relayed as plain strings and are NOT
 *   narrowed to their unions on purpose: dropping an unrecognised value there
 *   would return the café's whole table list as if the reader had not filtered —
 *   the exact silent failure this route's history is made of. A plain string
 *   cannot become an operator, so forwarding it is the safe direction.
 *
 * An unusable value is DROPPED, not refused, so the upstream default applies.
 *
 * ⚠️ The filters have to travel INSIDE `query`. Spreading them at the top level
 * sent `status`/`q`/`sort`/`type`/`isActive`/`enabled`/`free`/`page`/`limit` as
 * ofetch OPTIONS instead of as a query string, so every one of them was silently
 * dropped and the endpoint answered with the cafe's whole unfiltered table list —
 * which reads as «the filter does not work» and never as a malformed request.
 */
export default defineEventHandler(async (event) => {
  try {
    const cafeId = getRouterParam(event, "cafeId");
    const query = getQuery(event);
    const status = query?.status;
    const q = query?.q;
    const type = query?.type;
    const sort = query?.sort;
    const isActive = query?.isActive;
    const enabled = query?.enabled;
    const free = query?.free;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    // ⚠ THE TRAVERSAL GUARD — a `cafeId` this proxy may not paste into a path.
    if (!isResourceId(cafeId)) return connectionResponseError();

    return await api(event, "access-token")(`/cafe/table/${cafeId}/tables`, {
      query: {
        // ⚠ STRINGS ONLY, so `qs` can never hand the upstream an operator where
        // a filter was meant; and `isCafeSort` / `isCafeBooleanFilter` above are
        // the three filters that are queries rather than words.
        ...(typeof status === "string" && status !== "" && { status }),
        ...(typeof q === "string" && q !== "" && { q }),
        ...(typeof type === "string" && type !== "" && { type }),
        ...(isCafeSort(sort) && { sort }),
        ...(isCafeBooleanFilter(isActive) && { isActive }),
        ...(isCafeBooleanFilter(enabled) && { enabled }),
        ...(isCafeBooleanFilter(free) && { free }),
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});