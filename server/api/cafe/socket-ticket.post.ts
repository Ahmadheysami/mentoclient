/**
 * `POST /api/cafe/socket-ticket` → `{ token }` — the one credential the `/cafe`
 * socket needs, and nothing else.
 *
 * ## WHY THIS ROUTE EXISTS AT ALL
 *
 * A Socket.IO handshake puts its credential in JS: `auth` travels in the
 * `CONNECT` packet, so unlike an `Authorization` header added by a server
 * proxy, it is visible to whatever code is running in the page. The session
 * cookie is `httpOnly` and 30 days long, which is the strongest thing this app
 * has, and the whole reason it must not be handed to that layer.
 *
 * `POST /api/auth/check-token` used to echo it back as `{ has, value }`, which
 * put the raw bearer into Nuxt's SSR payload — inlined in the served HTML,
 * readable by any XSS without touching `document.cookie`, and captureable by
 * any cache in front of the app. That field is gone and must stay gone (see
 * the note inside that handler, and `app/stores/auth.ts`); so the socket has to
 * be handed its token through a route of its own, narrow enough to be reviewed
 * as "this file exists to give the café socket a credential and does nothing
 * else".
 *
 * ## ⚠️ THIS IS THE **INTERIM** BRIDGE, NOT THE FIX
 *
 * The real fix is documented in `app/pages/cafe/README.md` ("Continuing from
 * here", step 2): a **short-lived, single-purpose socket ticket**, minted by the
 * backend `Server/` repo and validated by the `/cafe` namespace's own
 * middleware. That endpoint does not exist in the backend this client talks to
 * yet, and that repo is not part of this one — so until it lands, the socket
 * authenticates with the session cookie it would have been given anyway, and
 * this route is the only place that crossing happens.
 *
 * **When the ticket endpoint exists, ONLY THIS FILE changes.** Delete the body
 * below, forward the call to the new endpoint, and everything else in the café
 * slice — the plugin's handshake, the store, the badge — is already written
 * against a token it did not have to know the provenance of.
 *
 * ## WHY AN ABSENT COOKIE IS `200 { token: "" }` AND NOT A 401
 *
 * The plugin must be able to tell three answers apart: «the reader has no
 * session», «our own server could not mint a ticket» and «the socket
 * connected». A `401` here collapses the first two — `$fetch` rejects, and a
 * rejected token fetch that the plugin swallowed would look exactly like a
 * signed-out reader — while an empty string is unambiguous: there is no session
 * to authenticate with, so there is nothing to connect, and the correct thing
 * for the UI to draw is the *disconnected* state, not an error banner.
 *
 * Refusing here would also be the wrong status for a route whose whole contract
 * is "hand me whatever session exists": the signed-out case is a normal answer
 * to that question, and the caller already knows how to answer it.
 *
 * `Cache-Control: no-store` for the same reason `api/settings` sets it: a cached
 * 200 would hand one device's bearer to another. This response is per-request
 * and must never be stored.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, "Cache-Control", "no-store");

  // The literal name, matching every other café proxy in this folder
  // (`feet.get.ts`, `my-ct.ts`, `table/**`) rather than `PARENT_COOKIE` from
  // `server/utils/session.ts`: that constant exists to keep the *panel*
  // proxies' two identities apart, and the café slice has one identity.
  return {
    token: getCookie(event, "access-token") ?? "",
  };
});