import type { AccessRevokedResponse } from "~/types/parent-panel";

/**
 * `DELETE /panels/parent/child/{childId}/access-code/revoke`
 *
 * ## NO BODY IS SENT, AND NONE IS READ
 *
 * Upstream takes the child from the path, so a body here would be forwarded
 * nothing. There is also a SECOND upstream route that does this same job — a
 * `DELETE /child/access-code` taking `{ childId }` in the body
 * (`child.routes.ts:183-189`). It is deliberately not proxied: two routes doing
 * one job are two things to keep in sync, and the path form needs no body at all.
 *
 * ## WHY OUR PATH DOES NOT END IN `/revoke`
 *
 * The Nitro file suffix already IS the verb — `access-code.delete.ts` — so the
 * segment upstream adds to disambiguate its own two routes is redundant here and
 * would only invite the two to be confused.
 *
 * The write is `minorCode: null`, and `auth` re-checks that on EVERY request, so a
 * revoke lands on the child's very next call without anything polling for it. The
 * reply's `result` is `null`; it is returned raw rather than reshaped into a
 * success-only literal, so the store reads the upstream `message` and `reason`
 * the same way it reads every other proxy's.
 *
 * `childId` is guarded by `isChildId` before any request exists — see
 * `server/utils/session.ts` for why `isResourceId` cannot be used on it.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}/access-code/revoke`,
      { method: "delete" },
    )) as AccessRevokedResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
