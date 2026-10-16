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
 */

import { isCafeSuccess, parseCafeFailure } from "~/utils/cafe-response";
import type {
  CafeFailure,
  CafeFailureReason,
  CafeResource,
  CafeResult,
  ICafe,
  ICafeAccess,
  ICafeAccessRow,
  ICafeChannel,
  ICafeFeetQuery,
  ICafeFeetResponse,
  ICafeMyAccessQuery,
  ICafeMyAccessResponse,
  ICafeSearchResponse,
  ICafeSingleResponse,
  ICafeSingleTableResponse,
  ICafeStats,
  ICafeStatsResponse,
  ICafeSubscribedQuery,
  ICafeSubscribedResponse,
  ICafeTableParticipant,
  ICafeTableView,
  ICafeTablesQuery,
  ICafeTablesResponse,
  SubscribeItem,
} from "~/types/cafe";

/**
 * The fetcher every action hands to its request helper, so a server render
 * reaches our own `/api` routes WITH the incoming request's cookies.
 *
 * Typed as `useRequestFetch()`'s own return type rather than `typeof $fetch`,
 * for the reason `stores/goalAward.ts` documents: on the server that composable
 * hands back `event.$fetch` (`H3Event$Fetch`), which carries neither
 * `$Fetch.raw` nor `$Fetch.create`, so `typeof $fetch` would reject the very
 * value this exists to accept.
 */
type CafeFetcher = ReturnType<typeof useRequestFetch>;

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
} as const;

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
 * The refusal for a request this store refused to MAKE.
 *
 * The backend would answer the same thing — `ERR_TABLE_NOT_FOUND` for a table
 * that is not there — but a route parameter is already in hand, and the literal
 * request `useRoute()` produces mid-navigation is
 * `/api/cafe/table/undefined/tables`. It is still built by `parseCafeFailure`,
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

export const useCafe = defineStore("cafe", () => {
  /* ------------------------------------------------------------------ state -- */

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

  const loaded = ref<Record<CafeResource, boolean>>({
    feet: false,
    cafe: false,
    tables: false,
    table: false,
    myAccess: false,
    stats: false,
    search: false,
    joined: false,
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
        // these rows AND refused», which is not a thing that can be true.
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
      `/api/cafe/table/${encodeURIComponent(cafeId)}/tables`,
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
    const requestFetch = useRequestFetch();
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
    const requestFetch = useRequestFetch();
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
    const requestFetch = useRequestFetch();
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
        `/api/cafe/table/${encodeURIComponent(id)}/tables`,
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
    const requestFetch = useRequestFetch();
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
    const requestFetch = useRequestFetch();
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
    const requestFetch = useRequestFetch();

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
    const requestFetch = useRequestFetch();
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
    const requestFetch = useRequestFetch();
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
    // actions
    fetchFeet,
    fetchCafe,
    fetchTables,
    fetchTable,
    fetchMyAccess,
    fetchStats,
    searchTables,
    fetchSubscribed,
    // escape hatch
    reset,
  };
});