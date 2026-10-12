import type { AccessCodeIssuedResponse } from "~/types/parent-panel";

/**
 * `POST /panels/parent/child/{childId}/access-code`
 *
 * Issue a FRESH code, replacing any existing one — upstream `$set`s `minorCode` to
 * a newly generated value, so the previous code stops working immediately and any
 * session it minted dies on the child's next request.
 *
 * ⚠ The reply is a BARE `{ accessCode }`: there is no `userId` in it
 * (`child.services.ts:346-363`), unlike `POST /child/create`. The store already
 * holds the `userId` it sent, so nothing is missing — and this proxy must not
 * synthesise the field to make the two replies match.
 *
 * ⚠ This and `POST /child/create` are the ONLY responses in the panel that carry a
 * code VALUE. The envelope is returned raw so the store can show it once and never
 * ask again; upstream stores the code hashed away from every list projection.
 *
 * `childId` is guarded by `isChildId` before any request exists — see
 * `server/utils/session.ts` for why `isResourceId` cannot be used on it.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}/access-code`,
      { method: "post" },
    )) as AccessCodeIssuedResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
