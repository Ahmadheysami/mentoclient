import { GOAL_DOMAINS, type GoalListResponse } from "~/types/goal";

/**
 * `GET /panels/shared/modules/goal?category=…&page=…&limit=…`
 *
 * Proxy for the category goal LIST. Takes **no id** — the only input is the
 * `category` query, which upstream is a **required `z.enum`** of the six
 * domains, so a request without one is refused as `ERR_VALIDATION`.
 *
 * `category` is checked here against `GOAL_DOMAINS` and the request is refused
 * with this route's own `connectionResponseError()` rather than forwarded. The
 * URL segment of a category page and this query are the same literal string, and
 * forwarding an unknown one would trade a clear client-side refusal for an opaque
 * upstream one. The `some` comparison is the narrowing: the value is an untrusted
 * `string`, and casting it to `GoalDomain` would move the failure to the server.
 *
 * `limit` defaults to the server's own `GOAL_PAGE_SIZE`. The server fetches
 * `limit + 1` rows as a has-more probe and **leaks the extra one**, so the store
 * slices the answer to `GOAL_PAGE_SIZE` and derives `hasNext` from the length
 * BEFORE it filters anything out.
 *
 * `page` and `limit` are read through `toPage` / `toLimit`
 * (`server/utils/pagination.ts`) rather than `Number(...)`: a client must not be
 * able to choose the upstream's page size, and `?limit=abc` must not put the
 * literal `NaN` on the wire. An unusable value is DROPPED so the upstream applies
 * its own default — `page` 0 included, which is the first page, not "unset".
 *
 * NOTE: the server's `panel` filter is commented out upstream, so goals belonging
 * to other panels come back in this list. They are dropped in the store, after
 * the slice.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const category = query?.category;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    if (typeof category !== "string") {
      return connectionResponseError() as GoalListResponse;
    }
    if (!GOAL_DOMAINS.some((domain) => domain === category)) {
      return connectionResponseError() as GoalListResponse;
    }

    return (await api(event, "access-token")("/panels/shared/modules/goal", {
      method: "get",
      // Both are clamped by `server/utils/pagination.ts` before they get here, so
      // an unusable query is simply absent and the upstream default applies.
      query: {
        category,
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    })) as GoalListResponse;
  } catch (err) {
    return connectionResponseError() as GoalListResponse;
  }
});
