import type { ChildTestsResponse } from "~/types/child-panel";

/**
 * `GET /test/tests/purchases-test?done=…` — the exams assigned to this child.
 *
 * ⚠ IRREGULAR #3: the answer is HTTP 201 with a **singular** `test` key, no
 * `statusCode` and no `message`, and `test` is null-able (the find uses an
 * lvl-dependent spread even though `checkAccesss` guarantees lvl ∈ [1,2,3]). It is
 * returned **raw** so `state.test ?? []` in the store is reading the real shape
 * rather than one this proxy invented.
 *
 * ## NO PAGINATION
 *
 * Upstream takes only `done` here and answers unpaginated, so there is nothing for
 * `toPage`/`toLimit` (`server/utils/pagination.ts`) to guard: forwarding a whole
 * `{...query}` would put `page` and `limit` on the wire as keys the contract does
 * not define. Only `done` crosses, and only when present.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event),
      done = query?.done;

    return (await api(event, CHILD_COOKIE)("/test/tests/purchases-test", {
      method: "get",
      query: { ...(done && { done }) },
    })) as ChildTestsResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
