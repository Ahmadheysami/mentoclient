/**
 * The café data layer: eight independent resources behind one `CafeResult`, and
 * the six screens under `app/pages/cafe/` read every café row through this store.
 * It is the only place a café request is made — the Nitro proxies under
 * `server/api/cafe/` are the transport, `~/types/cafe` is the contract, and
 * `~/utils/cafe-response` is the one reader of the envelope. (Before this store
 * the screens read `utils/cafe-mock.ts`, a hardcoded fixture; it is deleted.)
 *
 * ## THREE RULES THIS FILE EXISTS TO ENFORCE
 *
 * 1. **`useRequestFetch()`, never a bare `$fetch`.** A plain `$fetch('/api/…')`
 *    during SSR reaches our own Nitro route with **no cookie** — the trap
 *    `middleware/child-panel.ts` and `plugins/plan.ts` both document, where the
 *    store quietly stays empty and the screen renders its empty state as if the
 *    reader had no cafés at all. Every action below takes the fetcher from
 *    `useRequestFetch()` **synchronously, at the top of the action**, for the
 *    same reason those two files do it: the composable reads the request event
 *    out of the Nuxt context, and the context is only certainly present while
 *    the action is still on its first line.
 * 2. **200 IS NOT SUCCESS.** `expressErrorHandler` answers every refusal with
 *    HTTP 200/201 and the real status inside `statusCode`, so nothing here reads
 *    the HTTP status or trusts a resolved promise. Every answer goes through
 *    `isCafeSuccess()` first and `parseCafeFailure()` second — the ONE reader,
 *    in `utils/cafe-response.ts`, which no store may re-implement.
 * 3. **NO ACTION THROWS AND NO ACTION REJECTS.** Each returns
 *    `CafeResult<T>`, because a caller has to be able to tell «the server
 *    refused» from «the server accepted and there was nothing to show» and both
 *    look like a missing value. A network throw becomes
 *    `{ ok: false, failure: parseCafeFailure(null, <this store's sentence>) }`.
 *
 * ## WHY THE FLAGS ARE PER-RESOURCE
 *
 * `loaded` / `pending` / `errors` are keyed by `CafeResource` rather than being
 * one `loading` boolean: two café screens are legitimately in flight together,
 * and a shared flag blanks the wrong list. `loaded` is set on a **refusal** too
 * — a refusal is a known answer, not an unknown one — while a refusal also
 * clears that resource's own value, so a stale list never renders under a fresh
 * error sentence.
 *
 * `loaded` also carries the scope the answer was fetched for, so re-reading
 * `/cafe/A` is never satisfied by the answer held for `/cafe/B` (the reason
 * `middleware/child-panel.ts` short-circuits only on its own profile). `reset(key)`
 * forgets one resource outright, for the screens that hold a true but stale
 * answer; it is the escape hatch the empty states' `#action` retry uses.
 *
 * ## AND WHY THERE IS A GENERATION COUNTER BESIDE THE SCOPE
 *
 * Scope answers «may this HELD answer be served again?», which is a different
 * question from «is the request still in the air the one this screen is waiting
 * for?». Scope cannot see the second one: a retry fires an un-awaited
 * `fetchTables`, the reader navigates to another café, and café A's response
 * lands after café B's request started — so `scopes["tables"]` is B's and A's rows
 * are about to overwrite B's screen with no scope check able to object. `run`
 * therefore takes a per-resource generation counter before its first `await`, and
 * every action re-reads it immediately before writing a shared ref. `reset` bumps
 * it too, so a request started before a reset cannot write after it.
 *
 * ## ⚠️ AND SINCE PHASE 2: `messages` + `users` JOINED THE RESOURCE LIST, AND
 * ## ⚠️ EVERY MUTATION DELIBERATELY **BYPASSES** `run()`
 *
 * Two of the eight original resources are now ten, so `SENTENCES`, `CLEARED`,
 * `generation`, `loaded`, `pending`, `errors` and `scopes` each carry two more
 * keys. Nothing about `run()` itself changed, and that is the point:
 *
 * **`run()` calls `CLEARED[resource]()` on a refusal** — which is right for a READ
 * (a stale list under a fresh error sentence reads as «the server sent these rows
 * AND refused», which is not a thing that can be true) and catastrophic for a
 * MUTATION. A refused like toggle routed through `run()` would empty the whole
 * transcript and replace it with a sentence about a heart. So:
 *
 * - **Reads** — `fetchMessages`, `catchUpMessages`, `fetchUsers` — go through
 *   `run()` like every other read here.
 * - **Mutations** — `sendMessage`, `editMessage`, `deleteMessage`, `toggleLike`,
 *   `markSeen`, `reportTarget`, `joinTable`, `leaveTableById` — take
 *   `useRequestFetch()`, read the envelope themselves and return a `CafeResult`
 *   WITHOUT touching `errors`, `pending`, `loaded` or `scopes`. The page toasts
 *   `failure.message`; the transcript is never a casualty of a failed action on
 *   one message.
 *
 * ## ⚠️ SEQUENCES COME FROM A HISTORY READ, NEVER FROM A SOCKET BROADCAST
 *
 * `ICafeLiveMessage` declares no `sequence` at all: §14.1 calls the broadcast «the
 * same fields as send-response `data`», which carries one, and reading it would put a
 * live number inside the `newestSequence` window the catch-up pages from and inside the
 * `seen` value. `sequence` is simultaneously the `cursor` of the history endpoint and
 * the `seen` value of the read receipt, so a locally invented one corrupts paging AND
 * read state. Every row that has a `sequence` got it from
 * `GET /table/:tableId/messages`, including the reader's OWN message — whose
 * `sequence` comes from the REST 201, and a broadcast for somebody else's message
 * becomes a `provisional` row plus a catch-up.
 *
 * ⚠ `senderId` AND `createdAt` ARE READ OFF A BROADCAST, though: they are ordinary
 * display fields, §14.1 says the payload is the whole message, and a row without them
 * for 600 ms has no author and no time (and is drawn as somebody else's).
 */

import {
  isCafeMessagesPayload,
  isCafeSuccess,
  isTableNotFoundFailure,
  parseCafeError,
  parseCafeFailure,
} from "~/utils/cafe-response";
import {
  isCafeReportTarget,
  type CafeFailure,
  type CafeFailureReason,
  type CafeMessagesDirection,
  type CafeReportTarget,
  type CafeResource,
  type CafeResult,
  type ICafe,
  type ICafeAccess,
  type ICafeAccessRow,
  type ICafeActionResponse,
  type ICafeChannel,
  type ICafeFeetQuery,
  type ICafeFeetResponse,
  type ICafeLikeBroadcast,
  type ICafeLikeOutcome,
  type ICafeLikeResponse,
  type ICafeLiveMessage,
  type ICafeMessagesQuery,
  type ICafeMessagesResponse,
  type ICafeMessageRefPayload,
  type ICafeMyAccessQuery,
  type ICafeMyAccessResponse,
  type ICafePresence,
  type ICafePresenceBroadcast,
  type ICafeReportResponse,
  type ICafeSearchResponse,
  type ICafeSendMessageBody,
  type ICafeSendMessageResponse,
  type ICafeSingleResponse,
  type ICafeSingleTableResponse,
  type ICafeSocketError,
  type ICafeStats,
  type ICafeStatsResponse,
  type ICafeSubscribedQuery,
  type ICafeSubscribedResponse,
  type ICafeTableMessage,
  type ICafeTableParticipant,
  type ICafeTableView,
  type ICafeTablesQuery,
  type ICafeTablesResponse,
  type ICafeThread,
  type ICafeThreadMessage,
  type ICafeUsersResponse,
  type ICafeWindowBroadcast,
  type ITableUserView,
  type MessageType,
  type SubscribeItem,
} from "~/types/cafe";

/**
 * The fetcher every action hands to its request helper, so a server render
 * reaches our own `/api` routes WITH the incoming request's cookies.
 *
 * ## ⚠️ A PLAIN CALLABLE, NOT `ReturnType<typeof useRequestFetch>`
 *
 * Two reasons, and both were earned.
 *
 * **First**, the reason `stores/goalAward.ts` documents: on the server that
 * composable hands back `event.$fetch` (`H3Event$Fetch`), which carries neither
 * `$Fetch.raw` nor `$Fetch.create`, so `typeof $fetch` would reject the very
 * value this exists to accept.
 *
 * **Second**, and decisive at this project's size: the generic fetcher resolves
 * a request path against Nitro's generated route union through a conditional
 * type, and that comparison now recurses past TypeScript's depth limit, so
 * `readCafe` raised `TS2321: Excessive stack depth comparing types` — a
 * *limit*, not a type error, with no route actually wrong. Naming the signature
 * keeps the compiler from instantiating it. Nothing is lost: every action
 * validates its own path and query, and `readCafe` already casts the answer to
 * `TResponse`.
 */
type CafeFetcher = (
  url: string,
  options?: {
    method?: "get" | "post" | "put" | "patch" | "delete";
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
) => Promise<unknown>;

/**
 * `useRequestFetch()`, with its type erased here and NOWHERE ELSE.
 *
 * ⚠️ Naming the type in `CafeFetcher` was not enough on its own: every action
 * still produced a value of the generic type, and passing that value into a
 * parameter made TypeScript instantiate the very conditional that overflows —
 * `TS2321` simply moved from the helper's body to the call site. So the
 * assertion lives at the source instead of at twenty call sites, where it is one
 * line with one stated reason.
 *
 * The RUNTIME value is untouched: this is a type-level assertion and nothing
 * else. Cookies still flow, because that is `useRequestFetch`'s job, not its
 * type's.
 */
function cafeFetcher(): CafeFetcher {
  return useRequestFetch() as unknown as CafeFetcher;
}

/**
 * One written Persian sentence per resource, and three per resource because the
 * three failures are not the same fact: the server ANSWERED and said no (its own
 * translated `message` is preferred and this is only the floor), the request
 * never reached a server at all, or the answer arrived after the reader had
 * already left the screen that asked for it — which is nothing to do with
 * either the server or the connection, and must not be shown as «check your
 * internet».
 *
 * They stay here rather than in `utils/cafe-response.ts` because the sentence
 * that is right depends on what was being attempted — the same rule
 * `utils/api-error.ts` states about the per-store copy.
 */
const SENTENCES = {
  feet: {
    refused:
      "در حال حاضر نشد کافه‌ها را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد کافه‌ها را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد کافه‌ها را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  cafe: {
    refused:
      "در حال حاضر نشد اطلاعات این کافه را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد اطلاعات این کافه را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد اطلاعات این کافه را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  tables: {
    refused:
      "در حال حاضر نشد میزهای این کافه را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد میزهای این کافه را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد میزهای این کافه را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  table: {
    refused:
      "در حال حاضر نشد این گفتگو را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد این گفتگو را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد این گفتگو را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  myAccess: {
    refused:
      "در حال حاضر نشد دسترسی‌های شما را بررسی کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد دسترسی‌های شما را بررسی کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد دسترسی‌های شما را بررسی کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  stats: {
    refused:
      "در حال حاضر نشد آمار کافه‌ها را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد آمار کافه‌ها را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد آمار کافه‌ها را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  search: {
    refused:
      "در حال حاضر نشد جست‌وجوی میزها را انجام دهیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد جست‌وجوی میزها را انجام دهیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد جست‌وجوی میزها را انجام دهیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  joined: {
    refused:
      "در حال حاضر نشد گفتگوهای شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد گفتگوهای شما را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد گفتگوهای شما را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  messages: {
    refused:
      "در حال حاضر نشد پیام‌های این گفتگو را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد پیام‌های این گفتگو را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد پیام‌های این گفتگو را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
  users: {
    refused:
      "در حال حاضر نشد اعضای این میز را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "در حال حاضر نشد اعضای این میز را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
    superseded:
      "در حال حاضر نشد اعضای این میز را دریافت کنیم. این درخواست دیگر مربوط به این صفحه نیست.",
  },
} as const;

/**
 * The sentences a MUTATION owes the reader — and ⚠️ only TWO of the three, not
 * three, because a mutation never carries the third.
 *
 * `refused` and `net` are the same two facts the reads have. `superseded` is
 * absent on purpose: a mutation writes nothing until its answer arrives, so
 * there is no shared ref for a late answer to clobber, no generation to lose a
 * race to, and therefore no «the answer belongs to a screen you have left» case to
 * describe. `sendMessage`'s 200–600 ms is the window this buys: the reader who
 * navigated away mid-send must still get their message into the transcript they
 * left, and a `run()` would have thrown it away.
 *
 * ⚠️ `send`'s two `net` sentences are not the same string, and the difference is
 * the whole point of this record: the send limiter is 30/60s per user (§11), so
 * «اتصال اینترنت را بررسی کنید» is the wrong sentence for a composer that was
 * simply typing faster than the backend allows.
 */
const MUTATION_SENTENCES = {
  send: {
    refused:
      "در حال حاضر نشد پیام شما ارسال شود. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "پیام شما ارسال نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
  edit: {
    refused:
      "در حال حاضر نشد ویرایش پیام ذخیره شود. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "ویرایش پیام ذخیره نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
  remove: {
    refused:
      "در حال حاضر نشد پیام حذف شود. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "پیام حذف نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
  like: {
    refused:
      "در حال حاضر نشد پسند شما ثبت شود. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "پسند شما ثبت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
  seen: {
    refused: "در حال حاضر نشد وضعیت خواندن پیام‌ها ثبت شود.",
    net: "وضعیت خواندن پیام‌ها ثبت نشد. اتصال اینترنت را بررسی کنید.",
  },
  report: {
    refused:
      "در حال حاضر نشد گزارش شما ثبت شود. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "گزارش شما ثبت نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
  membership: {
    refused:
      "در حال حاضر نشد عضویت شما در این میز تغییر کند. لطفاً کمی بعد دوباره تلاش کنید.",
    net: "عضویت شما تغییر نکرد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.",
  },
} as const;

/** Which sentence set a mutation answers with. */
type MutationKey = keyof typeof MUTATION_SENTENCES;

/**
 * ⚠️ THE `my-ct` PAGINATION BUG, AND WHY THIS CONSTANT IS ZERO.
 *
 * `getUserCafeAndTableAccess` reads its own page size off the WRONG key:
 *
 * ```ts
 * const page  = req.query?.page || 1
 * const limit = req.query?.page || 100          // ⚠️ `page`, not `limit`
 * … .limit(+limit).skip((+page - 1) * +limit)
 * ```
 *
 * So `page` is the COUNT **and** the offset base at once, and the offset is
 * `(page - 1) × page`:
 *
 * | sent      | limit | skip    | rows                                    |
 * |-----------|-------|---------|-----------------------------------------|
 * | (omitted) | 100   | 0       | the first 100 — the backend's own default |
 * | `1`       | 1     | 0       | **one** grant, silently                   |
 * | `2`       | 2     | 2       | grants 3–4                                |
 * | `100`     | 100   | 9 900   | **none** — every reader is skipped past   |
 *
 * The API doc's remedy ("send `page` large") therefore empties the list: the
 * grants screen would read «you manage nothing» for every reader, which is
 * indistinguishable from the truth. `0` is the one value that survives both
 * halves of the arithmetic — the query string turns it into the truthy `"0"`,
 * so `limit` becomes `0`, which MongoDB defines as *no limit*, and `skip`
 * becomes `(-1) × 0 = 0`. One request, the whole list, no client paging.
 *
 * ⚠️ THE ONE CONDITION THAT BREAKS IT: if the backend is ever corrected to read
 * `req.query.limit`, a `page` of `0` gives `skip((0 - 1) × 100)` — a negative
 * skip, which Mongo rejects — and this constant must become "omit `page`". It
 * is a single named constant for exactly that reason: the fix is one number, and
 * the comment above is the reason it is a number at all.
 *
 * ⚠️ It survives the proxy: `server/api/cafe/my-ct.ts` reads `page` through
 * `toPage`, which passes `0` through — `page` 0 is a value, not "unset" — and
 * forwards no `limit` unless the caller sent one, which this action never does.
 * The clamp on `limit` therefore cannot shorten this list.
 */
const MY_ACCESS_PAGE = 0;

/**
 * ⚠️ THE `subscribed` PAGINATION BUG.
 *
 * `$limit` is applied BEFORE `$skip`, and `$skip` is fed the page NUMBER rather
 * than an offset (`{ $skip: +page - 1 }`). Page 2 therefore drops a single row
 * and returns rows 2…N again — it overlaps page 1 instead of continuing past it,
 * so server-side paging can never be walked and page 3 repeats page 2.
 *
 * One large page is the documented remedy and the only one that works: ask for
 * the whole list once and slice it on the client. `fetchSubscribed` therefore
 * asks for THIS figure and ignores a smaller one — a smaller limit silently
 * truncates a list there is no second request to finish.
 *
 * ## ⚠️ IT IS ALSO THE CEILING, AND NOT BY CHOICE
 *
 * `server/utils/pagination.ts` clamps every proxied `limit` at
 * `MAX_PAGE_SIZE`, which is this same 100. So a caller's LARGER `limit` cannot
 * survive the proxy anyway, and taking it at its word here would only make the
 * store believe a page it will never receive. The clamp is therefore stated on
 * BOTH sides of the wire on purpose: the proxy refuses to forward an unbounded
 * figure, and this constant is the largest figure worth asking for.
 *
 * It cannot be imported — `server/utils` is Nitro's auto-import directory and
 * does not exist in the client bundle — so the number is written here and the two
 * must be changed together. If `MAX_PAGE_SIZE` is ever raised, raise this too.
 *
 * It is also the size of the throwaway read `resolveTableId` makes, because both
 * are the same question: «give me everything this endpoint can reach».
 */
const LARGE_PAGE_SIZE = 100;

/** `GET /table/q`'s own defaults are 1 / 12; ours are 1 / 10 and are always SENT. */
const SEARCH_PAGE = 1;
const SEARCH_LIMIT = 10;

/**
 * ⚠️ §11's `text` cap, enforced HERE and not only in the composer.
 *
 * The composer's `maxlength` is a UX affordance — a field that cannot reach 2001
 * characters — and a client-side cap is not a boundary: `sendMessage` is a public
 * action that anything in this app may call. So the cap is checked a second time
 * at the action, and the over-long case is a **refusal with a reason**, not a
 * silent truncation: truncating would post a message the reader did not write,
 * and refusing is the only answer that leaves their words untouched.
 *
 * The proxy checks it a third time
 * (`server/api/cafe/table/[resourceId]/messages.post.ts`) — three checks of one
 * number, which is what a boundary that is worth stating costs.
 */
const MESSAGE_TEXT_MAX = 2000;

/** §7's cap on `metadata.note`. The proxy enforces the same figure. */
const REPORT_NOTE_MAX = 500;

/**
 * ⚠ THE READER'S OWN `userId`, read from the user store — and it is **INSIDE** the
 * store setup on purpose.
 *
 * `useUser()` requires an active Pinia, which a module-level call does not have at
 * import time; and a module-level `computed` would be **shared across SSR requests**,
 * so one reader's identity could be read while rendering another's page. Both are
 * reasons this is a `const` inside `defineStore`, exactly like every other ref here.
 *
 * ⚠ AND THE STORE IS INSTANTIATED ON THE SERVER TOO — the thread screen awaits
 * `fetchTable` in its setup body — so nothing below may touch `window` and nothing may
 * assume a session. The auth middleware has already populated this on both sides of the
 * render, and every consumer below treats `null` as «this client cannot tell whose
 * message this is», which is the honest reading for a signed-out or still-loading
 * session and never a licence to attribute a message to somebody.
 */
/**
 * ⚠ THE PREFIX ON A PROVISIONAL ROW'S ID, AND WHY IT IS `local:` WITH A COLON.
 *
 * `:` is **outside** the backend's id charset (`/^[A-Za-z0-9_-]{4,64}$/`), so a
 * client-generated id can never collide with a wire id — which is the whole
 * reconciliation strategy: `id` is the only key every shape carries (the 201's
 * `data`, the history projection and the live broadcast all have it), so it must
 * be trustworthy, and a `local-` prefix would sit INSIDE that charset and could
 * in principle collide.
 */
const LOCAL_ID_PREFIX = "local:";

/**
 * The ceiling on the `direction: "new"` catch-up loop, in rounds.
 *
 * ⚠️ A catch-up stops when the server answers `hasMore: false`, so this bound is
 * never reached against a well-behaved backend — it exists so that one which never
 * says so cannot spin this client through a request per page forever. Twenty
 * rounds of fifteen is three hundred messages, which is well past any gap a
 * dropped connection opens; the alternative (no cap) is a client that keeps asking
 * a question whose answer has stopped changing.
 */
const CATCH_UP_MAX_ROUNDS = 20;

/**
 * The trailing throttle on `POST /seen`, in milliseconds.
 *
 * ⚠️ A TRAILING THROTTLE, NOT A DEBOUNCE. A debounce starves under continuous
 * scrolling — the reader keeps moving, the timer keeps resetting, and the read
 * receipt is never sent at all, so the unread badge a reader can see growing is
 * one this client never corrects. A trailing throttle fires at most once per
 * window no matter how long the scrolling runs, and the leading edge covers the
 * common case where the reader is already at the bottom and wants it now.
 *
 * ⚠️ And it is not the ONLY guard, deliberately: `thread.lastSeenSent` is the
 * high-water mark of what has actually been posted, so a sequence at or below it
 * returns without a request. The throttle bounds the request rate, the mark stops
 * the requests that carry nothing new.
 */
const SEEN_THROTTLE_MS = 1500;

/** The debounce on the catch-up a provisional broadcast schedules. */
const CATCH_UP_DEBOUNCE_MS = 600;

/**
 * The refusal for a request this store refused to MAKE.
 *
 * The backend would answer the same thing — `ERR_TABLE_NOT_FOUND` for a table
 * that is not there — but a route parameter is already in hand, and the literal
 * request `useRoute()` produces mid-navigation is
 * `/api/cafe/table/undefined`. It is still built by `parseCafeFailure`,
 * so a caller has exactly ONE failure shape to handle, with a real `reason` to
 * branch on instead of a sentence.
 *
 * The second caller is `superseded()`, which has no route parameter behind it
 * and mints the client-only `ERR_SUPERSEDED` through the same route.
 */
function guardFailure(reason: CafeFailureReason, sentence: string): CafeFailure {
  return parseCafeFailure({ success: true, reason }, sentence);
}

/**
 * A refusal from the wire, with the sentence this resource owes the reader.
 *
 * ⚠️ `ERR_NET_CONNECTION` GETS THE `net` SENTENCE, AND THAT IS THE POINT.
 * `SENTENCES.*.net` used to be reachable only when the CLIENT's own fetch threw,
 * which is the rarest failure there is: every `server/api/cafe/**` proxy catches
 * an upstream failure and answers `connectionResponseError()`, which is an HTTP
 * **200** carrying `{ success: false, statusCode: 500, reason: "ERR_NET_CONNECTION" }`.
 * So the outage a reader actually meets arrives here as a *refusal*, not a throw,
 * and before this the actionable «اتصال اینترنت را بررسی کنید» was unreachable
 * for it while the generic «خطای غیر منتظره رخ داده است» was not.
 *
 * The 5xx-with-no-`reason` rule in `utils/api-error.ts` is untouched and still
 * runs first inside `parseCafeFailure`: a backend crash keeps its own fallback and
 * its English `TypeError` never reaches a screen either way.
 */
function refused<T>(resource: CafeResource, payload: unknown): CafeResult<T> {
  const failure = parseCafeFailure(payload, SENTENCES[resource].refused);

  return {
    ok: false,
    failure:
      failure.reason === "ERR_NET_CONNECTION"
        ? { ...failure, message: SENTENCES[resource].net }
        : failure,
  };
}

/** The trimmed id, or `null` — the one check that stops `/…/undefined/…` going out. */
function usableId(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * `GET /table/:cafeId/:tableId/single`'s `table` **as it actually arrives** — the
 * one shape `ICafeSingleTableResponse` does not carry, because the answer is the
 * object the controller builds from `[table]` and its `subscribe` is the single
 * participant document that reduction leaves behind (`getSingleTable`,
 * `Server/src/modules/cafe/cafe.controller.ts:666-748`).
 *
 * ⚠️ DELIBERATELY NOT IN `~/types/cafe`: `ICafeTableView.subscribe` is the
 * store-owned, normalized ARRAY, and a union on it would make every reader below
 * this store — `myParticipant` on the thread screen among them — narrow a field
 * that is never ambiguous once it has been through `normalizeSubscribe`.
 */
type CafeSingleTableWire = Omit<ICafeTableView, "subscribe"> & {
  subscribe?: ICafeTableParticipant | ICafeTableParticipant[] | null;
};

/**
 * `subscribe` → the array `ICafeTableView` promises, in one place.
 *
 * ⚠️ THE WIRE CARRIES **ONE PARTICIPANT OBJECT**, never the roster: the pipeline
 * `$unwind`s `subscribe` with `preserveNullAndEmptyArrays` (one document per
 * active participant) and `getSingleTable` keeps only the first of those rows, so
 * the object it answers with holds whichever participant that was — NOT
 * necessarily the reader's, and never a count. An array is still accepted so a
 * shape change on the backend is not read as «the reader is not a member».
 */
function normalizeSubscribe(
  value: ICafeTableParticipant | ICafeTableParticipant[] | null | undefined,
): ICafeTableParticipant[] {
  if (Array.isArray(value)) return value;

  return value === null || value === undefined ? [] : [value];
}

/**
 * One GET, through the fetcher the action was handed, and `null` for a request
 * that never completed.
 *
 * `null` is deliberately not an error object: there is no `reason` to read from a
 * dropped connection, so the caller has nothing to parse and is expected to
 * substitute its own written sentence.
 */
async function readCafe<TResponse>(
  fetcher: CafeFetcher,
  url: string,
  query?: Record<string, unknown>,
): Promise<TResponse | null> {
  try {
    return (await fetcher(url, { method: "get", query })) as TResponse;
  } catch {
    return null;
  }
}

/**
 * The three shapes a mutation is allowed to take. `delete` carries no body ever.
 *
 * ⚠ `body` IS A `Record`, NOT `unknown`, because that is what
 * `NitroFetchOptions["body"]` accepts — and a value typed `unknown` cannot be handed to
 * a typed fetcher at all. Every caller passes an object literal built from an
 * allowlist, so nothing looser than this is needed and nothing narrower would do.
 */
type CafeWrite = {
  method: "post" | "put" | "delete";
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

/**
 * The refusal for a WRITE — the mutation twin of `refused()`, and the same
 * `ERR_NET_CONNECTION` → `net` promotion for the same reason.
 *
 * ⚠️ It takes its sentences from `MUTATION_SENTENCES`, not from `SENTENCES`.
 * `SENTENCES` describes «a read of the resource»; a mutation's sentence describes
 * «the thing the reader just pressed», and «در حال حاضر نشد کافه‌ها را دریافت
 * کنیم» under a composer that refused to send a message is a sentence about the
 * wrong fact entirely.
 */
function mutationRefused<T>(key: MutationKey, payload: unknown): CafeResult<T> {
  const failure = parseCafeFailure(payload, MUTATION_SENTENCES[key].refused);

  return {
    ok: false,
    failure:
      failure.reason === "ERR_NET_CONNECTION"
        ? { ...failure, message: MUTATION_SENTENCES[key].net }
        : failure,
  };
}

/**
 * One WRITE, through the fetcher the action was handed, and a `CafeFailure` for
 * **every** way it can fail — which is the one thing `readCafe` deliberately
 * cannot do.
 *
 * `readCafe` answers `null` for a request that never completed, and every read
 * above is fine with that because each of them has a written sentence to
 * substitute. A mutation needs the same sentence, but it also needs to know
 * whether the backend SAID no (so a like toggle can undo its optimistic flip) or
 * whether the request never arrived (so it must), and those are different states.
 *
 * ## ⚠️ THE `catch` IS A BACKSTOP, NOT THE USUAL PATH
 *
 * Since the proxies were changed, an upstream **429 no longer rejects**: they answer
 * `{ success: false, statusCode: 429, reason: "ERR_TOO_MANY_REQUESTS", message: <Persian> }`,
 * which is an ordinary resolved envelope and which `parseCafeFailure` reads
 * correctly — `refusalMessage` prefers the envelope's own Persian sentence. So the
 * common throttled path is `mutationRefused`, not this branch.
 *
 * `parseCafeError` is here for the case that answer cannot cover: a 429 (or any
 * other real status) raised by the **Nitro layer itself**, where there is no café
 * envelope at all and `$fetch` rejects. It is the only reader in this file that
 * looks at a caught error, and it returns `null` when the value carries no status
 * — which is precisely «the request never reached a server», and is the moment the
 * `net` sentence is the honest one.
 */
async function writeCafe<TResponse>(
  fetcher: CafeFetcher,
  url: string,
  write: CafeWrite,
  key: MutationKey,
): Promise<{ payload: TResponse | null; failure: CafeFailure | null }> {
  try {
    return { payload: (await fetcher(url, write)) as TResponse, failure: null };
  } catch (error) {
    return {
      payload: null,
      failure:
        parseCafeError(error, MUTATION_SENTENCES[key].net) ??
        parseCafeFailure(null, MUTATION_SENTENCES[key].net),
    };
  }
}

/**
 * The rows this module hands back when a thread is not active.
 *
 * ⚠️ A module-level FROZEN singleton, and the reason is the thread page's clock:
 * `[]` written inline in a `computed` is a NEW array identity on every read, and
 * the page re-renders its transcript on every tick of its 15-second window — so
 * the empty state of a screen with no thread would re-render forever over an
 * array that never changes. One frozen instance makes «nothing to draw» a value
 * that is genuinely the same value.
 */
const EMPTY_ROWS: readonly ICafeThreadMessage[] = Object.freeze([]);

/**
 * A thread that has been entered and holds nothing: every paging flag at «there
 * is nothing more», both cursors `null`, and no window override.
 *
 * ⚠️ `hasOlder` / `hasNewer` START FALSE and become true from the SERVER's
 * `hasMore`. They are never set from `messages.length`: the page is 15 by default
 * and 500 under `loadAll`, so a full page means «maybe more», and only the server
 * knows. Starting them `false` means «nobody has asked yet», which is what a
 * freshly-entered thread is.
 */
function blankThread(): ICafeThread {
  return {
    messages: [],
    hasOlder: false,
    olderCursor: null,
    hasNewer: false,
    newerCursor: null,
    loadingOlder: false,
    loadingNewer: false,
    lastReadSequence: 0,
    lastSeenSent: 0,
    sendingOverride: null,
    secureOverride: null,
    joined: false,
  };
}

/**
 * One row's `file`, from either wire spelling, and from a broadcast that carries
 * no file at all.
 *
 * ⚠️ `thubmnail` is the backend's misspelling and `thumbnail` the correct one, and
 * §14.1's «same fields as send-response `data`» points at the misspelled key while
 * `ICafeLiveMessage` was declared with the correct one. Nothing documents which a
 * broadcast actually sends, so both are read and an absent file leaves the row's
 * existing one alone — a broadcast must never be able to ERASE the attachment a
 * history read already delivered.
 */
function mergeLiveFile(
  row: ICafeThreadMessage,
  live: ICafeLiveMessage,
): ICafeThreadMessage["file"] {
  if (live.file === null || live.file === undefined) return row.file;

  const thubmnail = live.file.thubmnail ?? live.file.thumbnail ?? row.file?.thubmnail;

  return {
    fileType: live.file.fileType ?? row.file?.fileType ?? null,
    thubmnail: thubmnail ?? null,
    mainUrl: live.file.mainUrl ?? row.file?.mainUrl ?? null,
  };
}

/**
 * Fold a live broadcast into a row that already holds it.
 *
 * ⚠ EVERY FIELD IS READ AS `live.x ?? row.x`, and that is the entire rule: a
 * broadcast cannot be trusted to carry `sequence` (which is never read off one at
 * all), so a plain spread would write `undefined`s over values a REST 201 had
 * already put there. A field the broadcast does not carry is a field it does not
 * know, and «does not know» is not «is empty».
 */
function overlayLive(
  row: ICafeThreadMessage,
  live: ICafeLiveMessage,
): ICafeThreadMessage {
  return {
    ...row,
    text: live.text ?? row.text,
    type: live.type ?? row.type,
    status: live.status ?? row.status,
    poll: live.poll ?? row.poll,
    reaplayTo: live.reaplayTo ?? row.reaplayTo,
    file: mergeLiveFile(row, live),
    // ⚠ Read when §14.1's payload carries them, and never over a value the row already
    // holds — the 201 and the catch-up are what fill these in, and the broadcast is only
    // allowed to speak first.
    senderId: live.senderId ?? row.senderId,
    createdAt: live.createdAt ?? row.createdAt,
    // A moderation block rides along only when bad words matched; its absence is
    // not a retraction of one the answer already carried.
    report: live.report ?? row.report,
  };
}

/**
 * Merge a history page into a thread: by `id`, persisted over provisional, one
 * re-sort, sequence-less rows last in arrival order.
 *
 * ## WHY THIS SHAPE AND NOT AN INSERT AT AN INDEX
 *
 * Both directions of §15 arrive **ascending**, so «prepend on `old` / append on
 * `new`» is true — but the incoming page OVERLAPS the rows already held (a
 * catch-up after a live row returns that row again, and a re-read after a
 * reconnect returns the tail), so neither a prepend nor an append is right: every
 * one of them can duplicate a row or drop one. Indexing by `id` and re-sorting
 * once is the version that cannot.
 *
 * ⚠️ `id` is the ONLY key every shape carries — the 201's `data`, the history
 * projection and the live broadcast all have it — so it is the only key there is,
 * and it is the only one worth trusting.
 *
 * ⚠️ AND THE PERSISTED FORM ALWAYS WINS: a row already carrying a real `sequence`
 * is never overwritten with `null` by a broadcast-shaped row, and a client-only
 * flag (`localId`, `sending`, `failed`) survives the overwrite because the
 * incoming history row does not have one to lose.
 *
 * ⚠️ THE SORT IS NOT A COMPARATOR ON A FIELD THAT MAY BE ABSENT. A `sequence` is
 * `null` on an optimistic row and on an unreconciled broadcast, and `null` in a
 * numeric comparator sorts to the TOP of a thread — a message the reader just sent
 * appearing above the one before it. So rows without a sequence go **last, in
 * arrival order**, and the sort is stable (the incoming page is appended to a
 * copy of the existing order first) rather than something that depends on
 * `Array.prototype.sort` staying stable in every engine this app may run in.
 */
function mergeRows(
  existing: readonly ICafeThreadMessage[],
  incoming: readonly ICafeThreadMessage[],
): ICafeThreadMessage[] {
  const byId = new Map<string, ICafeThreadMessage>();
  const order: string[] = [];

  for (const row of existing) {
    if (byId.has(row.id)) continue;

    byId.set(row.id, row);
    order.push(row.id);
  }

  for (const row of incoming) {
    // ⚠ A ROW WITH NO `id` CANNOT BE DEDUPED AND MUST NOT BE INVENTED — an
    // invented id would collide with the next invented one. It is dropped, and
    // the catch-up that fills it in brings it back with a real id.
    if (typeof row.id !== "string" || row.id === "") continue;

    const prior = byId.get(row.id);

    if (prior === undefined) {
      order.push(row.id);
      byId.set(row.id, row);
      continue;
    }

    byId.set(row.id, {
      ...prior,
      ...row,
      // The persisted form wins, and the client-only flags are the row's own.
      sequence: row.sequence ?? prior.sequence,
      senderId: row.senderId ?? prior.senderId,
      createdAt: row.createdAt ?? prior.createdAt,
      localId: row.localId ?? prior.localId,
      sending: row.sending ?? prior.sending,
      failed: row.failed ?? prior.failed,
      // ⚠ `provisional` IS THE ONE CLIENT-ONLY FLAG A MERGE **INVERTS** RATHER THAN
      // KEEPS: an incoming row that carries a real `sequence` HAS been persisted, so
      // the flag is dropped. `row.provisional ?? prior.provisional` preserved the
      // broadcast's `true` through every later read and left the bubble saying
      // «در حال دریافت» for the rest of the session; a still sequence-less row keeps it.
      provisional:
        Number.isFinite(row.sequence as number)
          ? false
          : (row.provisional ?? prior.provisional),
      report: row.report ?? prior.report,
    });
  }

  const ordered = order
    .map((id) => byId.get(id))
    .filter((row): row is ICafeThreadMessage => row !== undefined);

  const withSequence: ICafeThreadMessage[] = [];
  const withoutSequence: ICafeThreadMessage[] = [];

  for (const row of ordered) {
    if (typeof row.sequence === "number" && Number.isFinite(row.sequence)) {
      withSequence.push(row);
      continue;
    }

    withoutSequence.push(row);
  }

  withSequence.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  return [...withSequence, ...withoutSequence];
}

/**
 * The highest `sequence` a thread currently RENDERS, or `null`.
 *
 * ⚠️ It is read off the SORTED rows rather than off `newerCursor`, because the
 * cursor is what the server wants next and this is what the reader is looking at
 * — and the two can disagree while a live row is still `provisional`. A `seen`
 * posted from the cursor alone would therefore report messages the reader has not
 * been shown.
 */
function newestSequence(thread: ICafeThread): number | null {
  let newest: number | null = null;

  for (const row of thread.messages) {
    if (typeof row.sequence !== "number" || !Number.isFinite(row.sequence)) continue;
    if (newest === null || row.sequence > newest) newest = row.sequence;
  }

  return newest;
}

/** The lowest `sequence` a thread holds, or `null`. See `newestSequence`. */
function oldestSequence(thread: ICafeThread): number | null {
  let oldest: number | null = null;

  for (const row of thread.messages) {
    if (typeof row.sequence !== "number" || !Number.isFinite(row.sequence)) continue;
    if (oldest === null || row.sequence < oldest) oldest = row.sequence;
  }

  return oldest;
}

/**
 * A history row as the client holds it.
 *
 * ⚠️ The one thing this does is keep the `sequence`, which is what makes the
 * difference between «read the history» and «invented a sequence». It is read
 * through a narrow check rather than a cast because a message with no usable
 * `sequence` cannot be paged, ordered or marked read, and a row claiming to be
 * something it is not is exactly the failure this file exists to prevent.
 */
function toThreadMessage(row: ICafeTableMessage): ICafeThreadMessage {
  return { ...row, sequence: row.sequence };
}

/**
 * One page of history, and NOTHING else — no flags, no generation, no bookkeeping.
 *
 * ⚠️ `loadAll` GOES UP AS THE LITERAL `"1"`, which is what
 * `server/api/cafe/table/[resourceId]/messages.get.ts` matches. §15 says «any truthy
 * value» raises the cap from 15 to 500, and that is exactly why the proxy matches it
 * by hand rather than on truthiness: `?loadAll[$ne]=` is an object (truthy, and a
 * Mongo operator). A boolean `true` serialises to `"true"`, which the proxy accepts
 * too — so both spellings work and the literal is used here because it is the one the
 * route names.
 *
 * ⚠️ AND AN UNUSABLE `cursor` IS **OMITTED**, never coerced: a missing cursor means
 * «start from the reader's own `lastReadMessageId`» (§15), which is a
 * read-receipt-relative read — so a cursor this client cannot vouch for must not be
 * sent as if it were one, and the caller has already decided that a paged read is the
 * only thing that may omit it.
 */
async function readMessagesPage(
  fetcher: CafeFetcher,
  tableId: string,
  query: ICafeMessagesQuery,
): Promise<ICafeMessagesResponse | null> {
  const cursor = query.cursor;

  return await readCafe<ICafeMessagesResponse>(
    fetcher,
    `/api/cafe/table/${encodeURIComponent(tableId)}/messages`,
    {
      ...(query.direction && { direction: query.direction }),
      ...(typeof cursor === "number" && Number.isSafeInteger(cursor) && cursor >= 0 && {
        cursor,
      }),
      ...(query.loadAll && { loadAll: "1" }),
    },
  );
}

/**
 * The refusal for a request that never completed.
 *
 * ⚠ `readCafe` answers `null` for exactly that case and nothing else, and `null` has
 * no `reason` to read — so the refusal is MANUFACTURED here as
 * `ERR_NET_CONNECTION`, which is what `refused()` then turns into the `net` sentence
 * for this resource. Without it a dropped connection during a history read would be
 * reported as «try again in a moment», which sends the reader to the wrong place.
 */
function unreachable<T>(resource: CafeResource): CafeResult<T> {
  return refused<T>(resource, { success: true, reason: "ERR_NET_CONNECTION" });
}

/**
 * The optimistic row's `type`, guessed from what is being sent.
 *
 * ⚠ THE SERVER INFERS IT FROM THE FILE'S EXTENSION (§11: image for `png|jpeg|webp`,
 * audio for `mp3`, voice for `ogg`, `file` otherwise), so this is the same mapping —
 * and it is a **RENDERING GUESS**, not a claim: the 201 replaces it, and it exists so
 * the provisional bubble is not a blank card for the 200–600 ms the request takes.
 *
 * ⚠ AND NOTHING PRODUCES A FILE URL IN THIS WAVE: there is no upload endpoint in the
 * documented contract, so the `+` and the mic still reach no terminal action (§14.2).
 * The branch is typed and complete because the wire is, not because it is reachable.
 */
function inferFileMessageType(url: string | undefined): MessageType {
  const path = typeof url === "string" ? url.split("?")[0]?.toLowerCase() ?? "" : "";

  if (/\.(png|jpe?g|webp)$/.test(path)) return "image";
  if (path.endsWith(".mp3")) return "audio";
  if (path.endsWith(".ogg")) return "voice";

  return "file";
}

export const useCafe = defineStore("cafe", () => {
  /* ------------------------------------------------------------------ state -- */

  /**
   * ⚠ THE READER'S OWN `userId`, and it is **INSIDE** the setup on purpose.
   *
   * `useUser()` needs an active Pinia, which a module-level call does not have at
   * import time; and a module-level `computed` would be **shared across SSR requests**,
   * so one reader's identity could be read while rendering another's page. Both are
   * reasons this is a `const` in here, exactly like every other piece of state below.
   *
   * ⚠ IT IS `null` FOR A SIGNED-OUT OR STILL-LOADING SESSION, and every consumer below
   * treats `null` as «this client cannot tell whose message this is» — the honest
   * reading, and never a licence to attribute a message to somebody. The auth
   * middleware has already populated it on both sides of the render.
   */
  const user = useUser();

  const myId = computed<string | null>(() => user.state.user?.userId ?? null);

  /** `GET /cafes/feet`, in the order `data.public ++ data.privite` arrives. */
  const cafes = ref<ICafe[]>([]);
  /** `GET /:id/single` — kept only to carry the `view` counter, which increments per read. */
  const activeCafe = ref<ICafe | null>(null);
  const tables = ref<ICafeTableView[]>([]);
  /** `GET /table/:cafeId/:tableId/single` — normalized by `fetchTable`; see `CafeSingleTableWire`. */
  const table = ref<ICafeTableView | null>(null);
  const myAccess = ref<ICafeAccess[]>([]);
  const stats = ref<ICafeStats | null>(null);
  const searchResults = ref<ICafeTableView[]>([]);
  const joined = ref<ICafeChannel[]>([]);

  /* ------------------------------------------------- messaging state (phase 2) -- */

  /**
   * One entry per table the client has opened, keyed by the table's INTERNAL id.
   *
   * ⚠️ A CACHE AND NOT ONE REF, and the two requirements it satisfies are the two
   * halves of one spec line: a transcript must **survive** navigating away and back
   * (a reader returning to a conversation expects it there, not a re-read), and two
   * tables must not **contaminate** each other (keying is what guarantees it). A
   * single ref plus a reset on every navigation satisfies the second by throwing
   * the first away.
   */
  const threads = ref<Record<string, ICafeThread>>({});

  /**
   * The ONE thread the socket writes into, `null` off the thread screen.
   *
   * ⚠️ It is not «UI state in a data store»: it is the session identity every live
   * event is matched against, and it has exactly one writer (`enterThread` /
   * `leaveThread`). Three of §14's payloads — `delete-message:bulk:response` (a bare
   * `string[]`), `message-sending-status` and `secure-chat-status` (plain strings)
   * — carry **no table id at all**, so «which room am I in» is the only thing that
   * can tell them where they belong. That is why the composable holds the invariant
   * «this client is in AT MOST ONE `table_<id>_room`» and why it is load-bearing
   * rather than tidy.
   */
  const activeThreadId = ref<string | null>(null);

  /**
   * `GET /table/:tableId/users` as a MAP, keyed by `userId`.
   *
   * A map rather than the endpoint's array because the question every reader asks
   * is «who is `senderId`», and it is asked once per bubble — so it is answered once
   * per member, and `memberFor` is a lookup rather than a `find` over a list that
   * would run again for every row of the transcript.
   *
   * ⚠️ Rows with no `userId` are dropped: a member this client cannot key is a
   * member whose name no bubble can ever resolve.
   */
  const users = ref<Record<string, ITableUserView>>({});

  /**
   * Presence as the socket reported it, keyed by `userId` and merged **OVER** the
   * roster by `memberFor` — never a replacement for it.
   *
   * ⚠️ `GET /table/:tableId/users` returns USER documents and
   * `cafe:table:join-new-user` returns a PRESENCE: two different facts about the
   * same people, and neither is the other. A presence event for somebody the roster
   * has never heard of is still recorded, because the event carries `fullName` and a
   * nameless bubble is a worse outcome than a thinner roster.
   */
  const presence = ref<Record<string, ICafePresence>>({});

  /**
   * `messageId` → the `liked` state this client GUESSED, for as long as the toggle
   * is in the air.
   *
   * ⚠️ It is both the in-flight guard and the reason the answer is allowed to
   * overwrite an optimistic guess: while an entry exists a second press is
   * IGNORED (two presses invert twice and land back on the original state, spending
   * two of a global 500/60s budget to change nothing), and the REST answer clears it
   * while a broadcast does not.
   */
  const pendingLikes = ref<Record<string, boolean>>({});

  /**
   * ONE send at a time, and a latch rather than a debounce.
   *
   * ⚠️ §11's send limiter is 30 per 60s per user. A double-tap spends two of those
   * on one intent. A debounce would also delay a DELIBERATE second message, which
   * is the ordinary case in a conversation — so this is a latch: set before the
   * request, cleared in a `finally`, and a call that arrives while it is set returns
   * the held answer immediately.
   */
  const sendPending = ref(false);

  /**
   * The one live failure this client holds: the last refused thing that arrived over
   * the socket (`app:error`).
   *
   * ⚠️ IT IS DELIBERATELY **NOT** `errors.messages`. `app:error` fires for a refused
   * OPERATION on a socket that is still perfectly connected — one message may be
   * refused while the transport carries others — so writing it into the messages
   * resource would blank the whole transcript over a refused like. A screen toasts
   * it and clears it; the transcript is never a casualty.
   */
  const socketFailure = ref<CafeFailure | null>(null);

  /* ------------------------------------- messaging bookkeeping (never state) -- */

  /**
   * ⚠ EVERYTHING IN THIS BLOCK IS **DELIBERATELY NOT `ref`s**, and that is not a
   * shortcut — it is the same reason `generation` is a plain record.
   *
   * None of it is rendered, and wrapping a `Record` of promises and timers in a `ref`
   * would put a deep watcher on every screen that reads this store for no reason at
   * all. What they hold:
   *
   * - `catchUpInFlight` — the `direction:"new"` walk currently running per table, so
   *   two callers share ONE promise instead of racing two loops over one thread.
   * - `catchUpTimers` / `catchUpHold` — the debounce a provisional broadcast arms, and
   *   the flag that says a broadcast arrived while a walk was in progress.
   * - `seenTimer` / `seenHeld` — the throttle window for `POST /seen` and the highest
   *   sequence asked for inside it.
   *
   * All three pairs are per-table and are released by `leaveThread` (and so by
   * `discardThread`), so a client that has opened fifty conversations is not holding
   * fifty live timers — and a trailing edge never outlives the screen that armed it.
   */
  const catchUpInFlight: Record<
    string,
    Promise<CafeResult<ICafeThreadMessage[]>>
  > = {};

  const catchUpTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  const catchUpHold: Record<string, boolean> = {};
  const seenTimer: Record<string, ReturnType<typeof setTimeout>> = {};
  const seenHeld: Record<string, number> = {};

  /**
   * The nonce behind a provisional row's `local:` id.
   *
   * A COUNTER and not a random string, deliberately: it has to be unique **within one
   * store instance**, and a store instance is one page session — after a reload there
   * is no optimistic row left to collide with, because the whole transcript is fresh.
   * `local:` is what makes it safe against the WIRE (see `LOCAL_ID_PREFIX`).
   */
  let sendNonce = 0;

  const loaded = ref<Record<CafeResource, boolean>>({
    feet: false,
    cafe: false,
    tables: false,
    table: false,
    myAccess: false,
    stats: false,
    search: false,
    joined: false,
    messages: false,
    users: false,
  });

  const pending = ref<Record<CafeResource, boolean>>({
    feet: false,
    cafe: false,
    tables: false,
    table: false,
    myAccess: false,
    stats: false,
    search: false,
    joined: false,
    messages: false,
    users: false,
  });

  /** The Persian sentence from `parseCafeFailure(...).message`, already safe to render. */
  const errors = ref<Record<CafeResource, string | null>>({
    feet: null,
    cafe: null,
    tables: null,
    table: null,
    myAccess: null,
    stats: null,
    search: null,
    joined: null,
    messages: null,
    users: null,
  });

  /**
   * The scope each resource's current answer belongs to — `cafeId` and the
   * serialised query. `null` means "nothing fetched yet", and a mismatch means
   * the held answer is about a DIFFERENT café or a different filter, so
   * idempotence must not fire.
   */
  const scopes = ref<Record<CafeResource, string | null>>({
    feet: null,
    cafe: null,
    tables: null,
    table: null,
    myAccess: null,
    stats: null,
    search: null,
    joined: null,
    messages: null,
    users: null,
  });

  /* ---------------------------------------------------------------- getters -- */

  const publicCafes = computed(() =>
    cafes.value.filter((cafe) => cafe.status === "public"),
  );
  const privateCafes = computed(() =>
    cafes.value.filter((cafe) => cafe.status === "privite"),
  );

  const topPublicCafes = computed<ICafe[]>(() => stats.value?.topPublicChannel ?? []);

  /**
   * The cafés this reader administers, as the SET the permission checks ask
   * about. `targetId` is the `id` of whatever the grant names, so the two sets are
   * disjoint by construction and neither is a filter over the other.
   *
   * ## ⚠️ IT IS THE POPULATED ARRAY, AND NEVER `grant.type`
   *
   * `type` is the discriminator the schema declares — and the one that reads as
   * correct in review — but Mongoose validation is the only thing that ever puts
   * it on a document. A grant inserted directly into Mongo carries neither `type`
   * nor `id`, `GET /me/my-ct` hands it back unchanged, and **every**
   * `grant.type === "cafe"` therefore answered `false`: these two sets were
   * always empty, on every reader, for every grant. Measured on the live
   * endpoint: unfiltered returns the café grant, `?type=cafe` returns **0**.
   *
   * `grant.cafe.length` is the discriminator that survives that document. It is
   * also the honest one: the `cafe` virtual populates by `targetId` on `Cafe.id`
   * and the `table` virtual on `Cafe Table.id`, so a populated café array IS the
   * statement "this grant names a café".
   *
   * ⚠️ A grant that populates NEITHER array is in NEITHER set, deliberately. It
   * names nothing that can be rendered, and a permission check that passed on a
   * grant this screen cannot open would be a permission for a destination that
   * does not exist. See `ICafeAccess` for the full measurement.
   */
  const managedCafeIds = computed<Set<string>>(
    () =>
      new Set(
        myAccess.value.filter((grant) => grant.cafe.length > 0).map((g) => g.targetId),
      ),
  );

  /**
   * The tables this reader administers — same rule, the other array. `targetId`
   * is the TABLE's uniqid here (`cafe-access.model.ts`'s `table` virtual matches
   * it on `Cafe Table.id`), which is the value every table permission check in
   * this app already asks about.
   */
  const managedTableIds = computed<Set<string>>(
    () =>
      new Set(
        myAccess.value.filter((grant) => grant.table.length > 0).map((g) => g.targetId),
      ),
  );

  /**
   * The tables the reader is a member of, keyed by the table's `id` — the same
   * value `cafe:table:receive-new-message` carries, so the socket's room can be
   * matched against this set without a second lookup.
   */
  const subscribedTableIds = computed<Set<string>>(
    () => new Set(joined.value.map((channel) => channel.id)),
  );

  /**
   * The unread badge for one table.
   *
   * A FUNCTION and not a computed: the badge is asked per row while a list
   * renders, and a computed would recompute the whole count for every one of
   * them. `0` is the answer for a table this reader has not joined — an absent
   * badge and a zero badge must not be told apart by a screen that would
   * otherwise draw a «۰» on every row of the café's table list.
   */
  function unreadFor(tableId: string): number {
    const row = joined.value.find(
      (channel) => channel.id === tableId || channel.tableId === tableId,
    );

    return row?.unreadMessages ?? 0;
  }

  /* ---------------------------------------------------- messaging getters -- */

  /**
   * The thread the socket is writing into, or `null`.
   *
   * ⚠️ `null` off the thread screen AND after a `leaveThread()` that found nothing
   * cached — never a throwaway thread object, because every reader below would then
   * have to ask whether it is real.
   */
  const thread = computed<ICafeThread | null>(() => {
    const id = activeThreadId.value;

    return id === null ? null : (threads.value[id] ?? null);
  });

  /**
   * The transcript the thread screen renders.
   *
   * ⚠️ `EMPTY_ROWS` (a frozen module-level `[]`) rather than an inline `[]` — see
   * that constant. A new identity per read would re-render the transcript on every
   * tick of the page's 15-second clock.
   */
  const threadMessages = computed<ICafeThreadMessage[]>(() =>
    thread.value === null ? (EMPTY_ROWS as ICafeThreadMessage[]) : thread.value.messages,
  );

  /**
   * One member, as the roster and the presence together know them.
   *
   * THE ROSTER IS THE BASE AND PRESENCE OVERLAYS IT, never the other way round:
   * `GET /table/:tableId/users` carries the avatar and the name, the presence event
   * carries `isOnline` / `lastSeen` / `role`, and neither carries the other. A
   * presence-only member (recorded by `applyPresence` even when the roster has never
   * heard of them) is answered from the presence map alone, which is why this is a
   * MERGE rather than a lookup.
   *
   * ⚠️ `null` is a real answer and not a placeholder: it means «this client knows of
   * nobody with that id», and a bubble that gets it draws no name rather than an
   * empty card that reads as a rendering failure.
   */
  function memberFor(userId: string | null | undefined): ITableUserView | null {
    if (typeof userId !== "string" || userId === "") return null;

    const fromRoster = users.value[userId];
    const live = presence.value[userId];

    if (fromRoster === undefined && live === undefined) return null;

    if (fromRoster === undefined) {
      // Presence alone: the event's `fullName` is the only name there has ever been,
      // and inventing a placeholder around it would be a worse picture than the name.
      return { userId, fullName: live?.fullName, isOnline: live?.isOnline };
    }

    if (live === undefined) return fromRoster;

    // ⚠ The roster has no `role` and the presence event has no avatar — so the merge
    // adds exactly the three fields presence knows and takes nothing else away.
    return {
      ...fromRoster,
      isOnline: live.isOnline,
      lastSeen: live.lastSeen ?? fromRoster.lastSeen,
    };
  }

  /**
   * Is this sequence on the reader's own read frontier?
   *
   * ⚠️ ⚠️ THIS IS **NOT** «did somebody else read it», and nothing in this app may
   * claim that. §8 carries exactly ONE number per table per user, `seen`, and
   * `GET /table/:tableId/users` returns user documents rather than participant
   * records — so there is no `lastReadSequence` per member anywhere on the wire. A
   * «دیده شد» tick on a bubble would therefore be a fabricated claim about other
   * people's reading. What this answers is «has THIS client reported this one», which
   * is a statement about this device and this session.
   */
  function isRead(sequence: number | null | undefined): boolean {
    if (typeof sequence !== "number" || !Number.isFinite(sequence)) return false;

    const frontier = thread.value?.lastReadSequence ?? 0;

    return frontier > 0 && sequence <= frontier;
  }

  /**
   * The sequence a «پیام‌های تازه» divider belongs at, or `null` for «draw none».
   *
   * ⚠️ `null` until this client has actually POSTED a `seen` **this visit**. There
   * is nothing to divide: a thread scrolled back to the top on a fresh entry has no
   * «since you were here» boundary, and inventing one from the newest sequence would
   * draw a divider above everything.
   */
  function newMessagesFrom(tableId: string): number | null {
    const sent = threads.value[tableId]?.lastSeenSent;

    return typeof sent === "number" && sent > 0 ? sent + 1 : null;
  }

  /**
   * The highest `sequence` this client is currently RENDERING for a table, or `null`.
   *
   * ⚠ THIS IS THE NUMBER `POST /seen` MUST CARRY, and it is read off the held rows
   * rather than off `newerCursor`: the cursor is what the SERVER wants next and this is
   * what the READER is looking at, and the two disagree for as long as a live row is
   * still `provisional`. Posting from the cursor alone would report messages this
   * screen has not shown — a receipt for reading nobody did.
   *
   * ⚠ `null` when nothing with a sequence is held, which includes the whole window
   * between entering a conversation and its first page landing. That is the honest
   * answer and `scheduleMarkSeen` ignores it.
   */
  function newestRenderedSequence(tableId: string): number | null {
    const found = threads.value[tableId];

    return found === undefined ? null : newestSequence(found);
  }

  /** The live `messageSendingEnabled` override for one table, `null` = follow the payload. */
  function sendingOverride(tableId: string): ICafeWindowBroadcast | null {
    return threads.value[tableId]?.sendingOverride ?? null;
  }

  /** The live `secureChat` override for one table, `null` = follow the payload. */
  function secureOverride(tableId: string): ICafeWindowBroadcast | null {
    return threads.value[tableId]?.secureOverride ?? null;
  }

  /**
   * The thread's page flags and cursors, for a table that is not the active one.
   *
   * ⚠️ IT CREATES THE ENTRY. Paging state has to be readable for a table the client
   * is not currently in (the «load older» button fires on a thread the socket is
   * writing into, but a refresh or a deep link may ask first), and a getter that
   * answered `null` there would push the same `blankThread()` into every caller. The
   * creation is the point: it is how a table becomes paged at all.
   */
  function threadFor(tableId: string): ICafeThread {
    const existing = threads.value[tableId];

    if (existing !== undefined) return existing;

    const created = blankThread();

    threads.value = { ...threads.value, [tableId]: created };

    return created;
  }

  /**
   * The table's INTERNAL id for a `/cafe/[cafeId]/table/[tableId]` route pair.
   *
   * ⚠️ THE ROUTE CARRIES THE **PUBLIC HANDLE** (`ch_` / `cv_` / `tb_`) and every
   * endpoint that matches on `Cafe Table.id` wants the internal uniqid — §18.13 is
   * blunt about the consequence of getting it wrong: «join the right rooms or you'll
   * be blind». `table_<id>_room` is built from `table.id`, so a socket room joined
   * with a handle receives nothing at all, silently.
   *
   * Two sources, in this order, and both already in this file:
   *
   * 1. `knownTableId(cafeId, handle)` — a row a list already holds, which is free.
   * 2. **the `/single` answer, but only while it is the answer FOR THIS PAIR.** The
   *    scope check is not tidiness: `cafe.table` still holds the PREVIOUS table for
   *    the whole window between a param change and the new answer, so answering from
   *    it unconstrained would join the room of the conversation the reader just left
   *    under the address of the one they opened — and every event that arrives would
   *    then be applied to the wrong thread.
   */
  function internalTableId(cafeId: string, handle: string): string | null {
    const cafe = usableId(cafeId);
    const value = usableId(handle);

    if (cafe === null || value === null) return null;

    const known = knownTableId(cafe, value);

    if (known !== null) return known;

    if (scopes.value.table === `${cafe}|${value}`) return table.value?.id ?? null;

    return null;
  }

  /* ----------------------------------------------------------- bookkeeping -- */

  /**
   * The safe empty value of every resource, in one place, so a refusal and a
   * `reset` cannot drift apart.
   */
  const CLEARED: Record<CafeResource, () => void> = {
    feet: () => {
      cafes.value = [];
    },
    cafe: () => {
      activeCafe.value = null;
    },
    tables: () => {
      tables.value = [];
    },
    table: () => {
      table.value = null;
    },
    myAccess: () => {
      myAccess.value = [];
    },
    stats: () => {
      stats.value = null;
    },
    search: () => {
      searchResults.value = [];
    },
    joined: () => {
      joined.value = [];
    },
    /**
     * ⚠️ **A `messages` REFUSAL NEVER EMPTIES THE TRANSCRIPT**, and this is the one
     * resource whose entry deliberately contradicts the record above.
     *
     * `run()` reaches this on BOTH kinds of read — the cold first load AND the paged
     * «پیام‌های قدیمی‌تر» — and a refusal is a throttle, a 5xx or a dropped
     * connection. Deleting the entry on the paged kind destroyed a transcript the
     * reader was looking at: the empty state then claimed «هنوز پیامی در این گفتگو
     * نیست», the paging button disappeared, and — no screen renders
     * `errors.messages` — nothing anywhere said why. `catchUpMessages` has always
     * worked this way and it is the right answer: **a refusal is a sentence for the
     * caller, never an empty conversation.**
     *
     * ⚠️ THE PAGING STATE IS KEPT TOO, and `MessageList`'s `canLoadOlder`
     * (`hasOlder === true && olderCursor !== null`) is what decides that: resetting
     * the cursors would remove the control that is the reader's ONLY retry, and
     * nothing else sets them until a successful `direction:"old"` read — which only
     * that control can ask for. So a refused page keeps the button, one tap retries,
     * and only the two in-flight spinners — which no answer is coming for — go false.
     *
     * ⚠️ ONLY THE ACTIVE THREAD, and ONLY while there is one. A `messages` read that
     * was superseded by `leaveThread()` must not reach into whatever thread happens
     * to be active now — that would be a request landing against a scope this store
     * has already left, which is the whole thing the generation counter exists to
     * refuse. And it is the RIGHT thread, not merely «a» thread, because `messages`
     * is only ever read for the thread the socket is in — `enterThread` is what every
     * caller goes through first — so the active one is by definition the one the
     * refusal is about. That is an invariant of the callers rather than of `run()`,
     * which has no idea which table a scope named.
     */
    messages: () => {
      const id = activeThreadId.value;
      if (id === null) return;

      const target = threads.value[id];
      if (target === undefined) return;

      // ⚠ The rows, the cursors and the read frontier all stay: only the two spinners
      // belong to a request that has already been refused.
      target.loadingOlder = false;
      target.loadingNewer = false;
    },
    /**
     * ⚠️ **NOTHING GOES, AND THE STALE ROSTER IS DELIBERATELY RETAINED.**
     *
     * `fetchUsers` runs on every resync, so one throttled or 5xx'd roster read would
     * otherwise blank the `fullName` / `avatar` EVERY bubble's sender resolves from —
     * and no screen renders `errors.users` either, so the names would vanish with
     * nothing said anywhere. That is exactly why the "a stale list under a fresh error
     * sentence" rationale cannot apply to this resource: there IS no sentence on
     * screen to be stale under. A slightly old name is a small lie; a nameless
     * conversation is the larger one, and `isFresh` refuses to serve a refused answer
     * anyway, so the next resync re-reads it and overwrites this map wholesale.
     *
     * ⚠️ `presence` is not cleared with it either: presence arrives over the socket
     * and is not an answer to this request.
     */
    users: () => {
      // ⚠ Intentionally empty — see the header. A refusal must not empty the roster.
    },
  };

  /**
   * One counter per resource: how many times this resource has been ASKED for.
   *
   * `scope` answers "may this held answer be served again?", which is not the
   * same question as "is the request that is still in the air the one this screen
   * is waiting for?" — and the second question is the one a navigation asks. So
   * every `run()` takes the next number for its resource before its first
   * `await`, and every action re-reads it immediately before writing a shared
   * ref. A mismatch means a newer request (or a `reset`) has taken the resource
   * over, and this answer belongs to a scope the screen has already left.
   *
   * Deliberately NOT a `ref`: nothing renders it, and wrapping it would put a
   * deep watcher on every screen that reads the store for no reason.
   */
  const generation: Record<CafeResource, number> = {
    feet: 0,
    cafe: 0,
    tables: 0,
    table: 0,
    myAccess: 0,
    stats: 0,
    search: 0,
    joined: 0,
    messages: 0,
    users: 0,
  };

  /**
   * The answer a superseded request hands back.
   *
   * It writes nothing, because the request that replaced it now owns every flag:
   * a stale `errors` write would put the previous café's sentence on the current
   * café's screen, and a stale `CLEARED` would delete the rows the newer answer
   * just delivered. And it is a **refusal** rather than an empty success —
   * «the answer that landed belongs to a scope you have left» is not «the answer
   * was empty», and a caller that believes otherwise would draw an empty list.
   *
   * It is the same SHAPE the `catch` branch of `run` returns — one
   * `CafeFailure`, so a caller has a single case to handle — but it no longer
   * borrows that branch's sentence: `ERR_SUPERSEDED` plus its own
   * `SENTENCES.*.superseded` is what keeps a stale answer from being reported
   * to a reader as «اتصال اینترنت را بررسی کنید».
   */
  function superseded<T>(resource: CafeResource): CafeResult<T> {
    return {
      ok: false,
      failure: guardFailure("ERR_SUPERSEDED", SENTENCES[resource].superseded),
    };
  }

  /**
   * Do we already hold this exact answer?
   *
   * An error deliberately makes the answer "no": the empty states' `#action`
   * retry re-calls the action, and a retry that returned the refusal again
   * without asking the server is a retry that does nothing.
   */
  function isFresh(resource: CafeResource, scope: string): boolean {
    return (
      loaded.value[resource] &&
      scopes.value[resource] === scope &&
      errors.value[resource] === null
    );
  }

  /**
   * The one place a resource's three flags move, so no action can set one and
   * forget another. `request` only decides WHAT the answer is.
   *
   * `seq` is handed to it so the action can tell, at the moment it is about to
   * write a shared ref, whether this request is still the one the screen is
   * waiting for. `run` then applies the SAME check to the flags: an answer that
   * lost the race must not set `errors`/`loaded`/`pending` either, or a stale
   * request would wipe the rows the winner has just written.
   *
   * The `pending` check in the `finally` is what keeps the flag honest under
   * overlap: a superseded request must not switch the skeleton off while the
   * request that replaced it is still in the air. It cannot leave `pending` stuck
   * either — the newest generation for a resource is always a `run` with its own
   * `finally`, or a `reset` which clears the flag itself.
   */
  async function run<T>(
    resource: CafeResource,
    scope: string,
    request: (seq: number) => Promise<CafeResult<T>>,
  ): Promise<CafeResult<T>> {
    const seq = (generation[resource] += 1);

    pending.value[resource] = true;
    errors.value[resource] = null;
    scopes.value[resource] = scope;

    try {
      const result = await request(seq);

      if (generation[resource] !== seq) return result;

      if (!result.ok) {
        errors.value[resource] = result.failure.message;
        // A stale list under a fresh error sentence reads as «the server sent
        // these rows AND refused», which is not a thing that can be true — and
        // `CLEARED` is where a resource says so, or deliberately opts out
        // (`messages` and `users` keep their rows; see their own entries).
        CLEARED[resource]();
      }

      // On success AND on refusal: both are answers, and a screen that waits for
      // `loaded` before choosing between its empty block and its list must not
      // wait out a refusal as well.
      loaded.value[resource] = true;

      return result;
    } catch {
      // Every field the actions read is guarded, so this is only reachable if a
      // proxy answers with a shape no reader anticipated — which is exactly the
      // case the frozen contract still has to survive. It is caught HERE rather
      // than at eight call sites because the contract says no action rejects: a
      // screen that `await`s one would land on a route-level error page instead
      // of the one sentence written for it.
      if (generation[resource] !== seq) return superseded<T>(resource);

      const sentence = SENTENCES[resource].net;

      errors.value[resource] = sentence;
      CLEARED[resource]();
      loaded.value[resource] = true;

      return { ok: false, failure: parseCafeFailure(null, sentence) };
    } finally {
      if (generation[resource] === seq) pending.value[resource] = false;
    }
  }

  /**
   * Forget one resource completely, so the next call to its action goes to the
   * server. This is the escape hatch the `#action` retry slot of every empty
   * state uses.
   *
   * It is NOT needed after a refusal: a refusal leaves `errors[resource]` set,
   * which is precisely what stops `isFresh` from answering, so re-calling the
   * action already re-asks. What it IS for is a screen holding a genuinely
   * EMPTY and perfectly true list that may now be out of date — a reader who
   * joined a conversation and navigated back, a list read before the change that
   * filled it. There the held answer is correct and merely old, and nothing
   * else in the store can tell the difference.
   *
   * It also INVALIDATES the resource's generation, so a request that is already
   * in the air for the answer just forgotten cannot write over the `reset` when
   * it lands: the forgotten list is gone, and the response that would put it back
   * describes a scope this screen has left.
   */
  function reset(resource: CafeResource): void {
    generation[resource] += 1;

    loaded.value[resource] = false;
    pending.value[resource] = false;
    errors.value[resource] = null;
    scopes.value[resource] = null;
    CLEARED[resource]();
  }

  /* ---------------------------------------------------------------- helpers -- */

  /**
   * The table's `id` out of what the store already holds, given either spelling —
   * and **the café it must belong to**.
   *
   * ⚠️ This is the whole of the id-vs-tableId decision, so it is worth stating:
   * `GET /table/:cafeId/:tableId/single` matches `{ cafeId, id: tableId }` — the
   * table's INTERNAL uniqid, which `docs/Cafe-Api-Docs.md` §7.1 states outright
   * («`tableId` (همان `id` میز)») and the backend's `$match` confirms. A URL
   * under `/cafe/[cafeId]/table/…` carries the PUBLIC `ch_` / `cv_` / `tb_`
   * handle instead, because that is the one a café page can print and a reader
   * can type. So `fetchTable` accepts what the route has and hands the endpoint
   * what it wants.
   *
   * ⚠️ AND THE CAFÉ IS PART OF THE MATCH, because the id this returns is sent under
   * the café in the URL. The lists below are merged across cafés, so a reader in
   * table `ch_abc` of café B who opens `/cafe/A/table/ch_abc` would otherwise send
   * **B's internal id to `/api/cafe/table/A/…`** — a wrong id under a café that
   * does not own it, which is either an empty conversation or somebody else's
   * table. Rows carrying no `cafeId` at all (a subscribed or a search row, whose
   * endpoint does not populate it) are still eligible, because refusing them
   * outright would break the ordinary case this function exists for.
   */
  function knownTableId(cafeId: string, value: string): string | null {
    const rows: Array<{ id: string; tableId?: string; cafeId?: string }> = [
      ...tables.value,
      ...joined.value,
      ...searchResults.value,
    ];

    const matches = (row: { id: string; tableId?: string }): boolean =>
      row.id === value || row.tableId === value;

    // This café's own rows first…
    const owned = rows.find((row) => row.cafeId === cafeId && matches(row));

    if (owned !== undefined) return owned.id;

    // …then a row that does not say which café it is. A row that DOES say, and
    // says a different café, is never a candidate — see the header.
    const unowned = rows.find((row) => !row.cafeId && matches(row));

    return unowned?.id ?? null;
  }

  /**
   * The café's tables, read for ONE purpose and then dropped.
   *
   * A deep link into `/cafe/[cafeId]/table/[tableId]` arrives with the public
   * handle and an empty store, so there is nothing to resolve it against and the
   * single-table request would match nothing and come back `200` with no table —
   * a silent empty screen for a conversation that exists. One extra read fixes
   * it.
   *
   * It deliberately does NOT write `tables`, and does not touch the `tables`
   * flags: marking a list fetched by a screen that never asked for it would let
   * `/cafe/[cafeId]/table` render its rows without ever having loaded them.
   *
   * Bounded by one page, so a café with more tables than that leaves its tail
   * unresolvable — the failure is a sentence on a screen, never a wrong table.
   *
   * `seq` is the `run` generation this read belongs to: a thread the reader has
   * already navigated away from must not go asking the server on the way out.
   */
  async function resolveTableId(
    fetcher: CafeFetcher,
    cafeId: string,
    value: string,
    seq: number,
  ): Promise<string> {
    const known = knownTableId(cafeId, value);
    if (known !== null) return known;

    const payload = await readCafe<ICafeTablesResponse>(
      fetcher,
      `/api/cafe/table/${encodeURIComponent(cafeId)}`,
      { limit: LARGE_PAGE_SIZE },
    );

    if (generation.table !== seq) return value;
    if (!isCafeSuccess(payload) || !Array.isArray(payload.tables)) return value;

    const rows: Array<{ id: string; tableId?: string }> = payload.tables;
    const found = rows.find((row) => row.id === value || row.tableId === value);

    // Unresolved: the value goes out as it came. `fetchTable` still treats an
    // empty answer as `ERR_TABLE_NOT_FOUND`, so the worst case is a sentence on
    // a screen, never a wrong table.
    return found?.id ?? value;
  }

  /* --------------------------------------------------------------- actions -- */

  /**
   * `GET /cafes/feet` — the two recommended lists in one answer.
   *
   * Concatenated rather than kept apart because every screen that reads them
   * reads a single list, and `status` on each row already says which half it
   * came from (`publicCafes` / `privateCafes` re-split it when the rail asks).
   */
  async function fetchFeet(query?: ICafeFeetQuery): Promise<CafeResult<ICafe[]>> {
    // ⚠ NOT a bare `$fetch`, and taken BEFORE the first await. See the file header.
    const requestFetch = cafeFetcher();
    const scope = JSON.stringify(query ?? {});

    if (isFresh("feet", scope)) return { ok: true, data: cafes.value };

    return run("feet", scope, async (seq) => {
      const payload = await readCafe<ICafeFeetResponse>(
        requestFetch,
        "/api/cafe/feet",
        {
          ...(query?.q && { q: query.q }),
          ...(query?.page && { page: query.page }),
          ...(query?.limit && { limit: query.limit }),
        },
      );

      if (!isCafeSuccess(payload)) return refused("feet", payload);

      // ⚠ `privite` is the backend's own misspelling. See `app/types/cafe.ts` rule 2.
      // Both halves are read through `Array.isArray` rather than `?? []`, because
      // a spread of a non-array THROWS and an action that rejects takes the
      // screen to an error page instead of to its own list.
      const list = [
        ...(Array.isArray(payload.data?.public) ? payload.data.public : []),
        ...(Array.isArray(payload.data?.privite) ? payload.data.privite : []),
      ];

      if (generation.feet !== seq) return superseded("feet");

      cafes.value = list;

      return { ok: true, data: list };
    });
  }

  /**
   * `GET /:id/single`.
   *
   * ⚠️ An unknown café answers `200` with `cafe` ABSENT rather than 404, so a
   * plain success check would report a café that does not exist. That is the one
   * place a refusal is manufactured from a successful answer, and it is fed
   * through `parseCafeFailure` so the caller still has one failure shape and a
   * real `reason` to branch on.
   */
  async function fetchCafe(cafeId: string): Promise<CafeResult<ICafe>> {
    const requestFetch = cafeFetcher();
    const id = usableId(cafeId);
    const scope = id ?? "";

    if (id !== null && isFresh("cafe", scope) && activeCafe.value !== null) {
      return { ok: true, data: activeCafe.value };
    }

    return run("cafe", scope, async (seq) => {
      if (id === null) {
        return { ok: false, failure: guardFailure("ERR_CAFE_NOT_FOUND", SENTENCES.cafe.refused) };
      }

      const payload = await readCafe<ICafeSingleResponse>(
        requestFetch,
        `/api/cafe/${encodeURIComponent(id)}`,
      );

      if (!isCafeSuccess(payload)) return refused("cafe", payload);

      if (!payload.cafe) {
        return { ok: false, failure: guardFailure("ERR_CAFE_NOT_FOUND", SENTENCES.cafe.refused) };
      }

      if (generation.cafe !== seq) return superseded("cafe");

      // The last response is the only honest one to keep: `view` increments on
      // EVERY call, so a stale object under-reports the counter.
      activeCafe.value = payload.cafe;

      return { ok: true, data: payload.cafe };
    });
  }

  /**
   * `GET /table/:cafeId/tables` — one café's tables, with every filter applied
   * BY THE SERVER for a reader too (unlike the management list).
   */
  async function fetchTables(
    cafeId: string,
    query?: ICafeTablesQuery,
  ): Promise<CafeResult<ICafeTableView[]>> {
    const requestFetch = cafeFetcher();
    const id = usableId(cafeId);
    const scope = `${id ?? ""}|${JSON.stringify(query ?? {})}`;

    if (id !== null && isFresh("tables", scope)) {
      return { ok: true, data: tables.value };
    }

    return run("tables", scope, async (seq) => {
      if (id === null) {
        return { ok: false, failure: guardFailure("ERR_CAFE_NOT_FOUND", SENTENCES.tables.refused) };
      }

      const payload = await readCafe<ICafeTablesResponse>(
        requestFetch,
        `/api/cafe/table/${encodeURIComponent(id)}`,
        {
          ...(query?.page && { page: query.page }),
          ...(query?.limit && { limit: query.limit }),
          ...(query?.status && { status: query.status }),
          ...(query?.q && { q: query.q }),
          ...(query?.sort && { sort: query.sort }),
          ...(query?.type && { type: query.type }),
          // ⚠️ STRINGS, not booleans — sending `true` filters on nothing and the
          // whole unfiltered list comes back. See `CafeBooleanFilter`.
          ...(query?.isActive && { isActive: query.isActive }),
          ...(query?.enabled && { enabled: query.enabled }),
          ...(query?.free && { free: query.free }),
        },
      );

      if (!isCafeSuccess(payload)) return refused("tables", payload);

      // `tables` is nullable on a successful answer; an empty list and an absent
      // one are the same thing to a screen, and `[]` is what it can render.
      const list = Array.isArray(payload.tables) ? payload.tables : [];

      if (generation.tables !== seq) return superseded("tables");

      tables.value = list;

      return { ok: true, data: list };
    });
  }

  /**
   * `GET /table/:cafeId/:tableId/single` — one conversation.
   *
   * Takes the PUBLIC `tableId` a `/cafe/…/table/…` route carries and sends the
   * table's internal `id`, because the endpoint matches on `id`; see
   * `resolveTableId` for the full statement of that decision.
   *
   * ⚠️ `table` is **ONE OBJECT** ON THE WIRE, NOT AN ARRAY — `getSingleTable`
   * keeps only the first document its pipeline produced and sends that object, so
   * reading it as an array turned every successful answer into a manufactured
   * `ERR_TABLE_NOT_FOUND`. The array branch is kept so an answer of that shape is
   * still read, and `subscribe` on it — a single participant, never the roster —
   * is coerced to the array `ICafeTableView` promises. See `ICafeSingleTableResponse`.
   */
  async function fetchTable(
    cafeId: string,
    tableId: string,
  ): Promise<CafeResult<ICafeTableView>> {
    const requestFetch = cafeFetcher();
    const cafe = usableId(cafeId);
    const handle = usableId(tableId);
    const scope = `${cafe ?? ""}|${handle ?? ""}`;

    if (cafe !== null && handle !== null && isFresh("table", scope) && table.value !== null) {
      return { ok: true, data: table.value };
    }

return run("table", scope, async (seq) => {
      if (cafe === null) {
        return { ok: false, failure: guardFailure("ERR_CAFE_NOT_FOUND", SENTENCES.table.refused) };
      }

      if (handle === null) {
        return { ok: false, failure: guardFailure("ERR_TABLE_NOT_FOUND", SENTENCES.table.refused) };
      }

      const id = await resolveTableId(requestFetch, cafe, handle, seq);

      const payload = await readCafe<ICafeSingleTableResponse>(
        requestFetch,
        `/api/cafe/table/${encodeURIComponent(cafe)}/${encodeURIComponent(id)}/single`,
      );

      if (!isCafeSuccess(payload)) return refused("table", payload);

      // ⚠ NEITHER SHAPE MAY BE ASSUMED. The wire sends ONE object today
      // (`CafeSingleTableWire`), and an array is read rather than refused so a
      // change on the backend cannot silently become «this conversation does not
      // exist» on every table at once.
      const wire = payload.table as CafeSingleTableWire | CafeSingleTableWire[] | null;
      const row = Array.isArray(wire) ? wire[0] : (wire ?? undefined);

      // The other success-with-nothing, and it is a REAL case: a `$match` that
      // finds no table is answered `table: undefined` under `success: true` (the
      // aggregation simply produced nothing), which would otherwise render as a
      // conversation with no name and no composer.
      if (!row) {
        return { ok: false, failure: guardFailure("ERR_TABLE_NOT_FOUND", SENTENCES.table.refused) };
      }

      // Normalisation: the store-owned shape, not the wire's — see
      // `normalizeSubscribe` for why `subscribe` is an array here and one object
      // there.
      const normalized: ICafeTableView = {
        ...row,
        subscribe: normalizeSubscribe(row.subscribe),
      };

      if (generation.table !== seq) return superseded("table");

      table.value = normalized;

      return { ok: true, data: normalized };
    });
  }

  /**
   * `GET /me/my-ct` — every management grant this reader holds.
   *
   * `page` is forced to `MY_ACCESS_PAGE` and the caller's own `page` is dropped
   * on purpose: on this endpoint `page` is the row COUNT and the offset base at
   * once, so every value of it that reads as a page destroys the query. The
   * arithmetic is in `MY_ACCESS_PAGE`.
   *
   * ## ⚠️ CALL IT WITH **NO** `type`. THE PARAMETER IS A TRAP, NOT A FILTER.
   *
   * `query.type` is accepted and forwarded because the contract carries it — and
   * because it is the one thing on this endpoint that must not be used:
   *
   * | request       | rows returned (measured, live)                          |
   * |---------------|-------------------------------------------------------|
   * | unfiltered    | **2** — one café grant and one table grant            |
   * | `?type=cafe`  | **0** ← the café grant is silently missed              |
   * | `?type=table` | 1 — only the grant Mongoose wrote, with its `type`     |
   *
   * ⚠️ Re-measured later (that session's table grant had elapsed, and this
   * endpoint filters `endAt` where `isManager` does not): unfiltered then answered
   * **1** row and `?type=table` **0**. The filter columns do not move, and neither
   * does the hazard.
   *
   * `getUserCafeAndTableAccess` filters with `{ type }`, and a grant document
   * inserted straight into Mongo carries **no `type`** (the schema requires it;
   * validation is the only thing that ever puts it there). So the filter matches
   * nothing for such a grant and answers `success: true` with an empty list —
   * indistinguishable from «you administer nothing», which is why this action's
   * default is NO `type` and why `/cafe/management` calls it with no argument at
   * all. **Do not "optimise" a call site into passing `type`**; it looks like the
   * obvious optimisation and it empties the screen. `ICafeAccess` states the same
   * hazard from the types side, and `managedCafeIds` / `managedTableIds` are the
   * reason it reaches the UI.
   *
   * `endAt` is the ONE filter the backend applies by itself (`null` or
   * `>= now`), and `startAt` is NOT one — compare it here.
   */
  async function fetchMyAccess(
    query?: ICafeMyAccessQuery,
  ): Promise<CafeResult<ICafeAccess[]>> {
    const requestFetch = cafeFetcher();
    const scope = query?.type ?? "";

    if (isFresh("myAccess", scope)) return { ok: true, data: myAccess.value };

    return run("myAccess", scope, async (seq) => {
      const payload = await readCafe<ICafeMyAccessResponse>(
        requestFetch,
        "/api/cafe/my-ct",
        {
          ...(query?.type && { type: query.type }),
          page: MY_ACCESS_PAGE,
        },
      );

      if (!isCafeSuccess(payload)) return refused("myAccess", payload);

      const rows: ICafeAccessRow[] = Array.isArray(payload.data) ? payload.data : [];

      // Normalisation: at most ONE of the pair is ever populated — the `cafe`
      // virtual matched by `targetId` or the `table` one, never both — and a
      // populate that found nothing answers `null` rather than omitting the key,
      // so an absent pair arrives as either. `ICafeAccess` promises both as
      // ARRAYS because the grants list reads them unconditionally, and the types
      // file hands that normalisation to the store on purpose. Which of the two is
      // populated is also the ONLY reliable statement about what kind of grant
      // this is; see the header above and `managedCafeIds` below.
      const list: ICafeAccess[] = rows.map((row) => ({
        ...row,
        cafe: row.cafe ?? [],
        table: row.table ?? [],
      }));

      if (generation.myAccess !== seq) return superseded("myAccess");

      myAccess.value = list;

      return { ok: true, data: list };
    });
  }

  /**
   * `GET /stats` — the café statistics, of which only `topPublicChannel` has a
   * screen.
   *
   * ⚠️ `stats` is the `$facet` output: an array holding exactly one object, so
   * `[0]` is taken and never iterated. `cafesActive` / `cafesByStatus` are
   * `$group` rows rather than counts — see `ICafeStats`.
   */
  async function fetchStats(): Promise<CafeResult<ICafeStats>> {
    const requestFetch = cafeFetcher();

    if (isFresh("stats", "")) {
      const held = stats.value;
      if (held !== null) return { ok: true, data: held };
    }

    return run("stats", "", async (seq) => {
      const payload = await readCafe<ICafeStatsResponse>(requestFetch, "/api/cafe/stats");

      if (!isCafeSuccess(payload)) return refused("stats", payload);

      const row = Array.isArray(payload.stats) ? payload.stats[0] : undefined;

      if (!row) {
        // A success with nothing in it: there is no reason to report, only a
        // sentence — `parseCafeFailure(null, …)` is exactly that, and it is why
        // the statistics screen may say «try again» instead of showing zeroes.
        return refused("stats", payload);
      }

      if (generation.stats !== seq) return superseded("stats");

      stats.value = row;

      return { ok: true, data: row };
    });
  }

  /**
   * `GET /table/q` — quick table search.
   *
   * ⚠️ `text` is REQUIRED and the endpoint answers `result: null` (not `[]`)
   * without it, so an empty field is short-circuited here rather than turned
   * into a request that can only ever look like a failed one.
   *
   * ⚠️ `cafeId` is forwarded but NOT a filter this endpoint reads: its query is
   * `text` / `page` / `limit` and nothing else. Narrowing to one café is the
   * caller's job, client-side, over the returned rows.
   */
  async function searchTables(q: {
    text: string;
    cafeId?: string;
    page?: number;
    limit?: number;
  }): Promise<CafeResult<ICafeTableView[]>> {
    const requestFetch = cafeFetcher();
    const text = usableId(q.text);

    // No request, no flags touched: a reader who has not typed anything has not
    // asked a question, and an empty block is the honest answer for it.
    if (text === null) {
      searchResults.value = [];

      return { ok: true, data: [] };
    }

    const cafeId = usableId(q.cafeId);
    const page = q.page ?? SEARCH_PAGE;
    const limit = q.limit ?? SEARCH_LIMIT;
    const scope = `${text}|${cafeId ?? ""}|${page}|${limit}`;

    if (isFresh("search", scope)) {
      return { ok: true, data: searchResults.value };
    }

    return run("search", scope, async (seq) => {
      const payload = await readCafe<ICafeSearchResponse>(requestFetch, "/api/cafe/table/q", {
        text,
        page,
        limit,
        ...(cafeId !== null && { cafeId }),
      });

      if (!isCafeSuccess(payload)) return refused("search", payload);

      // ⚠️ `null`, not `[]`, when the endpoint found nothing it could serialise.
      const list = Array.isArray(payload.result) ? payload.result : [];

      if (generation.search !== seq) return superseded("search");

      searchResults.value = list;

      return { ok: true, data: list };
    });
  }

  /**
   * `GET /table/subscribed` — every conversation the reader is an active member
   * of, with its unread badge. One large page; see `LARGE_PAGE_SIZE` for the
   * `$limit`-before-`$skip` bug that makes the server's own paging unusable.
   *
   * ⚠️ `limit` is NOT the caller's, in either direction: a smaller one truncates
   * a list with no second request to finish it, and a larger one cannot survive
   * the proxy's `MAX_PAGE_SIZE` clamp. So this action asks for `LARGE_PAGE_SIZE`
   * and the caller's `limit` is ignored on purpose — see that constant.
   */
  async function fetchSubscribed(
    query?: ICafeSubscribedQuery,
  ): Promise<CafeResult<ICafeChannel[]>> {
    const requestFetch = cafeFetcher();
    // Only `sort` is the caller's: it is honoured server-side. `page`/`limit`
    // are decided above and are not forwarded.
    const scope = query?.sort ?? "desc";

    if (isFresh("joined", scope)) return { ok: true, data: joined.value };

    return run("joined", scope, async (seq) => {
      const payload = await readCafe<ICafeSubscribedResponse>(
        requestFetch,
        "/api/cafe/table/subscribed",
        {
          page: 1,
          limit: LARGE_PAGE_SIZE,
          ...(query?.sort && { sort: query.sort }),
        },
      );

      if (!isCafeSuccess(payload)) return refused("joined", payload);

      const rows: SubscribeItem[] = Array.isArray(payload.channels)
        ? payload.channels
        : [];

      // Normalisation: the endpoint does NOT flatten. Each entry is the
      // PARTICIPANT document with `table` and `cafe` `$lookup`ed in beside it
      // (so `channel.roomId` and `channel.table.nikname` are what four existing
      // screens read off the raw answer), while `ICafeChannel` is the flattened
      // shape the rows are rendered from. Spreading `table` up to the top level
      // is what makes `id`, `nikname`, `tableId` and `lastMessage` read the same
      // as they do in every other table list.
      //
      // `roomId` is the table's `id` — the same value the participant record
      // already carries, restated under the name the flat shape documents.
      //
      // ⚠️ `unreadMessages` is computed backend-side as
      // `messageSecunce - lastReadSequence` with NO clamp, so a message deleted
      // after it was counted leaves the badge NEGATIVE — and a negative number
      // is truthy, so an unclamped value draws «‎-۳» on a row that has nothing
      // unread. Clamped here, where the arithmetic's meaning is known.
      const list: ICafeChannel[] = rows.map((row) => ({
        ...row.table,
        roomId: row.table.id,
        unreadMessages: Math.max(0, row.unreadMessages ?? 0),
        cafe: row.cafe,
      }));

      if (generation.joined !== seq) return superseded("joined");

      joined.value = list;

      return { ok: true, data: list };
    });
  }

  /* --------------------------------------------------- thread: enter / leave -- */

  /**
   * Make this table THE thread — the one the socket writes into and the one the
   * screen renders. ⚠️ The table's **INTERNAL** id, never the `ch_`/`cv_`/`tb_`
   * handle a route carries (§18.13: join the right room or be blind).
   *
   * It is the only writer of `activeThreadId`, and that is the whole reason the
   * socket composable can rely on «one writer»: three of §14's payloads carry no
   * table id, so «which thread am I in» has exactly one answer and exactly one place
   * that changes it.
   */
  function enterThread(tableId: string): void {
    const id = usableId(tableId);
    if (id === null) return;

    const target = threadFor(id);

    activeThreadId.value = id;

    // ⚠ `joined` IS SET **ONLY** FROM A PAYLOAD THIS CLIENT HOLDS, AND `table.value`
    // IS CHECKED AGAINST THE ID rather than against its scope: after a navigation it
    // still holds the PREVIOUS table for the whole window before the new answer
    // lands, and a membership flag copied from that row would tell the reader they
    // are a member of the conversation they just left.
    //
    // ⚠ AND IT STAYS `false` WHEN THE PAYLOAD CANNOT SAY (§18.4: `subscribe` is NOT
    // filtered by the requesting user, and its `$lookup` only ever matches ACTIVE
    // participants). `false` here means «this client cannot vouch for it», which is
    // the same honest `false` a non-member has, and it is NOT a gate on reading.
    const mine = myId.value;
    const answer = table.value;

    if (mine !== null && answer !== null && answer.id === id) {
      const row = answer.subscribe?.find((entry) => entry.userId === mine);

      if (row !== undefined && row.status === "active") target.joined = true;
    }
  }

  /**
   * Stop being THE thread.
   *
   * ⚠️ IT KEEPS THE CACHE BY DEFAULT, and that is the requirement «a transcript must
   * survive navigating between two tables»: going back to a conversation shows what
   * was there rather than a re-read. `discard: true` is the OTHER case — a table the
   * reader deliberately LEFT, where a stale transcript under a fresh membership band
   * is exactly «a stale list under a fresh state».
   */
  function leaveThread(discard = false): void {
    const id = activeThreadId.value;

    activeThreadId.value = null;

    // ⚠ THE TIMERS ARE CANCELLED WITH THE THREAD, WHETHER OR NOT THE CACHE IS KEPT.
    // They are per-table, and a trailing edge left armed past the leave still fires:
    // `flushSeen(id)` → `threadFor(id)` would RECREATE the entry the caller was just
    // told it had left and POST a read receipt for a table the reader is no longer in.
    if (id !== null) releaseThreadTimers(id);

    if (id !== null && discard) discardThread(id);
  }

  /** Forget one table's thread entirely — the leave case. See `leaveThread`. */
  function discardThread(tableId: string): void {
    const id = usableId(tableId);
    if (id === null) return;

    const rest = { ...threads.value };
    delete rest[id];
    threads.value = rest;

    // ⚠ THE HANDLES ARE DROPPED *AND* THE TIMERS ARE CANCELLED, by the same helper
    // `leaveThread` uses, so the two call sites cannot drift: deleting the map entries
    // alone leaves the timers armed for up to `SEEN_THROTTLE_MS`, and the trailing edge
    // then calls `flushSeen(id)` → `threadFor(id)` — which RECREATES the entry the
    // caller was just told was discarded. Cancelling first, then deleting
    // `seenHeld`/`catchUpHold`, means a fire racing this line finds nothing to flush.
    releaseThreadTimers(id);
  }

  /**
   * Cancel and forget one table's timers and held numbers.
   *
   * ⚠ THE HANDLES ARE CLEARED **BEFORE** THE HELD VALUES ARE DELETED, and that order
   * is the point: a trailing edge firing in between must find nothing to post and
   * nothing to walk, rather than a half-cleared table it would then recreate through
   * `threadFor`. Both `leaveThread` and `discardThread` call this, so a reader who has
   * opened fifty conversations is not holding fifty live timers either way.
   */
  function releaseThreadTimers(tableId: string): void {
    if (seenTimer[tableId] !== undefined) clearTimeout(seenTimer[tableId]);
    if (catchUpTimers[tableId] !== undefined) clearTimeout(catchUpTimers[tableId]);

    delete seenTimer[tableId];
    delete seenHeld[tableId];
    delete catchUpTimers[tableId];
    delete catchUpHold[tableId];
  }

  /* ------------------------------------------------------- thread: history -- */

  /**
   * ONE page of one conversation's history.
   *
   * ```
   * fetchMessages(tableId)                          → the FIRST window, no cursor
   * fetchMessages(tableId, { direction: "old" })     → …which is the same call
   * fetchMessages(tableId, { direction: "old", cursor: t.olderCursor }) → older
   * fetchMessages(tableId, { direction: "new", cursor: t.newerCursor }) → newer
   * ```
   *
   * ⚠️ `cursor` IS **OMITTED** ON A FIRST LOAD AND IT IS NOT A DEFAULT (§15): with no
   * `cursor` the upstream starts from **the reader's own `lastReadMessageId`**, so a
   * «load older» that forgot its cursor is silently a read-receipt-relative read.
   * That is why `olderCursor` is kept per direction and why an absent cursor means
   * «first load» and never «oldest».
   *
   * ⚠️ `isFresh` MAY ANSWER FOR THE CURSORLESS FIRST LOAD **ONLY**. A paged read always
   * goes to the server: the held answer is a PAGE, not a thread, and serving it twice
   * would drop the very page the reader asked for.
   */
  async function fetchMessages(
    tableId: string,
    query?: ICafeMessagesQuery,
  ): Promise<CafeResult<ICafeThreadMessage[]>> {
    // ⚠ NOT a bare `$fetch`, and taken BEFORE the first await. See the file header.
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);
    const direction: CafeMessagesDirection = query?.direction ?? "old";

    const cursor =
      typeof query?.cursor === "number" && Number.isFinite(query.cursor)
        ? query.cursor
        : null;

    // ⚠ THE CURSORLESS CALL IS THE ONE THAT MAY BE SERVED FROM WHAT IS HELD.
    const cursorless = cursor === null;
    const scope = `${id ?? ""}|${direction}|${cursorless ? "first" : cursor}`;

    if (cursorless && isFresh("messages", scope)) {
      return { ok: true, data: threads.value[id ?? ""]?.messages ?? [] };
    }

    return run("messages", scope, async (seq) => {
      if (id === null) {
        return { ok: false, failure: guardFailure("ERR_TABLE_NOT_FOUND", SENTENCES.messages.refused) };
      }

      const target = threadFor(id);

      // ⚠ THE PER-DIRECTION SPINNER, AND ONLY FOR A PAGED READ. A first load is the
      // page's own `pending.messages` skeleton; a «load older» is a spinner at the TOP
      // of a transcript that must stay on screen while it fills.
      const flag = direction === "new" ? "loadingNewer" : "loadingOlder";
      if (!cursorless) target[flag] = true;

      try {
        const payload = await readMessagesPage(requestFetch, id, {
          direction,
          ...(cursor !== null && { cursor }),
          ...(query?.loadAll && { loadAll: true }),
        });

        // ⚠ §15: A REAL PAGE HAS **NO `success` FIELD** AT ALL. `isCafeSuccess` answers
        // `false` for it, and `isTableNotFoundFailure` answers `true` for a CLOSED
        // table that arrives as HTTP **201** with `success: true`. Both are read, in
        // that order, because they are the only two signals this endpoint has.
        if (payload === null) return unreachable("messages");
        if (!isCafeMessagesPayload(payload)) return refused("messages", payload);
        if (isTableNotFoundFailure(payload)) return refused("messages", payload);

        if (generation.messages !== seq) return superseded("messages");

        target.messages = mergeRows(
          target.messages,
          payload.messages.map(toThreadMessage),
        );

        applyPageState(target, direction, payload);

        return { ok: true, data: target.messages };
      } finally {
        if (!cursorless) target[flag] = false;
      }
    });
  }

  /**
   * Walk `direction: "new"` to the tail, in as many pages as the server says there
   * are, and merge each one.
   *
   * ## ⚠️ IT DELIBERATELY DOES **NOT** GO THROUGH `run()`
   *
   * This is a read, and every other read in this file goes through `run()` — but
   * `run()` calls `CLEARED[resource]()` on a refusal, and a refusal HERE would empty a
   * transcript that is perfectly good. A dropped connection half a second after the
   * first page loaded is an ordinary event on mobile; blanking the whole conversation
   * because of it is not something any reader would forgive. So this reads the
   * envelope itself, writes the thread's OWN rows, and returns a `CafeResult` for the
   * caller — and it is exactly the read §18.3's reconnect recipe needs, which is why
   * it is a first-class action rather than a loop inside `fetchMessages`.
   *
   * ## ⚠️ A CURSORLESS CATCH-UP IS A REAL CASE, NOT AN ERROR
   *
   * With nothing held there is no `newerCursor`, and §15 says a missing cursor starts
   * from the reader's own `lastReadMessageId` — so one `direction: "new"` call with
   * no cursor is a first window read forwards, and `hasMore: false` on it does NOT
   * mean «there is nothing new». That is why the loop reads until the SERVER stops
   * offering more, and why `CATCH_UP_MAX_ROUNDS` exists rather than a first-answer-
   * is-enough assumption.
   *
   * ⚠️ Overlapping calls SHARE one promise: a burst of live rows would otherwise open
   * a loop per row, and a reader who opened a conversation and then sent a message
   * (which schedules a catch-up of its own) would have two loops racing for one
   * thread.
   */
  function catchUpMessages(tableId: string): Promise<CafeResult<ICafeThreadMessage[]>> {
    // ⚠ NOT a bare `$fetch`, and taken BEFORE anything else. See the file header.
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);

    if (id === null) {
      return Promise.resolve(unreachable("messages"));
    }

    const running = catchUpInFlight[id];
    if (running !== undefined) return running;

    // ⚠ The hold is CLEARED HERE, on purpose: a broadcast that arrives after this
    // point sets it again and arms a second timer, so a row that lands while this
    // loop is still reading is never left with nothing to schedule the next read.
    delete catchUpHold[id];

    const flight = (async (): Promise<CafeResult<ICafeThreadMessage[]>> => {
      const target = threadFor(id);

      target.loadingNewer = true;

      try {
        for (let round = 0; round < CATCH_UP_MAX_ROUNDS; round += 1) {
          const held = newestSequence(target);

          const payload = await readMessagesPage(requestFetch, id, {
            direction: "new",
            ...(held !== null && { cursor: held }),
          });

          // ⚠ AND THE TRANSCRIPT STAYS. See the header: a refusal here is a sentence
          // for the caller, never an empty conversation.
          if (payload === null) return unreachable("messages");
          if (!isCafeMessagesPayload(payload)) return refused("messages", payload);
          if (isTableNotFoundFailure(payload)) return refused("messages", payload);

          target.messages = mergeRows(
            target.messages,
            payload.messages.map(toThreadMessage),
          );

          applyPageState(target, "new", payload);

          if (payload.hasMore !== true) break;
        }

        return { ok: true, data: target.messages };
      } finally {
        target.loadingNewer = false;
        delete catchUpInFlight[id];
      }
    })();

    catchUpInFlight[id] = flight;

    return flight;
  }

  /**
   * The one catch-up a provisional broadcast schedules, coalesced per table.
   *
   * ⚠ DEBOUNCED, NOT IMMEDIATE, AND THE RATE IS THE REASON: a burst of ten messages
   * in a second is ten broadcasts and would be ten `direction:"new"` reads for one
   * merge, and the endpoint answers 429 under enough pressure. One read 600 ms after
   * the first broadcast carries all of them.
   */
  function scheduleCatchUp(tableId: string): void {
    // ⚠ CLIENT-ONLY BY CONSTRUCTION. This is called from socket handlers, which never
    // run on the server, and the guard makes that structural rather than assumed.
    if (!import.meta.client) return;

    const id = usableId(tableId);
    if (id === null) return;

    catchUpHold[id] = true;

    if (catchUpTimers[id] !== undefined) return;

    catchUpTimers[id] = setTimeout(() => {
      delete catchUpTimers[id];

      // ⚠ AND THE HOLD IS CONSULTED HERE, which is the whole reason it exists: a
      // broadcast that landed *during* this walk armed a second timer, and if it fired
      // while `catchUpInFlight[id]` was still set then `catchUpMessages` handed back the
      // walk it found running — nobody walked again, and that row kept no `sequence`,
      // no `senderId` and no `createdAt` until the next reconnect. So the walk that ran
      // re-arms itself ONCE if a hold is still set when it lands. Bounded by
      // construction: every arm needs a broadcast, `catchUpMessages` clears the hold as
      // its first act, and `scheduleCatchUp` coalesces onto an armed timer, so this
      // cannot spin without new traffic arriving.
      void catchUpMessages(id).then(() => {
        if (catchUpHold[id] === true) scheduleCatchUp(id);
      });
    }, CATCH_UP_DEBOUNCE_MS);
  }

  /**
   * Take the server's page bookkeeping for ONE direction, and nothing more.
   *
   * ⚠️ `hasMore` IS COPIED, NEVER RECOMPUTED. The alternative — «more older messages
   * exist if this page came back full» — is wrong twice: the page is 15 by default and
   * **500** under `loadAll`, so «full» means two different things, and a conversation
   * whose last page happens to hold exactly 15 messages would answer «nothing older»
   * forever. `nextCursor` is likewise the SERVER's; the derived fallbacks below only
   * cover a page that carried no cursor of its own.
   */
  function applyPageState(
    target: ICafeThread,
    direction: CafeMessagesDirection,
    payload: ICafeMessagesResponse,
  ): void {
    const nextCursor = typeof payload.nextCursor === "number" ? payload.nextCursor : null;
    const hasMore = payload.hasMore === true;

    if (direction === "new") {
      target.hasNewer = hasMore;
      target.newerCursor = nextCursor ?? newestSequence(target);
    } else {
      target.hasOlder = hasMore;
      target.olderCursor = nextCursor ?? oldestSequence(target);
    }

    // ⚠ THE OTHER DIRECTION'S CURSOR IS ALWAYS THE BOUNDARY OF WHAT IS HELD, because
    // a catch-up needs one and `direction` never set it: a first load is `old`, so
    // without this the very first `direction:"new"` read would send no cursor — and a
    // missing cursor is §15's «start from your own `lastReadMessageId`», which is a
    // read-receipt-relative read and not «everything after my newest row».
    target.olderCursor ??= oldestSequence(target);
    target.newerCursor ??= newestSequence(target);
  }

  /* -------------------------------------------------------- thread: roster -- */

  /**
   * `GET /table/:tableId/users` — the roster this client resolves sender names and
   * avatars from.
   *
   * ⚠️ **AN EMPTY `users` ARRAY IS NOT AN ERROR.** A reader who is not a member gets
   * `{ success: true, users: [] }`, so «no members» and «not allowed to look» are
   * the SAME answer; this route cannot tell them apart and must not invent a failure
   * for one of them. What happens then is a name that is missing from a bubble, which
   * is a far smaller lie than a sentence saying the roster could not be read.
   *
   * ⚠️ `presence` is NOT cleared with it — presence arrives over the socket and is not
   * an answer to this request.
   */
  async function fetchUsers(tableId: string): Promise<CafeResult<ITableUserView[]>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);
    const scope = id ?? "";

    if (id !== null && isFresh("users", scope)) {
      return { ok: true, data: Object.values(users.value) };
    }

    return run("users", scope, async (seq) => {
      if (id === null) {
        return { ok: false, failure: guardFailure("ERR_TABLE_NOT_FOUND", SENTENCES.users.refused) };
      }

      const payload = await readCafe<ICafeUsersResponse>(
        requestFetch,
        `/api/cafe/table/${encodeURIComponent(id)}/users`,
      );

      if (payload === null) return unreachable("users");
      if (!isCafeSuccess(payload)) return refused("users", payload);

      if (generation.users !== seq) return superseded("users");

      const rows = Array.isArray(payload.users) ? payload.users : [];

      const map: Record<string, ITableUserView> = {};

      for (const row of rows) {
        // ⚠ A ROW WITH NO `userId` IS DROPPED, NOT GUESSED AT: a member this client
        // cannot key is a member whose name no bubble can ever resolve, and inventing
        // a key would collide with the next one.
        if (typeof row.userId !== "string" || row.userId === "") continue;

        map[row.userId] = row;
      }

      users.value = map;

      return { ok: true, data: rows };
    });
  }

  /* ------------------------------------------------------ thread: mutations -- */

  /**
   * `POST /table/:tableId/messages` — send one message, **optimistically**.
   *
   * ## ⚠️ THE 201 IS WHAT COMPLETES THE ROW, NOT THE BROADCAST
   *
* §11's `data` carries `id`, `sequence`, `senderId`, `createdAt` and `status`, and
 * the broadcast is documented as that same object (§14.1) — so what the 201 alone
 * supplies is the `sequence` and the wire `id` the reconciliation below matches on. One
 * rule does both cases: **the persisted form always wins, and the provisional row
 * always goes away** — whether the row the 201 filled was our `local:` placeholder or
 * the one our own broadcast had already put in a moment earlier.
   *
   * ⚠️ THE PROVISIONAL ID IS `local:<n>` AND THE COLON IS THE POINT: `:` is outside the
   * backend's `/^[A-Za-z0-9_-]{4,64}$/`, so a client id can never collide with a wire
   * id — which is the only key every shape carries.
   *
   * ## ⚠️ A REFUSED SEND KEEPS ITS TEXT
   *
   * The row is marked `failed` and stays, because a message the reader believes they
   * sent must never vanish without saying so (§3.3). It is the ONLY failure case that
   * leaves a row behind, and the bubble's retry is what removes it later.
   *
* ⚠ AND THE READER MAY BRIEFLY SEE THEIR OWN MESSAGE **TWICE**: their own
 * `cafe:table:send-message:recieve` broadcast lands in the same window as the 201, and
 * nothing links the two — `applyLiveMessage` writes down why matching them on `text` is
 * worse — so the filter in the reconciliation below removes **both** rows and it heals
 * itself without spending another request.
   *
   * ## ⚠️ `status: "submitted-for-review"` IS A **SUCCESS**
   *
   * §11 stores a soft-moderated message and holds it for a moderator; that is an
   * accepted send with a censored body, not a refusal. The row is kept, `report` rides
   * along, and the bubble renders the SERVER's `censoredText` — this client keeps no
   * word list of its own and has no business censoring somebody's words a second time.
   *
   * ⚠️ `text` is length-checked HERE as well as in the composer, and over the cap it is
   * a REFUSAL rather than a truncation: truncating posts words the reader did not
   * write.
   */
  async function sendMessage(
    tableId: string,
    payload: ICafeSendMessageBody,
  ): Promise<CafeResult<ICafeThreadMessage>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);

    if (id === null) {
      return mutationRefused("send", { success: true, reason: "ERR_TABLE_NOT_FOUND" });
    }

    const text = typeof payload?.text === "string" ? payload.text : undefined;
    const hasText = text !== undefined && text.trim() !== "";
    const hasFile = typeof payload?.file?.mainFile === "string" && payload.file.mainFile !== "";
    const hasPoll =
      typeof payload?.poll === "object" && payload.poll !== null && !Array.isArray(payload.poll);

    // ⚠ THE CAP, TWICE, AND A REFUSAL. See `MESSAGE_TEXT_MAX`.
    if (text !== undefined && text.length > MESSAGE_TEXT_MAX) {
      return mutationRefused("send", {
        success: true,
        reason: "ERR_VALIDATION",
        message: "پیام شما بیش از حد مجاز طولانی است. کوتاه‌تر بنویسید.",
      });
    }

    // ⚠ §11's «at least one of text / file / poll», refused before the request so an
    // empty composer cannot spend one of 30 sends per minute on nothing.
    if (!hasText && !hasFile && !hasPoll) {
      return mutationRefused("send", {
        success: true,
        reason: "ERR_VALIDATION",
        message: "پیام خالی را نمی‌توان ارسال کرد.",
      });
    }

    // ⚠ THE LATCH. A deliberate second message is not delayed (this is not a debounce);
    // a DOUBLE-TAP is refused, because it would spend two of §11's 30 sends per minute
    // on one intent. `reason` is `null` on purpose: this refusal is client-side and
    // none of §17's server reasons means «a send is already in flight» — the sentence
    // is the whole answer, and inventing a reason code for it would put a name in the
    // union that the backend never sends.
    if (sendPending.value) {
      return mutationRefused("send", {
        success: true,
        message: "پیام قبلی شما در حال ارسال است. کمی صبر کنید.",
      });
    }

    const target = threadFor(id);
    const localId = `${LOCAL_ID_PREFIX}${++sendNonce}`;
    const replyTo = usableId(payload?.reaplayToMessageId);

    // ⚑ THE PROVISIONAL ROW. `senderId` is filled because THIS client knows who
    // pressed the button; `sequence` is `null` because no history read has happened
    // yet and it must never be invented — see the file header.
    //
    // ⚠ `status: "active"` IS A **RENDERING PLACEHOLDER**, NOT A CLAIM about the
    // server's moderation state: it is what makes the bubble draw as an ordinary
    // outgoing message while the request is in the air, and the 201 replaces it with
    // whatever the backend actually decided — `submitted-for-review` included. Leaving
    // it absent would fall through every moderation branch *and* the deleted one,
    // which is the same picture reached by a worse route.
    const optimistic: ICafeThreadMessage = {
      id: localId,
      localId,
      roomId: id,
      senderId: myId.value,
      type: hasPoll ? "poll" : hasFile ? inferFileMessageType(payload.file?.mainFile) : "text",
      text,
      status: "active",
      sequence: null,
      createdAt: new Date().toISOString(),
      ...(replyTo !== null && { reaplayTo: { messageId: replyTo } }),
      sending: true,
    };

    sendPending.value = true;
    target.messages = mergeRows(target.messages, [optimistic]);

    // ⚠ THE BODY IS REBUILT HERE, FIELD BY FIELD, AND NEVER RELAYED: `tableId` is the
    // path segment, §11's zod is `.strict()`, and the proxy rebuilds the same four keys
    // again (`server/api/cafe/table/[resourceId]/messages.post.ts`).
    const body = {
      ...(text !== undefined && { text }),
      ...(hasFile && payload.file && { file: payload.file }),
      ...(hasPoll && { poll: payload.poll }),
      ...(replyTo !== null && { reaplayToMessageId: replyTo }),
    };

    try {
      const { payload: answer, failure } = await writeCafe<ICafeSendMessageResponse>(
        requestFetch,
        `/api/cafe/table/${encodeURIComponent(id)}/messages`,
        { method: "post", body },
        "send",
      );

      if (failure !== null) {
        markSendFailed(target, localId);

        return { ok: false, failure };
      }

      // ⚠ A THROTTLE IS **NOT** AN ERROR PATH ANY MORE, and reading it as one would be
      // the single most confusing sentence a composer could show. Since the proxies
      // were changed, an upstream 429 answers as an ordinary resolved envelope
      // (`success: false`, `statusCode: 429`, a Persian `message`) and is read by
      // `mutationRefused` below — «تعداد درخواست‌ها بیش از حد مجاز است», not
      // «اتصال اینترنت را بررسی کنید». This `catch` arm is the backstop for a 429 raised
      // by the Nitro layer itself, where there is no café envelope at all.
      if (!isCafeSuccess(answer)) {
        markSendFailed(target, localId);

        return mutationRefused("send", answer);
      }

      const data = answer.data;

      // ⚠ A 201 WITH NO USABLE `data` IS NOT A ROW. §11 always sends the full stored
      // message, so this is not a shape the contract documents — and leaving the
      // provisional row `sending` forever would be a message stuck in the air with
      // nothing on screen to explain it, so it is failed rather than pending.
      const sent =
        data !== null && data !== undefined && typeof data.id === "string" && data.id !== ""
          ? data
          : null;

      if (sent === null) {
        markSendFailed(target, localId);

        return mutationRefused<ICafeThreadMessage>("send", {
          success: true,
          message: "پیام شما ثبت نشد. لطفاً دوباره تلاش کنید.",
        });
      }

      // ⚠ THE PERSISTED ROW. Its `sequence` is the server's — the ONLY place this
      // client ever gets one for its own message — and it is what the next `cursor`
      // and the next `seen` are computed from.
      const resolved: ICafeThreadMessage = {
        ...sent,
        id: sent.id,
        roomId: sent.roomId ?? id,
        senderId: sent.senderId ?? myId.value,
        sending: false,
        provisional: false,
        // ⚠ KEPT so a failed send's retry knows what it was, and so the row can be
        // traced back to the tap that made it.
        localId,
      };

      // ⚠ BRANCH: OUR OWN BROADCAST BEAT THE ANSWER, so there is a row holding this
      // real `id` already — possibly carrying a `report` the 201's `data` does not.
      const broadcast = target.messages.find((row) => row.id === sent.id);

      if (broadcast?.report != null && resolved.report == null) {
        resolved.report = broadcast.report;
      }

      // ⚠ ONE RULE, BOTH BRANCHES: the persisted form is inserted, and BOTH the
      // `local:` placeholder and any row already holding that `id` are removed first.
      target.messages = mergeRows(
        target.messages.filter((row) => row.id !== localId && row.id !== sent.id),
        [resolved],
      );

      return { ok: true, data: resolved };
    } finally {
      // ⚠ A LATCH, CLEARED IN A `finally` — so a send that throws inside this store
      // cannot leave the composer disabled until the next full page load.
      sendPending.value = false;
    }
  }

  /**
   * A send that could not be persisted: the row stays, keeps its text, and is marked
   * so the bubble can offer a retry. See `sendMessage`'s header for why it is not
   * removed.
   */
  function markSendFailed(target: ICafeThread, localId: string): void {
    const row = target.messages.find((entry) => entry.id === localId);

    if (row === undefined) return;

    row.sending = false;
    row.failed = true;
  }

  /**
   * ⚠ `PUT /table/messages/:tableId/:messageId` — REST ONLY.
   *
   * There is no `cafe:table:edit-message` emit: §10.3 and §18.12 both say so, and
   * `ICafeClientToServerEvents` no longer declares one, so an emit would not compile
   * rather than being silently swallowed by a server that ignores it.
   *
   * The 200's `{tableId, messageId, text}` and the `…edit-message:response` broadcast
   * converge on ONE applier, so the editor's own bubble and every other member's
   * agree without a refetch.
   *
   * ⚠ THE READER'S WORDS ARE SENT VERBATIM. The emptiness test trims; the text on the
   * wire does not — an edit that silently dropped a reader's trailing space is an edit
   * they did not make.
   */
  async function editMessage(
    tableId: string,
    messageId: string,
    text: string,
  ): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);
    const target = usableId(messageId);

    if (id === null || target === null) {
      return mutationRefused("edit", { success: true, reason: "ERR_MESSAGE_NOT_FOUND" });
    }

    const next = typeof text === "string" ? text : "";

    if (next.trim() === "" || next.length > MESSAGE_TEXT_MAX) {
      return mutationRefused("edit", {
        success: true,
        reason: "ERR_VALIDATION",
        message: "متن پیام نمی‌تواند خالی یا بیش از حد طولانی باشد.",
      });
    }

    const { payload, failure } = await writeCafe<ICafeActionResponse>(
      requestFetch,
      `/api/cafe/table/${encodeURIComponent(id)}/messages/${encodeURIComponent(target)}`,
      { method: "put", body: { text: next } },
      "edit",
    );

    if (failure !== null) return { ok: false, failure };
    if (!isCafeSuccess(payload)) return mutationRefused("edit", payload);

    // ⚠ THE ACTOR'S OWN BUBBLE IS CONVERGED HERE, NOT BY THE BROADCAST — which may be
    // delayed, may be the only thing another member gets, and is not guaranteed to
    // arrive at all while this socket is down.
    applyEditTo(threadFor(id), target, next);

    return { ok: true, data: null };
  }

  /**
   * ⚠ `DELETE /table/messages/:tableId/:messageId` — REST ONLY, and a **SOFT** delete.
   *
   * §13: the backend flips `status` to `"deleted"` and the document STAYS, so the
   * local action is a tombstone and not a removal — `status` is a state a message is
   * IN (`ICafeTableMessage`), and `MessageBubble` already draws that state. Removing
   * the row would also re-flow the whole transcript for every row below it, for a
   * deletion the reader experiences as «this message is gone».
   */
  async function deleteMessage(
    tableId: string,
    messageId: string,
  ): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);
    const target = usableId(messageId);

    if (id === null || target === null) {
      return mutationRefused("remove", { success: true, reason: "ERR_MESSAGE_NOT_FOUND" });
    }

    const { payload, failure } = await writeCafe<ICafeActionResponse>(
      requestFetch,
      `/api/cafe/table/${encodeURIComponent(id)}/messages/${encodeURIComponent(target)}`,
      // ⚠ NO `body` KEY AT ALL, not an empty one — §13 says «No body», and a body this
      // route does not read is a caller's document on the wire for nothing.
      { method: "delete" },
      "remove",
    );

    if (failure !== null) return { ok: false, failure };
    if (!isCafeSuccess(payload)) return mutationRefused("remove", payload);

    applyDeleteTo(threadFor(id), target);

    return { ok: true, data: null };
  }

  /**
   * ⚠ §9's SINGLE TOGGLE. **There is no dislike endpoint** — «disliking» IS un-liking
   * — so this takes NO intent parameter: a caller cannot choose to like or to unlike,
   * only to ask, and the answer says which happened. A menu row that said «نپسندیدن»
   * would be wrong twice: wrong about the API and wrong about the state.
   *
   * ## BOTH ANSWERS ARE AUTHORITATIVE, AND NEITHER IS GUESSED FROM THE OTHER
   *
   * `likes` is the FULL flat list of user ids (§9) and there is no count to recompute,
   * so the REST answer writes it and the broadcast writes it, and whichever arrives
   * first is corrected — never inverted — by the other. `pendingLikes` exists only to
   * (a) ignore a second press while one is in the air, which would invert twice and
   * land back on the original state while spending two of a global 500/60s budget to
   * change nothing, and (b) render the gap between the tap and the first answer.
   *
   * ⚠ A REFUSED TOGGLE **RESTORES** THE PRIOR LIST. Leaving the optimistic heart on
   * screen would be drawing a like nobody stored.
   */
  async function toggleLike(
    tableId: string,
    messageId: string,
  ): Promise<CafeResult<ICafeLikeOutcome>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);
    const target = usableId(messageId);

    if (id === null || target === null) {
      return mutationRefused("like", { success: true, reason: "ERR_MESSAGE_NOT_FOUND" });
    }

    const thread = threadFor(id);
    const row = thread.messages.find((entry) => entry.id === target);

    // ⚠ THE PRE-STATE, COPIED. `applyLikeTo` REPLACES the array on the row, so reading
    // `row.like` after the optimistic flip would give the flip back rather than what
    // the reader saw — and the restore-on-refusal path needs exactly the former.
    const before = row?.like === undefined ? [] : [...row.like];
    const current = myId.value !== null && before.includes(myId.value);

    if (messageInFlight(target)) {
      // ⚠ A SECOND PRESS WHILE ONE IS IN THE AIR IS **IGNORED**, not queued: two
      // presses would invert twice and land on the original state, and §9's limiter is
      // global (500/60s). The answer is the state as it stands, with no request — so
      // the caller has nothing to apologise to the reader for.
      return {
        ok: true,
        data: {
          messageId: target,
          liked: current,
          likeCount: before.length,
          likes: before,
        },
      };
    }

    const next = current
      ? before.filter((userId) => userId !== myId.value)
      : myId.value === null
        ? null
        : [...before, myId.value];

    if (next !== null) {
      pendingLikes.value = { ...pendingLikes.value, [target]: current };
      applyLikeTo(thread, target, next);
    }

    const { payload, failure } = await writeCafe<ICafeLikeResponse>(
      requestFetch,
      `/api/cafe/table/${encodeURIComponent(id)}/messages/${encodeURIComponent(target)}/like`,
      // ⚠ NO BODY. §9: the toggle takes no intent, and the proxy forwards no body at
      // all — a body carrying `liked: true` would be ignored by the backend and would
      // make a client believe it worked.
      { method: "post" },
      "like",
    );

    // ⚠ THE REST ANSWER ALWAYS CLEARS THE PENDING ENTRY, refusal included: the request
    // is over either way, and an entry left behind would ignore every future press on
    // this message for the rest of the session.
    clearPendingLike(target);

    if (failure !== null) {
      if (next !== null) applyLikeTo(thread, target, before);

      return { ok: false, failure };
    }

    if (!isCafeSuccess(payload)) {
      if (next !== null) applyLikeTo(thread, target, before);

      return mutationRefused("like", payload);
    }

    const likes = Array.isArray(payload.likes) ? payload.likes : before;
    const liked =
      typeof payload.liked === "boolean"
        ? payload.liked
        : myId.value !== null && likes.includes(myId.value);

    applyLikeTo(thread, target, likes);

    return {
      ok: true,
      data: {
        messageId:
          typeof payload.messageId === "string" && payload.messageId !== ""
            ? payload.messageId
            : target,
        liked,
        likeCount:
          typeof payload.likeCount === "number" ? payload.likeCount : likes.length,
        likes,
      },
    };
  }

  /** Is a toggle already in the air for this message? See `pendingLikes`. */
  function messageInFlight(messageId: string): boolean {
    return Object.prototype.hasOwnProperty.call(pendingLikes.value, messageId);
  }

  /** Drop a pending toggle. The REST answer owns this; the broadcast does not. */
  function clearPendingLike(messageId: string): void {
    if (!messageInFlight(messageId)) return;

    const rest = { ...pendingLikes.value };
    delete rest[messageId];
    pendingLikes.value = rest;
  }

  /**
   * ⚠ §8's read receipt — **ONE number per table per user**, posted as a JSON NUMBER.
   *
   * There is no per-message read state anywhere on the wire (§8, and
   * `GET /table/:tableId/users` returns user documents rather than participant
   * records, so it carries no `lastReadSequence` either). So this action posts «I have
   * read up to `sequence`» and nothing more, and anything a screen draws about
   * *other people's* reading would be a fabricated claim. What IS derivable is the
   * local frontier — `isRead` and `newMessagesFrom` — which is a statement about this
   * device and this session.
   *
   * ⚠ **THE BODY IS A NUMBER AND NOT A STRING.** §8 is explicit: strings are not cast
   * and `$max` silently ignores them, so a string would answer 201 with `success: true`
   * and advance nothing — a receipt that reports success and is not one. The proxy
   * refuses a non-numeric `seen` for the same reason.
   *
   * ⚠ **`import.meta.client` GUARD.** This store is instantiated on the server (the
   * thread screen awaits `fetchTable` in its setup body), and a POST fired during SSR is
   * a mutation fired by a page VIEW. So it returns without a request off the client,
   * which is also why `scheduleMarkSeen` — the only caller a screen should have —
   * guards first.
   *
   * ⚠ **A NUMBER ALREADY SENT IS NEVER SENT AGAIN.** `lastSeenSent` is the high-water
   * mark, and it is what keeps a two-hundred-message thread from spending a request per
   * scroll tick: the throttle bounds the rate, the mark stops the requests that carry
   * nothing new.
   *
   * ⚠ **CLAMPED DOWN TO `table.messageSecunce`** — the latest sequence the table has
   * allocated. The server clamps too; clamping here means a stale local maximum is not
   * even attempted, so the local frontier can never run ahead of what exists.
   */
  async function markSeen(tableId: string, sequence: number): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();

    if (!import.meta.client) return { ok: true, data: null };

    const id = usableId(tableId);

    if (id === null) {
      return mutationRefused("seen", { success: true, reason: "ERR_TABLE_NOT_FOUND" });
    }

    // ⚠ §8 wants a number. A non-integer, a negative or a `NaN` cannot be one, and
    // `Number.isSafeInteger` is what refuses `NaN` (its `typeof` is "number").
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      return mutationRefused("seen", { success: true, reason: "ERR_VALIDATION" });
    }

    const thread = threadFor(id);

    if (sequence <= thread.lastSeenSent) return { ok: true, data: null };

    const allocated = table.value?.id === id ? table.value?.messageSecunce : undefined;
    const value =
      typeof allocated === "number" &&
      Number.isFinite(allocated) &&
      allocated >= 0 &&
      sequence > allocated
        ? allocated
        : sequence;

    if (value <= thread.lastSeenSent) return { ok: true, data: null };

    // ⚠ THE FRONTIER MOVES ON THE WAY OUT, not on the answer: what the reader has
    // read is a fact about their reading, and a receipt whose own failure held it back
    // would make `isRead` wrong for the rest of the visit.
    if (value > thread.lastReadSequence) thread.lastReadSequence = value;

    const { payload, failure } = await writeCafe<ICafeActionResponse>(
      requestFetch,
      `/api/cafe/table/messages/${encodeURIComponent(id)}/seen`,
      { method: "post", body: { seen: value } },
      "seen",
    );

    if (failure !== null) return { ok: false, failure };
    if (!isCafeSuccess(payload)) return mutationRefused("seen", payload);

    if (value > thread.lastSeenSent) thread.lastSeenSent = value;

    // ⚠ AND THE CHANNELS ANSWER GOES WITH IT. `unreadMessages` on
    // `GET /table/subscribed` is the server's `messageSecunce - lastReadSequence`,
    // so this POST is the only thing that makes the badge the reader can see
    // correct — and the held answer is cached behind `isFresh`, which has no TTL,
    // so without this line the list would keep drawing the badge this very request
    // has just cleared. Same one-line invalidation a join and a leave use.
    invalidateJoined();

    return { ok: true, data: null };
  }

  /**
   * The throttled entry point to `markSeen`, and the ONLY one a screen should call.
   *
   * ⚠ IT MOVES THE FRONTIER IMMEDIATELY AND THROTTLES THE POST, because those are two
   * different facts: what the reader has read is true the moment they look at it, while
   * what the SERVER has been told is throttled to one request per `SEEN_THROTTLE_MS`.
   *
   * ⚠ **A THROTTLE WITH BOTH EDGES, NOT A DEBOUNCE.** A debounce starves under
   * continuous scrolling — the reader keeps moving, the timer keeps resetting, and the
   * receipt is never sent at all, so the unread badge a reader can SEE growing is one
   * this client never corrects. The leading edge covers the common case (already at the
   * bottom, wants it recorded now) and the trailing edge covers the rest.
   *
   * ⚠ The HELD figure is the **highest** asked for since the last pass, so a reader who
   * scrolls up and back down does not post the lower number they passed on the way.
   */
  function scheduleMarkSeen(tableId: string, sequence: number): void {
    // ⚠ CLIENT-ONLY BY CONSTRUCTION — see `markSeen`.
    if (!import.meta.client) return;

    const id = usableId(tableId);
    if (id === null) return;
    if (!Number.isSafeInteger(sequence) || sequence < 0) return;

    const thread = threadFor(id);

    if (sequence > thread.lastReadSequence) thread.lastReadSequence = sequence;

    // ⚠ ALREADY SENT, OR ALREADY BELOW THE MARK. Nothing new to say, and a receipt
    // for a number the server already has is a request spent for nothing.
    if (sequence <= thread.lastSeenSent) return;

    seenHeld[id] = Math.max(seenHeld[id] ?? 0, sequence);

    if (seenTimer[id] !== undefined) return;

    // ⚠ THE LEADING EDGE.
    flushSeen(id);

    seenTimer[id] = setTimeout(() => {
      delete seenTimer[id];

      flushSeen(id);
    }, SEEN_THROTTLE_MS);
  }

  /** Post whatever `seenHeld` is holding for this table, if anything. */
  function flushSeen(id: string): void {
    const held = seenHeld[id];

    if (held === undefined) return;

    delete seenHeld[id];

    void markSeen(id, held);
  }

  /**
   * ⚠ §7's report, at BOTH levels through one endpoint.
   *
   * `report-for` has **no default** — it is `required`, and omitting it answers
   * `ERR_VALIDATION` — so an unusable value is REFUSED here rather than dropped: a
   * dropped discriminator would spend an upstream request on a document whose level
   * this client could not prove, and `report-for` also chooses WHICH document is
   * written (a message report stores the text and the sender, a table report stores
   * neither).
   *
   * ⚠ `id` IS **THE TABLE'S INTERNAL `id`** for a table report, never the `ch_`/`cv_`/
   * `tb_` handle a URL carries: the handle is not a document the moderation queue can
   * look up, so a report filed under it would name nothing and still answer «ثبت شد».
   * `internalTableId` is the same resolution `fetchTable` and the socket room use.
   *
   * ⚠ **AND THE MISLABELLED REFUSAL IS MAPPED BY REQUEST CONTEXT** (§18.10): a
   * `report-for=table` refusal arrives as `ERR_MESSAGE_NOT_FOUND` because the backend
   * reuses one string for both levels. The reason is the SERVER's and it is wrong;
   * what is known here is which level was asked for, so the sentence is built from
   * THAT rather than from the reason.
   */
  async function reportTarget(input: {
    target: CafeReportTarget;
    id: string;
    reason: string;
    note?: string;
    source?: string;
  }): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();

    if (!isCafeReportTarget(input?.target)) {
      return mutationRefused("report", { success: true, reason: "ERR_VALIDATION" });
    }

    const subject = usableId(input?.id);
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";

    // ⚠ `id` IS REQUIRED IN PRACTICE even though §7's zod marks it optional, and a
    // report with no subject is not a report.
    if (subject === null || reason === "") {
      return mutationRefused("report", { success: true, reason: "ERR_VALIDATION" });
    }

    const note = typeof input?.note === "string" ? input.note.trim() : "";

    const { payload, failure } = await writeCafe<ICafeReportResponse>(
      requestFetch,
      "/api/cafe/table/report",
      {
        method: "post",
        query: { "report-for": input.target },
        // ⚠ THE METADATA IS REBUILT HERE AND IN THE PROXY, from an allowlist — a
        // moderation queue is an operator-facing surface and free-form input from an
        // untrusted client belongs there at a bounded size and a fixed shape, or
        // nowhere. Over the cap the key is DROPPED (never shortened): truncating would
        // store words the reader did not write.
        body: {
          id: subject,
          metadata: {
            reason,
            ...(note !== "" && note.length <= REPORT_NOTE_MAX && { note }),
            ...(typeof input.source === "string" && input.source !== "" && {
              source: input.source,
            }),
          },
        },
      },
      "report",
    );

    if (failure !== null) return { ok: false, failure };

    if (!isCafeSuccess(payload)) {
      const refused = parseCafeFailure(payload, MUTATION_SENTENCES.report.refused);

      if (input.target === "table" && refused.reason === "ERR_MESSAGE_NOT_FOUND") {
        return {
          ok: false,
          failure: { ...refused, message: "این میز در دسترس نیست و گزارش ثبت نشد." },
        };
      }

      return { ok: false, failure: refused };
    }

    return { ok: true, data: null };
  }

  /* ----------------------------------------------------- thread: membership -- */

  /**
   * `POST /table/subscribe` — join one conversation, **or re-join a `left` one**.
   *
   * §5: re-subscribing after `left` REACTIVATES the participant row, so the same
   * endpoint is the rejoin and there is no second call.
   *
   * ⚠ **`ERR_USER_SUBSCRIBED` IS A CONFIRMATION, NOT A FAILURE**, and it is mapped to
   * `ok: true`: it is what the endpoint answers when the reader is ALREADY active, and
   * this client cannot reliably know that in advance (§18.4 — `subscribe` on `/single`
   * is not the reader's row). Reporting it as an error would put «خطا» under a button
   * that did exactly what the reader asked.
   *
   * ⚠ The body is rebuilt as ONE field. §5's body documents `tableId` and nothing
   * else, and the proxy rebuilds it the same way — a relayed body would let a caller
   * join somebody else's table.
   */
  async function joinTable(tableId: string): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);

    if (id === null) {
      return mutationRefused("membership", { success: true, reason: "ERR_TABLE_NOT_FOUND" });
    }

    const { payload, failure } = await writeCafe<ICafeActionResponse>(
      requestFetch,
      "/api/cafe/table/subscribe",
      { method: "post", body: { tableId: id } },
      "membership",
    );

    if (failure !== null) return { ok: false, failure };

    if (!isCafeSuccess(payload)) {
      const refused = parseCafeFailure(payload, MUTATION_SENTENCES.membership.refused);

      if (refused.reason === "ERR_USER_SUBSCRIBED") {
        threadFor(id).joined = true;

        return { ok: true, data: null };
      }

      return {
        ok: false,
        failure:
          refused.reason === "ERR_NET_CONNECTION"
            ? { ...refused, message: MUTATION_SENTENCES.membership.net }
            : refused,
      };
    }

    threadFor(id).joined = true;

    // ⚠ AND THE READS THAT DEPEND ON IT. `/single` is where membership and
    // `isManager` live, and `/table/subscribed` is where the new badge lives — both
    // held answers are now stale by definition, so both are invalidated rather than
    // served.
    invalidateTable();
    invalidateJoined();

    return { ok: true, data: null };
  }

  /**
   * `POST /table/:tableId/left` — leave one conversation. **SOFT** (§6): the backend
   * sets `status: "left"` and `leftAt`, and requires an ACTIVE row (else 404).
   *
   * ⚠ THE ID IS IN THE **QUERY** on this route, and that is the proxy's published URL
   * rather than something to work around here.
   *
   * ⚠ **AND THE THREAD IS DROPPED.** This is the ONE case where `leaveThread`'s cache is
   * thrown away: the reader gave this conversation up, and a full transcript sitting
   * under a fresh «شما از این میز خارج شده‌اید» band is precisely the stale-under-fresh
   * state this store's header warns about.
   */
  async function leaveTable(tableId: string): Promise<CafeResult<null>> {
    const requestFetch = cafeFetcher();
    const id = usableId(tableId);

    if (id === null) {
      return mutationRefused("membership", { success: true, reason: "ERR_TABLE_NOT_FOUND" });
    }

    const { payload, failure } = await writeCafe<ICafeActionResponse>(
      requestFetch,
      "/api/cafe/table/left",
      { method: "post", query: { tableId: id } },
      "membership",
    );

    if (failure !== null) return { ok: false, failure };
    if (!isCafeSuccess(payload)) return mutationRefused("membership", payload);

    discardThread(id);
    invalidateTable();
    invalidateJoined();

    return { ok: true, data: null };
  }

  /**
   * Make the held `/single` answer un-servable **without** clearing it.
   *
   * ⚠ NOT `reset("table")`. That clears `table.value`, and this screen's header, its
   * membership band and its composer are all drawn from it — a membership change would
   * blank the whole screen for one frame. Marking the answer stale is the same
   * statement («the held answer no longer describes the world») without the flicker,
   * and the next `fetchTable` re-asks.
   */
  function invalidateTable(): void {
    loaded.value.table = false;
  }

  /**
   * Re-read `/single` for one pair **even when the held answer is fresh** — the reconnect
   * refresh, and the only caller that needs it.
   *
   * ⚠ WHY IT IS NOT JUST `fetchTable`. `isFresh` answers «may this HELD answer be served
   * again?», and for a socket that reconnected the honest answer is **no**: the whole
   * point of the resync is that anything may have changed while this client was away —
   * `messageSecunce` (the read receipt's clamp and the catch-up's ceiling),
   * `messageSendingEnabled`, `secureChat`, `isManager`. A re-read that silently returned
   * the pre-drop payload would leave the screen showing a world that stopped existing
   * when the socket did.
   *
   * ⚠ AND IT INVALIDATES WITHOUT CLEARING, so the header keeps rendering while the
   * re-read is in the air rather than blanking for a frame. `fetchTable` is untouched
   * and every other caller keeps its idempotence.
   */
  function refreshTable(
    cafeId: string,
    tableHandle: string,
  ): Promise<CafeResult<ICafeTableView>> {
    invalidateTable();

    return fetchTable(cafeId, tableHandle);
  }

  /** The same, for the channels list a join or a leave changes. */
  function invalidateJoined(): void {
    loaded.value.joined = false;
  }

  /* ------------------------------------------------------- socket appliers -- */

  /**
   * ⚠ THE ONE LINE EVERY APPLIER OPENS WITH, and the invariant it exists to protect.
   *
   * Three of §14's payloads carry **no table id at all** — `delete-message:bulk:response`
   * (a bare `string[]`), `message-sending-status` and `secure-chat-status` (plain
   * strings) — so room membership is the only thing that makes them unambiguous, and
   * that is why `useCafeThreadSocket` holds «at most one `table_<id>_room` per
   * client» as a load-bearing rule rather than a nicety.
   *
   * ⚠ So an applier resolves the target as «the ACTIVE thread, and only if this
   * payload names it». An applier that fell back to «the first thread I hold» would
   * apply one conversation's traffic to another, and an applier that resolved the
   * payload's own id without that check would write into a thread the socket is not in
   * at all.
   *
   * @param tableId the payload's own `tableId`, when it has one.
   */
  function activeThreadFor(tableId?: unknown): ICafeThread | null {
    const active = activeThreadId.value;

    if (active === null) return null;

    if (typeof tableId === "string" && tableId !== "" && tableId !== active) return null;

    return threads.value[active] ?? null;
  }

  /**
   * `cafe:table:send-message:recieve` — one message, live.
   *
   * ⚠ **THIS PAYLOAD CANNOT SUPPLY A `sequence`, AND NONE IS INVENTED.** So a row is
   * appended as **provisional** and a debounced `direction:"new"` catch-up is
   * scheduled; the catch-up is what fills the `sequence` in, by `id`. A path that made
   * up a sequence would corrupt paging AND the read receipt, and it would be the kind of
   * lie this whole feature is built to avoid.
   *
   * ⚠ `senderId` AND `createdAt` **ARE** read off it, when §14.1's payload carries
   * them — a broadcast IS the send-response `data`. That is a name and a timestamp on
   * the bubble straight away, and it is what makes the reader's OWN broadcast row its
   * own (`senderId === myId`); without them that row is drawn as an incoming white
   * bubble until the 201 removes it. `sequence` is the one field of that payload this
   * applier refuses, and `ICafeLiveMessage` deliberately declares no such key.
   *
   * ⚠ A ROW THAT ALREADY HOLDS THIS `id` IS **UPGRADED, NOT RE-APPENDED** — which is
   * the reader's OWN message arriving before its 201, and appending it a second time
   * would draw the bubble twice.
   *
   * ⚠ AND THE ONE THING THAT IS **DELIBERATELY** NOT DONE: matching this broadcast
   * against an unresolved send by `text` to hide the duplicate. `id` is the only key the
   * two answers share, and it is exactly what the `local:` placeholder does not have
   * yet — so `text` (and now `senderId`, which §14.1 does carry) would be the only
   * candidate, and suppressing a real member's identical message to save a reader one
   * bubble that the 201 is about to resolve is the wrong trade. So the reader sees both
   * rows for the few hundred milliseconds the two answers race, and `sendMessage`
   * removes **both** the `local:` placeholder and this one the moment the 201 lands.
   * Self-healing, no request spent, nothing lost — which is why it is written down
   * here: to stop the next reader from "fixing" it with a heuristic.
   *
   * ⚠ `roomId` IS OPTIONAL ON THIS PAYLOAD, so an absent one is ACCEPTED (it is a room
   * broadcast and this client is in exactly one table room) while a present one that
   * names another table is dropped.
   */
  function applyLiveMessage(live: ICafeLiveMessage): void {
    if (typeof live !== "object" || live === null) return;

    if (typeof live.roomId === "string" && live.roomId !== activeThreadId.value) return;

    const thread = activeThreadFor();
    if (thread === null) return;

    // ⚠ NO `id`, NO DEDUPE, NO PAGER: a broadcast this client cannot key could not be
    // reconciled by anything, and inventing an id for it would collide with the next
    // invented one. It is dropped — and the catch-up below still brings it in.
    const id = usableId(live.id);
    if (id === null) return;

    const existing = thread.messages.find((row) => row.id === id);

    const row: ICafeThreadMessage =
      existing === undefined
        ? {
            id,
            roomId: live.roomId,
            text: live.text,
            type: live.type,
            status: live.status,
            poll: live.poll,
            reaplayTo: live.reaplayTo,
            file: mergeLiveFile({ id }, live),
            report: live.report ?? null,
            // ⚠ §14.1 calls this payload the send-response `data`, so `senderId` and
            // `createdAt` ARE read when it carries them — a bubble with no name and no
            // time for 600 ms, and the reader's OWN row drawn as an incoming white
            // bubble until the 201. `sequence` is still never read, and never invented:
            // the catch-up owns it. See `ICafeLiveMessage`.
            senderId: live.senderId ?? null,
            createdAt: live.createdAt,
            provisional: true,
          }
        : overlayLive(existing, live);

    thread.messages = mergeRows(
      thread.messages.filter((entry) => entry.id !== id),
      [row],
    );

    // ⚠ AND ONLY FOR A ROW THAT IS STILL PROVISIONAL. A broadcast that reconciled a row
    // we already had a sequence for needs no read, and one that filled our own send
    // is completed by the REST answer that is already in the air.
    if (row.provisional === true) scheduleCatchUp(activeThreadId.value ?? "");
  }

  /**
   * `cafe:table:edit-message:response` — somebody edited a message.
   *
   * ⚠ AN UNKNOWN `messageId` IS IGNORED, NOT INVENTED: a row older than the loaded
   * window is not something this client has, and appending a one-field row for it
   * would put an edit nobody can read into the transcript.
   */
  function applyEditBroadcast(payload: ICafeMessageRefPayload & { text?: string }): void {
    const thread = activeThreadFor(payload?.tableId);
    if (thread === null) return;

    const id = usableId(payload?.messageId);
    if (id === null) return;

    applyEditTo(thread, id, payload.text);
  }

  /**
   * The one place an edit lands, whether it came from the REST answer or the broadcast.
   *
   * ⚠ `messageEdited` IS APPENDED TO, NOT REPLACED. §12: the server appends
   * `{text, editedAt}` — so it is the SERVER's array that is authoritative, and a
   * local append is only a guess at the entry the answer already has. It exists so
   * `messageEdited.length > 0` is true immediately (the «ویرایش شد» marker) rather
   * than only after the broadcast that may never come.
   */
  function applyEditTo(
    thread: ICafeThread,
    messageId: string,
    text: string | undefined,
  ): boolean {
    if (typeof text !== "string") return false;

    const row = thread.messages.find((entry) => entry.id === messageId);
    if (row === undefined) return false;

    row.text = text;
    row.messageEdited = [...(row.messageEdited ?? []), { text, editedAt: Date.now() }];

    return true;
  }

  /**
   * `cafe:table:delete-message:response` — a message is gone.
   *
   * ⚠ A **TOMBSTONE**, NOT A REMOVAL. §13's delete is soft — the backend flips
   * `status` to `"deleted"` and the document STAYS in the history — so the local
   * action has to be the same fact, or the next catch-up would bring the row back and
   * the transcript would flicker a deleted message into existence. The row's body is
   * left in place for the same reason: `status` is what `MessageBubble` draws, and the
   * server's own copy keeps the text.
   */
  function applyDeleteBroadcast(payload: ICafeMessageRefPayload): void {
    const thread = activeThreadFor(payload?.tableId);
    if (thread === null) return;

    const id = usableId(payload?.messageId);
    if (id === null) return;

    applyDeleteTo(thread, id);
  }

  /** The one place a tombstone lands. See `applyDeleteBroadcast`. */
  function applyDeleteTo(thread: ICafeThread, messageId: string): boolean {
    const row = thread.messages.find((entry) => entry.id === messageId);
    if (row === undefined) return false;

    row.status = "deleted";

    return true;
  }

  /**
   * `cafe:table:delete-message:bulk:response` — a batch, from a secure-chat window
   * closing or the sending window being auto-disabled.
   *
   * ⚠⚠️ **A BARE `string[]` WITH NO `tableId`** — the single strongest argument for the
   * one-table-room invariant. There is nothing in this payload to match against, so it
   * is applied to the ACTIVE thread, which is correct precisely because this client is
   * never in two table rooms at once. It is therefore the ONE applier that must NOT
   * accept a table id from its caller, and it does not.
   */
  function applyDeleteBulkBroadcast(messageIds: string[]): void {
    const thread = activeThreadFor();
    if (thread === null || !Array.isArray(messageIds)) return;

    for (const messageId of messageIds) {
      const id = usableId(messageId);
      if (id === null) continue;

      applyDeleteTo(thread, id);
    }
  }

  /**
   * `cafe:table:like-message` — somebody (possibly this reader) toggled a like.
   *
   * ⚠ **`userId === myId` IS NOT SKIPPED**, and §18.14's «dedupe the echo» is honoured
   * the only way it can be honoured without dropping data: the payload carries the
   * **authoritative `likes` array**, so applying it can only correct this client's
   * optimistic guess, never invent a state. What IS skipped is the write when the echo
   * says exactly what is already on screen — which is the dedupe, and it saves a
   * pointless array replacement on every one of the reader's own taps.
   *
   * ⚠ **AND THE BROADCAST NEVER CLEARS `pendingLikes`.** Only the REST answer does:
   * the entry marks a request still in the air, and that request's answer will
   * confirm or correct this very write.
   */
  function applyLikeBroadcast(payload: ICafeLikeBroadcast): void {
    const thread = activeThreadFor(payload?.tableId);
    if (thread === null) return;

    const id = usableId(payload?.messageId);
    if (id === null) return;

    // ⚠ WITHOUT A `likes` ARRAY THERE IS NOTHING AUTHORITATIVE TO WRITE. `liked` alone
    // is one boolean for one user, and taking it as the whole state would empty a row's
    // list on somebody else's like.
    const likes = Array.isArray(payload.likes) ? payload.likes : undefined;
    if (likes === undefined) return;

    if (payload.userId !== undefined && payload.userId === myId.value) {
      const row = thread.messages.find((entry) => entry.id === id);

      if (row !== undefined && sameLikes(row.like, likes)) return;
    }

    applyLikeTo(thread, id, likes);
  }

  /** The one place the authoritative list lands. */
  function applyLikeTo(thread: ICafeThread, messageId: string, likes: string[]): boolean {
    const row = thread.messages.find((entry) => entry.id === messageId);
    if (row === undefined) return false;

    // ⚠ COPIED, not aliased: `payload.likes` is the wire's own array, and keeping a
    // reference would let a later merge mutate it under us.
    row.like = [...likes];

    return true;
  }

  /** Two like lists, equal element-wise and order-independently. See §9. */
  function sameLikes(a: string[] | undefined, b: string[]): boolean {
    if (a === undefined) return false;
    if (a.length !== b.length) return false;

    const left = [...a].sort();
    const right = [...b].sort();

    return left.every((value, index) => value === right[index]);
  }

  /**
   * `cafe:table:change-message-status` — a moderator's verdict, and ⚠ the payload is a
   * **FULL MESSAGE**, not a status and an id.
   *
   * The row is replaced wholesale by `id`, because a moderation outcome can change
   * more than `status` — and a row that only had its status patched would be a
   * half-truth about a document the server has just re-sent in full.
   *
   * ⚠ The client-only flags SURVIVE the replacement, because they are about this
   * client (is a send still in the air?) and the wire knows nothing of them.
   */
  function applyMessageStatusBroadcast(message: ICafeTableMessage): void {
    if (typeof message !== "object" || message === null) return;

    const thread = activeThreadFor(message.roomId);
    if (thread === null) return;

    const id = usableId(message.id);
    if (id === null) return;

    const existing = thread.messages.find((row) => row.id === id);

    const persisted: ICafeThreadMessage = {
      ...toThreadMessage(message),
      ...(existing?.localId !== undefined && { localId: existing.localId }),
      ...(existing?.sending !== undefined && { sending: existing.sending }),
      ...(existing?.failed !== undefined && { failed: existing.failed }),
    };

    thread.messages = mergeRows(
      thread.messages.filter((row) => row.id !== id),
      [persisted],
    );
  }

  /**
   * `cafe:table:message-sending-status` — ⚠ **A PLAIN STRING** (`"enabled"` /
   * `"disabled"`), and **no `tableId`** (§18.6).
   *
   * It lands on the thread as an **OVERRIDE**, never on `cafe.table`: mutating the
   * REST answer would make a later re-read of `/single` unable to restore the truth,
   * and `null` is what «follow the payload» means. The page's `sendingWindowSource`
   * is then a two-line precedence with no window arithmetic of its own.
   *
   * ⚵ And this is a **UX** gate, never an authorization one: the server still refuses
   * the send, so a wrong reading costs one `ERR_SEND_MESSAGE_TABLE_NOT_FOUND` and a
   * Persian sentence.
   */
  function applySendingStatus(status: ICafeWindowBroadcast): void {
    const thread = activeThreadFor();
    if (thread === null) return;

    // ⚠ An unreadable value becomes `null` — «follow the `/single` payload» — which is
    // the safe direction: the answer this client already holds.
    thread.sendingOverride = windowStatus(status);
  }

  /** `cafe:table:secure-chat-status` — the same string, the other window. */
  function applySecureChatStatus(status: ICafeWindowBroadcast): void {
    const thread = activeThreadFor();
    if (thread === null) return;

    thread.secureOverride = windowStatus(status);
  }

  /** `"enabled"` / `"disabled"`, or `null` for anything the wire sent that is neither. */
  function windowStatus(value: unknown): ICafeWindowBroadcast | null {
    return value === "enabled" || value === "disabled" ? value : null;
  }

  /**
   * `cafe:table:join-new-user` / `cafe:table:leave-new-user` — presence.
   *
   * ⚠⚠️ **THE READER'S OWN EVENT IS IGNORED.** §14.1 says it outright: «also delivered
   * to the reader who joined». Recording it would make this reader's own bubble carry a
   * presence record that only ever says «the person reading this is here», which is
   * true by definition and says nothing.
   *
   * ⚠ A `userId` this client has never seen is STILL recorded, because the event
   * carries `fullName` — and a nameless bubble is a worse picture than a thinner
   * roster (§14.1's «add/update participant presence list»).
   */
  function applyPresence(payload: ICafePresenceBroadcast, online: boolean): void {
    const id = usableId(payload?.userId);

    if (id === null || id === myId.value) return;

    presence.value = {
      ...presence.value,
      [id]: {
        userId: id,
        ...(typeof payload.fullName === "string" && { fullName: payload.fullName }),
        isOnline: online,
        ...(typeof payload.lastSeen === "number" && { lastSeen: payload.lastSeen }),
        ...(typeof payload.role === "string" && { role: payload.role }),
      },
    };
  }

  /**
   * `cafe:table:receive-new-message` — ⚠ **a bare table-id STRING**, on the
   * `channels-page:<userId>` room (§14.3). It is a BADGE signal, not a message, and it
   * carries no body, no sender and no count.
   *
   * ⚠ **IGNORED WHEN IT NAMES THE TABLE ON SCREEN**: the reader is looking at it, so a
   * badge for it is a number about a conversation already open in front of them.
   *
   * ⚠ AND **THE BADGE ITSELF IS NOT INVENTED.** `unreadMessages` is computed by the
   * backend as `messageSecunce - lastReadSequence` with no clamp, so a client cannot
   * recompute it without a `lastReadSequence` it does not have. What this client CAN do
   * is make the held channels answer un-servable, so the list re-reads the server's own
   * number the next time it is drawn.
   *
   * ⚠ AND IT ASKS FOR NOTHING, on purpose: `reset("joined")` would clear the list the
   * bottom menu is drawing on this very screen.
   */
  function applyUnreadBadge(tableId: string): void {
    const id = usableId(tableId);
    if (id === null) return;

    if (id === activeThreadId.value) return;

    invalidateJoined();
  }

  /**
   * `app:error` — the socket's ONE failure channel, and it means «an operation was
   * refused», not «the connection is down».
   *
   * ⚠ IT IS NEVER WRITTEN INTO `errors.messages`. A refused OPERATION on a socket that
   * is still perfectly connected — one message may be refused while the transport
   * carries others — must not blank the transcript; that is the same `run()`/`CLEARED`
   * mistake the mutation path exists to avoid, reached from the other direction.
   *
   * ⚠ **AN ENGLISH BACKEND CRASH NEVER REACHES A READER.** `parseCafeFailure` runs the
   * 5xx-with-no-`reason` rule from `~/utils/api-error`, so a `TypeError` from the server
   * is replaced by the written sentence; and `reason` is narrowed to the documented
   * union, so a caller can branch on it instead of comparing a string nobody promised.
   */
  function applySocketError(error: ICafeSocketError): CafeFailure | null {
    if (typeof error !== "object" || error === null) return null;

    const failure = parseCafeFailure(error, "در حال حاضر نشد این عملیات انجام شود.");

    socketFailure.value = failure;

    return failure;
  }

  /** Forget the last live failure — a screen calls this once it has shown the sentence. */
  function clearSocketFailure(): void {
    socketFailure.value = null;
  }

  return {
    // state
    cafes,
    activeCafe,
    tables,
    table,
    myAccess,
    stats,
    searchResults,
    joined,
    // messaging state
    threads,
    activeThreadId,
    users,
    presence,
    pendingLikes,
    sendPending,
    socketFailure,
    loaded,
    pending,
    errors,
    // getters
    publicCafes,
    privateCafes,
    topPublicCafes,
    managedCafeIds,
    managedTableIds,
    subscribedTableIds,
    unreadFor,
    // messaging getters
    thread,
    threadMessages,
    memberFor,
    isRead,
    newMessagesFrom,
    newestRenderedSequence,
    sendingOverride,
    secureOverride,
    internalTableId,
    threadFor,
    // actions
    fetchFeet,
    fetchCafe,
    fetchTables,
    fetchTable,
    refreshTable,
    fetchMyAccess,
    fetchStats,
    searchTables,
    fetchSubscribed,
    // thread: reads
    enterThread,
    leaveThread,
    discardThread,
    fetchMessages,
    catchUpMessages,
    scheduleCatchUp,
    fetchUsers,
    // thread: mutations
    sendMessage,
    editMessage,
    deleteMessage,
    toggleLike,
    markSeen,
    scheduleMarkSeen,
    reportTarget,
    joinTable,
    leaveTable,
    // socket appliers
    applyLiveMessage,
    applyEditBroadcast,
    applyDeleteBroadcast,
    applyDeleteBulkBroadcast,
    applyLikeBroadcast,
    applyMessageStatusBroadcast,
    applySendingStatus,
    applySecureChatStatus,
    applyPresence,
    applyUnreadBadge,
    applySocketError,
    clearSocketFailure,
    // escape hatch
    reset,
  };
});