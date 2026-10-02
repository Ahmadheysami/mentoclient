/**
 * The id a proxy is allowed to interpolate into an upstream URL path.
 *
 * **A CHARSET ALLOWLIST, not "is it there".** `{id}` is pasted into the upstream
 * path — `/panels/shared/modules/goal/${id}/start` — and a `..` segment there
 * resolves to a DIFFERENT endpoint of our own API than the one the proxy exists
 * to expose, reached while carrying this server's `X-Api-Key`. A guard that only
 * checked for presence would forward exactly that.
 *
 * The set is tight because it costs nothing: every identifier this backend mints
 * is either a Mongo `_id` (24 hex) or a uniqid (`A-Za-z0-9_-`), so both live
 * inside `/^[A-Za-z0-9_-]{1,64}$/` and the charset rejects nothing legitimate.
 * What it does reject is every character with meaning in a URL — `.`, `/`, `\`,
 * `%`, `?`, `#` — plus an empty segment and anything long enough to be something
 * other than an id.
 *
 * Refusing here rather than escaping also means the refusal is OURS: an unusable id
 * is answered by `connectionResponseError()` before any request exists, so it never
 * becomes traffic and never reaches the upstream as a path this server assembled.
 *
 * Shared by every proxy that takes an id in its path rather than copied into each:
 * six private copies of "what may be forwarded" are six places for the next route to
 * answer differently, and this is a security boundary, not a per-route preference.
 * It covers `astrology/[id]/single.get.ts`, `goal/[id].delete.ts`,
 * `goal/[id]/messages.get.ts`, `goal/[id]/start.post.ts`,
 * `goal/[id]/start-more-and-review.post.ts` and `goal/message/[id].get.ts`.
 *
 * NOT the same thing as the pinned client-side `ASTROLOGY_REPORT_ID_PATTERN` in
 * `app/types/astrology.ts`, which checks an id BEFORE a request exists so a bad one
 * never becomes traffic. That copy is deliberately duplicated: the client cannot
 * import a server util, and the server check is the authoritative one — it is the
 * boundary that actually matters, and it is repeated here whatever the client sends.
 *
 * Nitro auto-imports this directory, so a route uses this with no import statement —
 * the same as `server/utils/pagination.ts`.
 */

/**
 * The allowed character set. Exported for the client-side mirror's sake only; a
 * route should ask `isResourceId`, so the rule stays in one place.
 */
export const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Whether an untrusted router param is an id this proxy may forward.
 *
 * Typed as `unknown` rather than `string` on purpose: `getRouterParam` hands back
 * `string | undefined`, and a narrowing predicate that took `string` would have to
 * be lied to at the call site to be used at all.
 */
export function isResourceId(value: unknown): boolean {
  return typeof value === "string" && RESOURCE_ID_PATTERN.test(value);
}
