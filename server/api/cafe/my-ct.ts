/**
 * `GET /api/cafe/my-ct` → `GET /cafe/me/my-ct` — the reader's management grants.
 *
 * ## WHY THIS FILE CARRIES NO HTTP-METHOD SUFFIX
 *
 * Every sibling here is `*.get.ts`, and the obvious "fix" is to rename this one.
 * Do not: the router matches a STATIC segment before a placeholder, so
 * `/api/cafe/my-ct` resolves here even though `[cafeId].get.ts` registers
 * `/api/cafe/:cafeId`. Adding the suffix changes nothing today and makes the
 * pair look ambiguous to the next reader — the comment is the fix.
 *
 * ⚠️ `page` is forwarded, and it is NOT a page. The endpoint reads its row count
 * off `page` and its offset off `(page - 1) × page`, so `stores/cafe.ts` sends
 * `page=0` and explains the arithmetic there. `toPage` passes `0` through —
 * `page` 0 is the FIRST page there, not "unset", and a truthiness check on it
 * would silently shift every grant list — while dropping anything that is not a
 * plain decimal integer. ⚠️ `limit` is forwarded through `toLimit` and is **inert
 * upstream** (the controller reads `req.query.page` for its count too), so the
 * `MAX_PAGE_SIZE` clamp cannot truncate this list: the whole-list read the store
 * depends on is carried by `page`, not by `limit`.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST
 *
 * `type`, `page`, `limit` — and nothing else. See `feet.get.ts` for why the
 * caller's whole query set cannot be relayed: unbounded `?limit`, an unvalidated
 * `sort`, and invented keys that Express's default `qs` turns into Mongo
 * OPERATORS (`?type[$ne]=…`). An unusable value is DROPPED, not refused.
 *
 * ⚠️ The query travels INSIDE `query`, as in `table/[cafeId]/tables.get.ts`:
 * spread at the top level, ofetch sends it as OPTIONS and the filter is dropped
 * without a word.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const type = query?.type;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    return await api(event, "access-token")("/cafe/me/my-ct", {
      query: {
        // ⚠ A STRING, so a `?type[$ne]=` can never arrive as a Mongo operator.
        // ⚠ `page` is forwarded even when it is `0` — see the header.
        ...(typeof type === "string" && type !== "" && { type }),
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});