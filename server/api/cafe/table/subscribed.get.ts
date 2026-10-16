import { isCafeSort } from "~/types/cafe";

/**
 * `GET /api/cafe/table/subscribed` → the same upstream — every conversation the
 * reader is an active member of, with its unread badge.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST
 *
 * `page`, `limit`, `sort` — and nothing else. See `feet.get.ts` for why the
 * caller's whole query set cannot be relayed: unbounded `?limit`, an unvalidated
 * `sort`, and invented keys that Express's default `qs` turns into Mongo
 * OPERATORS (`?page[$gt]=…`). An unusable value is DROPPED, not refused.
 *
 * ⚠️ `sort` is the one value narrowed to its documented pair (`asc` | `desc`,
 * `isCafeSort`) rather than merely string-checked: upstream it decides the
 * direction of a Mongo `$sort`, so it is a query and not a word. `isCafeSort`
 * lives beside `CafeSort` in `~/types/cafe` for the reason `isGoalDomain` lives
 * beside `GOAL_DOMAINS`.
 *
 * ⚠️ ONE LARGE PAGE, AND THE CLAMP IS NOT THE BUG. The upstream puts `$limit`
 * BEFORE `$skip` and feeds `$skip` the page NUMBER, so page 2 repeats page 1
 * and server-side paging can never be walked (`stores/cafe.ts` documents it).
 * The store therefore asks for one large page — `LARGE_PAGE_SIZE`, which is this
 * same figure as `MAX_PAGE_SIZE` — so `toLimit`'s cap cannot turn this route into
 * a shorter page than the store asked for. ⚠️ Do NOT "fix" that by paginating
 * properly: a second page does not exist, so a smaller page silently drops the
 * tail of «my conversations» and there is nothing to notice it with.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const sort = query?.sort;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    return await api(event, "access-token")("/cafe/table/subscribed", {
      query: {
        ...(isCafeSort(sort) && { sort }),
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});