# کافه — the seven screens, on the API

Seven pages that compose the primitives in `app/components/Cafe/`. Every café row
now comes from `app/stores/cafe.ts`, which is the **only** place a café request
is made. There is no `localStorage` cache and no socket in this folder yet.

| Layer | Where |
|---|---|
| Screens | `app/pages/cafe/` |
| Data | `app/stores/cafe.ts` — `useCafe()`, eight actions, one `CafeResult` |
| Transport | `server/api/cafe/*.get.ts` / `*.post.ts` — Nitro proxies |
| Contract | `app/types/cafe.ts` — every response, query and backend quirk |
| Envelope | `app/utils/cafe-response.ts` — the ONE reader of a café answer |
| Sign-out | **nowhere** — this repo has no logout endpoint, and `app/stores/auth.ts` exposes no `logout`/`signOut` (see below) |

`app/utils/cafe-mock.ts` (the 54KB fixture the design wave ran on) has been
**deleted**. If you find an import of it, that import is a bug.

## Routes → data source

| Route | File | Store action → state | Flags that drive loading / empty / error |
|---|---|---|---|
| `/cafe` | `index.vue` | `fetchFeet()` → `cafe.cafes`; `fetchSubscribed()` → `cafe.joined` (the «صوتی» segment) | `pending.feet`, `errors.feet` |
| `/cafe/[cafeId]/table` | `[cafeId]/table/index.vue` | `fetchCafe()` → `activeCafe`; `fetchTables()` → `tables`; `fetchSubscribed()` → `joined` + `unreadFor`; debounced `searchTables()` → `searchResults` | `pending.cafe` / `pending.tables` / `pending.search`, `errors.cafe` / `errors.tables` / `errors.search`, `loaded.tables` |
| `/cafe/[cafeId]/table/[tableId]` | `[cafeId]/table/[tableId].vue` | `fetchTable()` → `cafe.table` (+ `subscribe`, `isManager`, `messageSendingEnabled`, `secureChat`) | `pending.table`, `errors.table` |
| `/cafe/joined` | `joined.vue` | `fetchSubscribed()` → `cafe.joined` | `pending.joined`, `errors.joined`, `loaded.joined` |
| `/cafe/chat` | `chat.vue` | `fetchSubscribed()` → `cafe.joined` | `pending.joined`, `errors.joined`, `loaded.joined` |
| `/cafe/management` | `management.vue` | `fetchMyAccess()` (**no `type`**) → `cafe.myAccess`, split into cafés / میزها by the populated `cafe` / `table` array | `pending.myAccess`, `errors.myAccess`, `loaded.myAccess` |
| `/cafe/settings` | `settings.vue` | **no café call** — `useUser().state.user`, already resolved by `middleware/auth.ts` | none |

Navigation is **cafés → tables → conversation**. Every page declares
`definePageMeta({ layout: 'cafe', middleware: ['auth'] })`; the thread adds
`cafeMenu: false`, which is the only thing that removes `CafeBottomMenu` and the
only reason the composer sits on the viewport's bottom edge.

Actions are awaited in the **setup body**, never in `onMounted`, so the server
render is complete and the rows arrive in the Pinia payload. Every screen calls
`cafe.reset(<resource>)` before re-reading on a route-param change — without it
the store's idempotence would serve the previous café's rows under the new café's
URL.

## Five backend rules that are load-bearing

1. **HTTP 200 is not success.** `expressErrorHandler` answers every refusal with
   HTTP 200/201 and the real code inside `statusCode`. `success === true` is the
   signal, `reason` is the branch key, and nothing may read the HTTP status or
   trust a resolved `$fetch`. Every store action goes through `isCafeSuccess()`
   then `parseCafeFailure()`, which runs the sentence through
   `~/utils/api-error`'s `refusalMessage` so a backend crash's English
   `TypeError` never reaches a screen.
2. **The single table comes back as an OBJECT, and `subscribe` with it.**
   `GET /table/:cafeId/:tableId/single` looks like it returns a list — it does
   not. The controller does `[table] = await …aggregate([...])`, which keeps only
   the **first** document, then sends `res.json({ success: true, table })`. So
   `table` is a single object, never an array. Inside it, `subscribe` has been
   `$unwind`ed to one participant and is a single object too — *whichever
   participant the pipeline emitted first*, which is not necessarily the reader.
   `fetchTable` therefore normalises both: it accepts an object or an array and
   coerces `subscribe` to an array. The array's length is **not** a fact about
   the room, and no screen may render a participant count from it. Reading `table`
   as an array makes `fetchTable` manufacture `ERR_TABLE_NOT_FOUND` on a
   perfectly successful 200 — this screen then renders «این میز پیدا نشد» for
   every table and still looks healthy. A `$match` that finds nothing really does
   answer `success: true` with `table` absent; that is the genuine
   not-found path, and the refusal UI for it is correct.
3. **Two endpoints paginate wrongly.** `GET /me/my-ct` reads its row *count* off
   `page` (and its offset off `(page - 1) × page`, so `page` is count and base at
   once), and `GET /table/subscribed` puts `$limit` before `$skip` and feeds
   `$skip` the page number, so page 2 silently repeats page 1. The store asks
   for one large page and the list is paged on the client. Do not "fix" this by
   paginating properly — you will drop rows. For `my-ct` the figure is the named
   constant `MY_ACCESS_PAGE = 0` in `app/stores/cafe.ts`, and **`0` is deliberate,
   not a bug**: the query string turns it into the truthy `"0"`, so `limit`
   becomes `0` — which MongoDB defines as *no limit* — and `skip` becomes `0`.
   Leave it alone; the arithmetic is documented there.
4. **`id` is not `tableId`.** A URL under `/cafe/[cafeId]/table/…` carries the
   **public** `ch_` / `cv_` / `tb_` handle, because that is what a café page can
   print and a reader can type. `GET /table/:cafeId/:tableId/single` matches the
   table's **internal** `id` (its `uniqid`, which is also the socket room name
   and the messages' `roomId`). `fetchTable` accepts whichever the route has and
   resolves between them internally. Using one in place of the other is the most
   common way to end up in a room that never receives anything.
5. **⚠️ A GRANT CARRIES NEITHER `type` NOR `id`, AND SENDING `type` HIDES YOUR
   CAFÉS.** `GET /me/my-ct` rows are shaped `{ targetId, userId, startAt, endAt,
   cafe: ICafe[], table: ICafeTableView[] }`; `id` / `type` / `createdAt` /
   `updatedAt` are present on some rows and absent on others, so `ICafeAccess`
   declares `id?` and `type?`. The schema requires both
   (`Server/src/models/cafe-access.model.ts:10-14`, `enum: ['cafe','table','guest']`),
   but Mongoose validation is the only thing that puts them there, and a real
   grant document was inserted straight into Mongo without it. Measured live, for
   a reader who really does hold both kinds of grant:

   | request       | rows returned                                  |
   |---------------|------------------------------------------------|
   | unfiltered    | **2** — one café grant, one table grant        |
   | `?type=cafe`  | **0** ← the café grant is silently missed      |
   | `?type=table` | 1 — only the grant Mongoose wrote              |

   ⚠️ Re-measured while `/cafe/management` was being built: that session answers
   **1** row unfiltered and **0** for `?type=table` (its table grant's `endAt` has
   elapsed — see the bullets below). The filter column is unchanged and so is the
   hazard: a café grant this reader really holds is still invisible under
   `?type=cafe`.

   `getUserCafeAndTableAccess` filters with `{ type }`, so the filter matches
   nothing for an un-validated grant and answers `success: true` with an empty
   list — indistinguishable from «you administer nothing». Three consequences:
   **never forward `type`** (`/cafe/management` calls `fetchMyAccess()` with no
   argument, and that is not an oversight); **never branch on it** —
   `managedCafeIds` / `managedTableIds` used to, and were therefore permanently
   empty on every reader. What identifies a grant is the **populated array**: the
   `cafe` virtual is matched by `targetId` on `Cafe.id` and the `table` one on
   `Cafe Table.id`, so at most one of the pair is ever filled and that is what
   `management.vue` and both getters read. A row populating **neither** is
   ignored on purpose: it names nothing that can be rendered.

   **Two more facts about this endpoint, measured, not documented.** Both belong
   to the backend, and neither may be "fixed" from this repo:

   - `getUserCafeAndTableAccess` filters on `$or: [{ endAt: null }, { endAt:
     { $gte: Date.now() } }]` and **nothing else** — so an elapsed grant simply
     stops appearing, with no answer to say so. At the time of writing the test
     session's unfiltered answer is **one** row (the café grant), while
     `GET /table/:cafeId/:tableId/single` reports `isManager: true` for its table
     «آموزش Nuxt.js»; that `isManager` is a `$lookup` on `targetId` alone, which
     reads **no `userId` and no `endAt`**, so the two disagreeing is expected and
     neither is proof that *this* reader manages that table.
   - The same missing `userId` filter means the endpoint answers with **every**
     reader's grants, not the caller's. That is a backend privacy bug; it is
     recorded here so nobody builds a feature that trusts the list as "mine",
     and it must be fixed server-side rather than filtered away on the client.

Two more that bite silently: **`useRequestFetch()`, never a bare `$fetch`** — on
the server a plain `$fetch('/api/…')` reaches our own Nitro route with no cookie,
so every authenticated café route refuses and the screen renders an empty state
as if the reader had no cafés at all. And **`Date.now()` is legal in exactly one
place per page**: inside an event handler, or behind a `ref<number>()` set in
`onMounted`. A clock computed during SSR and recomputed on the client is a
hydration mismatch — this is why every list keeps a `now` ref.

## What is NOT built yet

This section is the important one. The screens do not pretend otherwise.

- **No messaging at all.** Message history, sending, the `/cafe` socket, uploads,
  read receipts, reactions, edit/delete and polls are all absent. There is no
  messages endpoint in the store and no socket plugin in `app/plugins/`.
- **The thread therefore starts empty.** The single-table endpoint answers a
  table it cannot match as `success: true` with **`table` absent**, and
  `fetchTable` turns that success-with-nothing into `ERR_TABLE_NOT_FOUND` itself
  (see `app/stores/cafe.ts` and the thread page's own comment). ⚠️ The
  `INFO_TABLE_NOT_FOUND` refusal that answers `success: true` with
  `messages: []` belongs to **`GET /table/:tableId/messages`** — the messages
  endpoint, which this store does not read — so do not expect that shape here.
  There is **no `send()` on the thread screen**, nothing is appended locally, and
  a fake `local-${seq}` optimistic message — which is what the design wave did —
  would be the worst possible lie in a messenger, so it was removed.
- **⚠️ THE WRITE GATE IS TWO QUESTIONS, ASKED IN THIS ORDER — JOIN FIRST.**
  `messageSendingEnabled` says *when* a table may be written in; it says nothing
  about *who* may write in it. Reading it alone drew a live composer on tables the
  reader had never joined.
  1. **Is the reader a participant?** `membership === "member"` draws the composer
     live; `membership === "mute"` draws it **disabled**; a table you are not in
     gets the **join bar** in its place, since a table you are not in has nothing
     to type into; `banned` gets neither, because the backend answers
     `ERR_TABLE_BANNED` and the button would promise what it has refused.
     ⚠️ **`mute` must NOT get the join bar.** A muted reader HAS joined — the
     participant document saying `mute` exists because they joined — so a
     «برای نوشتن باید عضو باشید» bar under a «شما بی‌صدا هستید» band tells a member
     they are a stranger to a table they are standing in.
  2. **Is sending open?** `isManager || sendWindow === "open"`. The manager
     exemption survives, but only *behind* the membership gate.
- **⚠️ ON THIS ROUTE `membership` CAN ONLY BE `"member"` OR `"none"`.** Not a choice
  this app made: `getSingleTable`'s `$lookup` into participants carries
  `{ $match: { status: "active" } }` (controller `:681`), so the service only ever
  looks up ACTIVE participants. Verified live — setting the reader's own document
  to `mute` and re-reading the endpoint answers `200 { success: true }` with
  `subscribe` **absent**, which the screen maps to `"none"`.
  So the `"left"` / `"banned"` / `"mute"` arms and their bands are **unreachable
  today**, and a reader who left, was muted or was banned arrives looking exactly
  like a stranger — and gets the join bar, which for a banned reader is an offer the
  server will refuse. **Do not "fix" a band that never draws by tightening the
  gate**; the gate is right and the endpoint withholds the row. The honest source
  for those three states is `GET /table/:tableId/users` plus this one's silence,
  neither of which is in the store yet.
  A `secureChat` that was CONFIGURED AND THEN ELAPSED hides the composer too.
  ⚠️ That test is `secureChatConfigured && secureChat === "closed"`, never the
  bare `secureChat === "closed"`: `windowState` answers `closed` for «never
  configured» exactly as it does for «configured and elapsed», and the bare form
  hid the composer — and the whole transcript — on every ordinary table.
- **`composerPlaceholder` reads `!sendingOpen`, never `sendWindow !== "open"`.**
  They are not the same test, and the difference is visible: a manager whose window
  is closed is TYPABLE (they set that window), so showing them «فقط از … تا … فعال
  است» on a live field is a sentence contradicting the control under it. The
  placeholder and `composerEnabled` read one gate so they cannot disagree.
- **The composer is TYPABLE and the `+` and mic are LIVE — but nothing DELIVERS.**
  The field holds a local `draft`, `CafeAttachSheet` opens, and `CafeVoiceRecorder`
  renders. `@select`, `@send` and the shell's `submit` are deliberately unbound:
  there is no send endpoint, no upload, and no `MediaRecorder` behind any of them.
  ⚠️ Do not "finish" this by appending the draft to `messages` — an outgoing bubble
  that never reached the server is a message the reader believes they sent in a
  conversation other people are reading. That is the exact lie the removed
  `append()` told, and it is why `messages` stays empty until
  `GET /table/:tableId/messages` lands.
- **The transcript is drawn in every state.** `secureChat` decides what the header
  PINS, never whether `CafeMessageList` is drawn: while the window is open the
  page pins «گفتگوی امن فعال است؛ محتوای این میز از … تا … حذف می‌شود» with the
  span from `secureChatNotice`; when it is closed the table simply shows its
  content. An empty `messages` array renders `CafeMessageList`'s own empty state,
  which is a different sentence from «a window ended» — and only the list knows
  which is true. The pin is client-only by design (`now` is a `ref` set in
  `onMounted`, so SSR cannot know the reader's clock without a hydration
  mismatch), which is why it is absent from the served HTML and present after
  mount. Both windows are re-evaluated on an interval cleared in
  `onBeforeUnmount`.
- **No membership mutations.** `POST /table/subscribe` and
  `POST /table/:id/left` are proxied but **not called**. The thread's leave and
  re-join controls are drawn `disabled` and carry no handler.
- **Management is a LIST and nothing else.** `/cafe/management` draws the reader's
  grants — one `CafeCard` per café, one `CafeTableCard` per table — and each row
  links onward to a screen that already exists. There is no management action on
  it: no café-settings modal, no member list, no role editing, and the 3-dot
  control on `/cafe/[cafeId]/table` therefore stays `disabled` for every reader,
  which is still the only state that is true for every reader. A grant whose
  `table[0]` does not name its café is **omitted** rather than rendered: the
  thread route is `/cafe/:cafeId/table/:tableId`, so there is no link to offer
  and a row pointing at `/cafe/undefined/table/…` would be a live-looking row
  that opens nothing.
- **`settings.vue` persists nothing, and signs nobody out.** Every switch is a
  local `ref`, and the sign-out row is drawn as **«خروج از حساب — به‌زودی»** —
  a non-actionable row (`type="link"` with no `to`, so no chevron, no hover and
  no tab stop) with its own sentence saying that no session is cleared. There is
  no `POST /auth/logout` in this repo, so the row states what it is instead of
  swapping the profile header for a «از حساب خود خارج شدید» panel the `access-token`
  cookie never agreed to — the same "shown, labelled, and saying why it cannot be
  used" trade the thread's disabled composer makes. Do not fake either.
- **Two stat tiles render `—`.** «اعضای فعال» and «پیام‌های امروز» need
  `GET /table/:tableId/users` and a message history, neither of which is in this
  wave. `GET /stats` is deliberately **not** called: it is admin-oriented, and its
  three fields count the whole catalogue rather than one café — `cafesActive` and
  `cafesByStatus` are `$group` rows (read as
  `cafesByStatus?.find(r => r._id === 'public')?.count`, never `.length`, which
  counts the *groups*), and `topPublicChannel` is the global top ten. «تعداد
  میزها» is the length of the page requested, because the endpoint sends no total.

## Continuing from here

In order, for whoever picks this up:

1. `GET /table/:tableId/messages` proxy + a `fetchMessages` action —
   paged by **sequence** (`cursor`), not by offset, and read with
   `isCafeMessagesPayload()` + `isTableNotFoundFailure()` rather than
   `isCafeSuccess()`, which returns `true` for that endpoint's refusal.
2. A `/cafe` socket plugin — recreate `app/plugins/cafe-socket.client.ts`,
   deleted in this wave — connecting on the `/cafe` namespace with
   `auth: { token }`. ⚠️ **Get that token from a new server route that
   mints a short-lived, single-purpose socket ticket — do NOT read it out of
   `POST /api/auth/check-token`.** That handler used to echo the raw cookie
   back as `{ has, value }`, which shipped the 30-day bearer into the SSR
   payload inlined in the served HTML; it now returns `{ has }` only and must
   stay that way. A socket needs a token in JS by nature, which is exactly why
   it needs a narrow, short-lived substitute rather than the session cookie.
   The optimistic payload has **no** `senderId`,
   `sequence` or `createdAt` — those arrive with the history read, so key a
   pending message by its own client id. A listener for
   `cafe:session-expired` will have the payload typed already in
   `app/types/cafe.ts` (`CafeSessionExpiredPayload`).
3. `subscribe` / `left`, so the thread's `leave()` / `rejoin()` do something.
4. `GET /table/:tableId/users` for the roster, presence and the «اعضای فعال»
   tile. An empty array is **not** an error: a non-member gets
   `{ success: true, users: [] }`.
5. Management **actions**, on top of the list `/cafe/management` already draws —
   and only after rule 5 above is respected: the reads are unfiltered and the
   rows are told apart by their populated array, never by `type`. Compare
   `startAt` yourself when you do — the server's `hasAccess` ignores it, so a
   grant already counts before its own start time.
6. The settings switches and logout, against whatever the settings/auth stores
   already expose.
