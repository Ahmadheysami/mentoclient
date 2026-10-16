/**
 * `GET /api/cafe/feet` → `GET /cafe/cafes/feet` — the two recommended lists.
 *
 * ## ⚠️ THE UPSTREAM QUERY IS A LITERAL ALLOWLIST, NOT `...getQuery(event)`
 *
 * Relaying the caller's whole query set hands three things to a backend that
 * cannot use them and this server cannot afford:
 *
 * - **an unbounded figure.** `?limit=1000000` is passed straight through, so the
 *   caller — not this server's own pagination — decides how many documents the
 *   upstream reads, counts and serialises for one request.
 * - **an unvalidated `sort`.** Upstream it reaches a Mongo `$sort`, so it is not
 *   a word but a query.
 * - **invented keys.** `?status[$ne]=…` or `?populate=…` are query-string
 *   spellings of a Mongo OPERATOR, because Express's default `qs` parses them
 *   into `{ status: { $ne: … } }` — a caller smuggling a filter past a proxy that
 *   only ever meant to relay three documented parameters.
 *
 * So the three documented parameters (`q`, `page`, `limit`) are named here and
 * nothing else is forwarded: a key nobody read here is a key nobody reviewed.
 * `page` / `limit` go through `toPage` / `toLimit`
 * (`server/utils/pagination.ts`) so a client cannot choose the upstream's page
 * size and `?limit=abc` cannot put a literal `NaN` on the wire. **An unusable
 * value is DROPPED, not refused** — the upstream contract has its own defaults
 * for a missing filter, and inventing a client-side error would turn a
 * hand-typed query into a failure the upstream never needed to see.
 *
 * The same allowlist decision is repeated per route in `my-ct.ts`,
 * `table/q.get.ts`, `table/subscribed.get.ts` and
 * `table/[cafeId]/tables.get.ts`; this is where the reasoning is written once.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const q = query?.q;
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    return await api(event, "access-token")("/cafe/cafes/feet", {
      query: {
        // ⚠ A STRING, and only a non-empty one: `qs` turns `?q[$ne]=` into an
        // operator object, and an empty term is not a filter at all.
        ...(typeof q === "string" && q !== "" && { q }),
        ...(page !== undefined && { page }),
        ...(limit !== undefined && { limit }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});