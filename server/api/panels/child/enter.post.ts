import type { ChildLoginInput, ChildLoginResponse } from "~/types/child-panel";

/**
 * `POST /panels/parent/child/login`
 *
 * ## ⚠ THE ONLY ENDPOINT HERE THAT IS NOT BEHIND `auth` — BECAUSE IT IS WHAT MINTS THE TOKEN
 *
 * Upstream declares it with `accessToRoutes`, a 30/min rate limiter and no `auth`
 * (`child.routes.ts:88-95`), so this proxy must call `api(event, null)`: handing
 * `api` a cookie name would only produce a `Bearer` header upstream discards, and
 * a parent cookie here would suggest a session this route does not have.
 *
 * ## THE TOKEN IS COOKIED HERE AND THEN REMOVED FROM THE BODY
 *
 * Mirroring `server/api/auth/verify.post.ts`: the `accessToken` is written into
 * `child-access-token` and then DELETED from the response, so the JWT never
 * reaches the browser's JavaScript on a device the whole family shares. The cookie
 * options are `verify.post.ts`'s exactly — `httpOnly`, `sameSite: 'lax'`, `path: '/'`,
 * `secure: false` over http on :3001 — with `maxAge` set to `2 * 60 * 60` because
 * h3/cookie-es serialize `maxAge` in **seconds**, matching the child JWT's own 2h
 * TTL so the cookie and the credential it holds die together instead of the
 * cookie outliving a dead token.
 *
 * The body is re-shaped to `{ code }`: whatever else a caller sends is not
 * forwarded, and `code` itself is upstream's to validate (`childLoginSchema` is
 * `/^\d{11}$/`). A wrong code is answered with `ERR_CHILD_ACCESS_INVALID`, not a
 * 500 — this route must stay a normal refusal so the ENTER form can print it.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Partial<ChildLoginInput>>(event);

    /** The upstream payload as it arrives HERE — `accessToken` is still on it. */
    const response = (await api(event, null)("/panels/parent/child/login", {
      method: "post",
      body: { code: body?.code },
    })) as {
      success?: boolean;
      statusCode?: number;
      message?: string;
      reason?: string;
      result?: { userId: string; accessToken?: string };
    };

    if (response?.success && response?.result?.accessToken) {
      setCookie(event, CHILD_COOKIE, response.result.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 2 * 60 * 60,
        secure: false,
      });
    }

    // Mirrors `verify.post.ts:32-33`: the credential leaves in the cookie header,
    // never in a body a child panel could read or a proxy could log.
    if (response?.result) delete response.result.accessToken;

    return response as ChildLoginResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
