/**
 * `GET /api/cafe/table/q` → `GET /cafe/table/q` — quick table search.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST
 *
 * `text`, `page`, `limit`, `cafeId` — and nothing else. See `feet.get.ts` for why
 * the caller's whole query set cannot be relayed: unbounded `?limit`, an
 * unvalidated `sort`, and invented keys that Express's default `qs` turns into
 * Mongo OPERATORS (`?text[$regex]=…`).
 *
 * ⚠️ `cafeId` is forwarded but is **not** a filter this endpoint reads — its
 * query is `text` / `page` / `limit` — so narrowing to one café is the caller's
 * job, client-side, over the returned rows. It is relayed as a plain string so
 * it cannot become an operator.
 *
 * ⚠️ `text` is REQUIRED, and a request without it is REFUSED rather than
 * forwarded: upstream answers `result: null` (not `[]`) for it, which reaches a
 * screen as a search that found nothing when the truth is that no question was
 * asked. Same treatment as a missing required enum in
 * `server/api/goal/index.get.ts`.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const text = query?.text;
    const cafeId = query?.cafeId;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    if (typeof text !== "string" || text === "") return connectionResponseError();

    return await api(event, "access-token")("/cafe/table/q", {
      query: {
        // ⚠ The required term, guarded above: an empty or non-string `text`
        // upstream is a `result: null`, which reads as «nothing matched».
        text,
        ...(typeof cafeId === "string" && cafeId !== "" && { cafeId }),
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});