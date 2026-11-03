/**
 * The options every upstream call in this project actually uses. Measured, not
 * assumed: `method` 66, `query` 22, `body` 30, `headers` 1, and no call site
 * reaches for `.raw()`, `.native()`, `.stream()` or `.create()` on the result.
 */
export type UpstreamCall = {
  method?: "get" | "post" | "put" | "patch" | "delete";
  query?: Record<string, unknown>;
  // ⚠ `FormData` is here for `/user/avatar` — the one call site that uploads
  // instead of sending JSON. Measured, not assumed.
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
};

/**
 * What `api()` hands back: a plain callable, deliberately NOT `$fetch`'s own type.
 *
 * ⚠️ **`$fetch`'s type is a landmine at this project's size.** Nitro generates
 * `.nuxt/types/nitro-routes.d.ts`, one union member per route, and `$fetch`
 * resolves a request path against that union through a conditional type
 * (`Exclude<R extends … ? … : …>` over `MaxTuple<…>`). The union now spans this
 * project's whole API surface, and the comparison recurses deeper than
 * TypeScript will go: every `$fetch` call raises
 * `TS2321: Excessive stack depth comparing types`. It is a *limit*, not a type
 * error — the route may be perfectly valid, the compiler simply cannot finish
 * the proof.
 *
 * Widening the return to a plain `(path: string, options?) => Promise<unknown>`
 * means the compiler never instantiates that conditional, so **every** call site
 * is clean again — and nothing is actually lost: each caller already asserts the
 * payload shape itself (`as IApiResponse`, `as TResponse`, …) and each validates
 * its own path and params (`isResourceId`, the query/body allowlists). The
 * generated route types were never doing the work here; hand-written guards were.
 */
export type UpstreamFetcher = (path: string, options?: UpstreamCall) => Promise<unknown>;

export const api = (event: any, authorization: string | null = null): UpstreamFetcher => {
  const config = useRuntimeConfig(),
    token: string | null = authorization
      ? (getCookie(event, authorization) as string)
      : null;

  // ⚠ A MISSING `apiUrl` USED TO BE AN OUT-OF-MEMORY CRASH, NOT AN ERROR.
  //
  // `$fetch` in a Nitro handler is bound to `localFetch`, which resolves a
  // RELATIVE url against THIS server (`.output/server/.../nitro.mjs`:
  // `createFetch({ fetch: localFetch })`). So with `baseURL: undefined`,
  // `api(event)('/plan/my-plans')` did not fail — it re-entered this app at
  // `/plan/my-plans`, rendered it through Nuxt SSR, and that render's
  // `plugins/plan.ts` called `/api/plan/my-plans` again. One request therefore
  // recursed until the heap was gone (measured: `FATAL ERROR: Reached heap limit`
  // ~12s after a single `GET /auth`, or ~6s after a single `/api/plan/my-plans`).
  //
  // Refusing here turns that into one loud 500 with a sentence that names the
  // variable to set. Every proxy route already handles a throw
  // (`connectionResponseError()`), so the caller's contract does not change.
  const baseURL = typeof config.apiUrl === "string" ? config.apiUrl.trim() : "";

  if (!baseURL) {
    throw createError({
      statusCode: 500,
      statusMessage: "Upstream is not configured",
      message:
        "NUXT_API_URL is not set, so upstream calls have no base URL. A relative URL would be sent back into this app and recurse.",
    });
  }

  // ⚠ The assertion, not the annotation, is what does the work. Naming the
  // return type is not enough on its own: handing `$fetch.create`'s result to a
  // typed return makes the compiler instantiate the very route-matching
  // conditional that overflows, so `TS2321` moved from the callers into here.
  // Runtime is untouched — this is the same bound fetcher as before.
  return $fetch.create({
    baseURL,
    headers: {
      "X-Api-Key": config.apiKey,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  }) as unknown as UpstreamFetcher;
};

export function connectionResponseError() {
  return {
    success: false,
    statusCode: 500,
    reason: "ERR_NET_CONNECTION",
    message: "خطای غیر منتظره رخ داده است",
  };
}

/**
 * The HTTP status an upstream answer actually carried, or `null` when the
 * request never got one.
 *
 * `FetchError` DECLARES `response` on its class, so on a transport failure the
 * property is present and `undefined` (`<no response> fetch failed`). Testing
 * for the property's *presence* would therefore read every dropped connection
 * as a server answer; the narrowing below is on the *value*, twice — `object`
 * for the response, `number` for the status. Every step narrows instead of
 * casting, so a malformed value answers `null` — the transport side — rather
 * than throwing inside the very handler that is trying to recover.
 *
 * Typed `unknown` on purpose: in a `catch` the value is genuinely unknown and
 * may be `null`, a thrown string, or an error from a layer below `ofetch` that
 * carries no `response` at all.
 */
export function upstreamStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("response" in err)) {
    return null;
  }

  const { response } = err;

  if (typeof response !== "object" || response === null || !("status" in response)) {
    return null;
  }

  const { status } = response;

  return typeof status === "number" ? status : null;
}

/**
 * The upstream throttled us — HTTP **429** with a *minimal* body (§15), which is
 * why it cannot be read out of a payload and has to be read out of the status.
 *
 * This is a distinct fact from a transport failure and deserves a distinct
 * reason: the café client branches on `body.reason`, and answering
 * `ERR_NET_CONNECTION` here would tell the reader «اتصال اینترنت را بررسی کنید»
 * — a diagnostic that sends them to their Wi-Fi instead of telling them to slow
 * down for a few seconds. The status is carried through as `429` so a caller that
 * inspects it sees the truth about what happened upstream.
 */
export function throttledResponseError() {
  return {
    success: false,
    statusCode: 429,
    reason: "ERR_TOO_MANY_REQUESTS",
    message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  };
}

/**
 * The one `catch` for an upstream café call: the throttle reason if the upstream
 * throttled us, otherwise the transport refusal.
 *
 * Reading the status instead of assuming it is the whole point — a blanket
 * `connectionResponseError()` is *correct* for every failure except this one, and
 * exactly one swallowed fact per failure mode is the kind of thing that survives
 * review for years.
 */
export function upstreamResponseError(err: unknown) {
  return upstreamStatus(err) === 429 ? throttledResponseError() : connectionResponseError();
}
