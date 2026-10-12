import type { ChildStatsResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/{childId}/stats`
 *
 * One child's counters: the four `counters` figures, plus `testResults`,
 * `tokenUsage` and `balances` arrays that this app types as `unknown[]` and never
 * reads — `testResults` is capped at 50, newest first, with `rawScore` stripped
 * upstream, so there is nothing in it a screen may print.
 *
 * ⚠ **NOT** `GET /panels/parent/{childId}/stats` (`routes.ts:207-217`, the legacy
 * token-graph `graphAndStats`). That route answers `{ success, stats }` with NO
 * envelope and no profile, and the two are easy to confuse because their paths
 * differ by one segment. The child-management route is the one this proxies.
 *
 * `childId` is guarded by `isChildId` before any request exists — see
 * `server/utils/session.ts` for why `isResourceId` cannot be used on it.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}/stats`,
      { method: "get" },
    )) as ChildStatsResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
