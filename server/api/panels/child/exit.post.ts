/**
 * `POST /api/panels/child/exit` — **no upstream call at all.**
 *
 * ## WHY THIS IS NOT `DELETE /api/auth/remove-cookie`
 *
 * `server/api/auth/remove-cookie.delete.ts` deletes whichever cookie the CALLER
 * names in its own body. That is a generic cookie-deletion primitive, and a child
 * screen driving it is a CSRF-adjacent way to clear an arbitrary cookie on the
 * family device. This route names the one cookie it is allowed to delete, so the
 * capability is exactly the capability that is intended.
 *
 * ## WHY THE NAME MATTERS FOR THE DEVICE
 *
 * Only `child-access-token` is removed. A parent signed in on the same device is
 * untouched — that separation is the entire reason the child session has its own
 * cookie name (`server/utils/session.ts`).
 *
 * The envelope is written here rather than taken from upstream because there is
 * no upstream: this is a local state change, and the caller gets the same
 * `{ success, statusCode }` every other proxy answers a success with.
 */
export default defineEventHandler(async (event) => {
  try {
    deleteCookie(event, CHILD_COOKIE);

    return { success: true, statusCode: 200 };
  } catch (err) {
    return connectionResponseError();
  }
});
