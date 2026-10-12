import type { ParentStatsResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/stats`
 *
 * Aggregated counters for EVERY child of the parent, and the only source of the
 * figures the overview tray and the card chips print.
 *
 * ⚠ `result.children[]` is a row of FLAT counters carrying `userId` + the two
 * names — not a `{ child, counters }` pair and not a profile. It is joined to
 * `/child/list` by `userId` in the store, and a `ChildProfileDto` is never
 * projected out of it.
 *
 * ⚠ NOT this route's `/child/{childId}/stats`: that one is a single child and
 * carries a profile plus up to 50 raw test-result documents.
 *
 * ⚠ UPSTREAM PATH ORDER: `child.routes.ts` declares `/child/list` and
 * `/child/stats` BEFORE `/child/:childId`, otherwise Express reads `stats` as a
 * `childId`. Both have their own route here for the same reason.
 */
export default defineEventHandler(async (event) => {
  try {
    return (await api(event, PARENT_COOKIE)("/panels/parent/child/stats", {
      method: "get",
    })) as ParentStatsResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
