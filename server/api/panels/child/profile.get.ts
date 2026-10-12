import type { ChildProfileResponse } from "~/types/child-panel";

/**
 * `GET /panels/parent/child/profile`
 *
 * ## THIS IS ALSO THE CHILD SESSION PROBE
 *
 * It is the only route upstream guards with `minorRoles: ['child']` + `childAuth`
 * (`child.routes.ts:118-123`), so it is the one request the `child-panel`
 * middleware can make to learn both whether the session is usable and who it
 * belongs to. Every refusal comes back as a machine `reason`
 * (`ERR_TOKEN_INVALID`, `ERR_CHILD_ACCESS_REVOKED`, `ERR_CHILD_ACCOUNT_DISABLED`,
 * `ERR_ACCESS_CLOSED`, `ERR_ACCESS_DENIED`), which is why the envelope is returned
 * **raw** and never narrowed here: the store branches on those words, and a proxy
 * that rewrote them would be the only thing standing between a child's session and
 * a guessed one.
 *
 * ⚠ `ERR_ACCESS_CLOSED` is a 400, NOT a logout — it means the parent's schedule is
 * shut for now and the session is still valid. It must survive this proxy intact.
 *
 * The cookie is `child-access-token` and nothing else: a parent cookie handed to
 * this route yields 401 rather than an escalation, because the identity is decided
 * by which cookie the request carries.
 */
export default defineEventHandler(async (event) => {
  try {
    return (await api(event, CHILD_COOKIE)("/panels/parent/child/profile", {
      method: "get",
    })) as ChildProfileResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
