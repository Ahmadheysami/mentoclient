/**
 * Which cookie a proxy reads a session token from.
 *
 * This app has two identities that meet on ONE device — a parent and a child of
 * that parent — and they must be able to be signed in at the same time. So the
 * cookie NAME is the whole of this file: `api(event, name)`
 * (`server/utils/api.ts`) reads whichever name it is handed and forwards it as
 * `Authorization: Bearer …`, and upstream never sees the cookie name at all.
 * Two names therefore cost nothing on the wire and remove the collision
 * entirely.
 *
 * Shared by every proxy under `server/api/panels/**` rather than copied into each:
 * the pair of names IS the identity separation, and two private copies of it are
 * two places for the next route to answer differently. Nitro auto-imports this
 * directory, so a route uses these with no import statement — the same as
 * `server/utils/pagination.ts` and `server/utils/resource-id.ts`.
 */

/** The adult's session. Every existing proxy already reads this one. */
export const PARENT_COOKIE = "access-token";

/** ⚠ NOT 'access-token'. A child token is a normal JWT with name:'access-token'
 *  (child.services.ts:454-461), so writing it into the SAME cookie makes the parent and child
 *  sessions mutually exclusive on one device. Upstream never sees the cookie NAME — api(event, name)
 *  just reads whichever name you hand it — so a second name costs nothing and removes the collision. */
export const CHILD_COOKIE = "child-access-token";

/** `scope=child` is a REQUEST selector, never a claim. A parent cookie here yields 401, not escalation. */
export function sessionCookie(scope: unknown): string {
  return scope === "child" ? CHILD_COOKIE : PARENT_COOKIE;
}

/** ⚠ A child userId is uniqId('lvl2.', UNIQID_SUFFIX) → TWO '.' separators
 *  (UNIQID_SUFFIX='.mntya'), so it is REJECTED by RESOURCE_ID_PATTERN
 *  (server/utils/resource-id.ts). isResourceId must not be used for it — it would refuse
 *  EVERY child. Narrow on the 'lvl2.' prefix, permissive on both tail segments: excludes
 *  `. / \ % ? #` and whitespace between segments, so it cannot escape a URL path, and cannot
 *  reject a real id whose UNIQID_SUFFIX charset is an env value this repo does not control.
 *  VERIFY against one real userId before merge. */
export const CHILD_ID_PATTERN = /^lvl2\.[A-Za-z0-9_-]{1,80}(?:\.[A-Za-z0-9_-]{1,32})?$/;
export function isChildId(value: unknown): value is string {
  return typeof value === "string" && CHILD_ID_PATTERN.test(value);
}
