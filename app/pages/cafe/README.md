# کافه — the six live screens, on the API

Six pages that compose the primitives in `app/components/Cafe/`, plus one route
kept but disabled (`/cafe/chat`, see its own `redirect`). Every café row
now comes from `app/stores/cafe.ts`, which is the **only** place a café data
request is made, and every café socket listener lives in
`app/composables/useCafeThreadSocket.ts`, which is the only place rooms are joined
or left. There is no `localStorage` cache. The socket
(`app/plugins/cafe-socket.client.ts`) connects app-wide on the `/cafe` namespace
and now carries the thread's message traffic; **uploads** are the one piece of the
messaging wave that does not exist: see "What is NOT built yet".

| Layer | Where |
|---|---|
| Screens | `app/pages/cafe/` |
| Data | `app/stores/cafe.ts` — `useCafe()`, one `CafeResult` |
| Realtime | `app/composables/useCafeThreadSocket.ts` — the room lifecycle + every listener |
| Transport | `server/api/cafe/*.get.ts` / `*.post.ts` — Nitro proxies, except `socket-ticket.post.ts`, which reads its own cookie |
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
| `/cafe/[cafeId]/table/[tableId]` | `[cafeId]/table/[tableId].vue` | `fetchTable()` → `cafe.table` (+ `subscribe`, `isManager`, `messageSendingEnabled`, `secureChat`); `useCafeThreadSocket(cafeId, tableId)` → `enter()`/`leave()` own the rooms, the cold first window, the catch-up, the roster, the `/single` refresh and the read receipt | `pending.table`, `errors.table`, plus `messages` / `users` inside the store |
| `/cafe/joined` | `joined.vue` | `fetchSubscribed()` → `cafe.joined` | `pending.joined`, `errors.joined`, `loaded.joined` |
| `/cafe/chat` | `chat.vue` — **disabled**, `redirect: '/cafe/joined'`, so nothing below runs | none | none — the page never renders |
| `/cafe/management` | `management.vue` | `fetchMyAccess()` (**no `type`**) → `cafe.myAccess`, split into cafés / میزها by the populated `cafe` / `table` array | `pending.myAccess`, `errors.myAccess`, `loaded.myAccess` |
| `/cafe/settings` | `settings.vue` | **no café call** — `useUser().state.user`, already resolved by `middleware/auth.ts` | none |

Navigation is **cafés → tables → conversation**. Every page declares
`definePageMeta({ layout: 'cafe', middleware: ['auth'] })`; the thread adds
`cafeMenu: false`, which is the only thing that removes `CafeBottomMenu` and the
only reason the composer sits on the viewport's bottom edge. ⚠️ **That flag must
be read INSIDE a `computed` in `layouts/cafe.vue`, never captured in its
`setup()`.** Nuxt keys a layout instance by layout NAME, so `/cafe` → the thread
reuses the same instance and `setup()` never runs again: captured once, the pill
answered the first page forever, and the thread arrived with a pill under its
composer while a cold load of the same URL looked correct. `/cafe/chat` adds a
`redirect` instead of a `cafeMenu`, which vue-router resolves off the route
record **before** the component loads — so the screen does not render and
`fetchSubscribed()` never runs.

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

- **Messaging is built; UPLOADS ARE NOT.** Message history, sending, the context
  menu, the inline edit, delete, like, both levels of §7's report, read receipts,
  `subscribe` / `left` and the socket traffic behind them are all wired through
  `useCafe()` and `useCafeThreadSocket` — `app/stores/cafe.ts` and
  `app/composables/useCafeThreadSocket.ts` are the only two places a café request
  is made and no screen keeps a local array standing in for an endpoint.
  ⚠️ **Two controls remain inert and both say so in Persian rather than
  pretending.** `CafeAttachSheet`'s `select` is bound and answers «هنوز امکان ارسال
  پیوست در این نسخه فعال نیست»: `sendMessage` wants `file.mainFile`, the URL an
  **upload** returns, and there is no upload endpoint in the documented contract —
  inventing one (`data:`, a placeholder path) would post a document the server
  cannot serve. `CafeVoiceRecorder`'s `send` stays unbound because the event
  carries **no bytes** (`send: []`).
  ⚠️ **And there is no way to retry a REFUSED send from its bubble.** The store
  marks the optimistic row `failed` and keeps it, and `sendMessage` always builds a
  **new** `local:` row — so a «تلاش دوباره» on the failed row would leave the reader
  with a red bubble *and* a second copy of the same words. The screen does not draw
  one; the retry the reader actually gets is the one the composer keeps: a refused
  send **never clears the draft**, so the words are one tap away.
  ⚠️ **AND A ROW THAT IS `sending` OR `failed` GETS NO CONTEXT MENU AT ALL** — every
  row of it is refused. A `local:<n>` id carries a `:`, which is outside
  `isResourceId`'s charset, so the proxies reject the id before a request exists and
  answer «اتصال اینترنت را بررسی کنید» about a string that never left the phone; the
  row stays, `failed` is never cleared, and the kept draft means the next send is a
  second bubble beside the first. `CafeMessageList`'s `canOpenMenu` therefore closes
  all three menu doors (long press, `contextmenu`, the row's keyboard door) for those
  two states, and the row's own «در حال ارسال» / «ارسال نشد» chip is the whole report.
- **A rejected handshake or a server kick is terminal for the session.** After a
  refused namespace handshake (`connect_error`: `Authenticate to log in` /
  `invalid token`) or an `io server disconnect` (server kick), socket.io has
  destroyed the instance before the event reaches the plugin and nothing
  re-opens it: `/cafe` stays «قطع اتصال» until a **full page reload**. Ordinary
  network drops are the other case and DO self-heal — the manager's own
  `reconnect_attempt` loop survives them, the socket stays active under it, and
  `useCafeThreadSocket`'s `connect` handler re-emits the joins and catches up.
  ⚠️ **AND THE BADGE ROOM IS RE-JOINED ON EVERY HANDSHAKE, WITH NO LATCH.** The
  plugin emits `cafe:join-channels-page` on **every** `connect`, which is what §19.6
  asks for (it lists the emit alongside the two room joins as a reconnect re-emit).
  A per-*instance* latch was here and was a silent defect: socket.io keeps the
  client-side instance across an ordinary drop while the **server-side** socket is
  new and holds no rooms, so the emit never fired again, `cafe:table:receive-new-message`
  never arrived again, and every unread badge in `/cafe`, `/cafe/joined` and the thread
  header froze while the badge still read «متصل». §10.3 gives the event no ack and no
  side effect beyond the join, so emitting per connection is free.
- **⚠️ `npx vue-tsc --noEmit` CHECKS NOTHING IN THIS REPO.** The root
  `tsconfig.json` is solution-style (`"files": []` + `references`), so the bare
  command exits 0 on a file containing a type error — verified by probe, not
  assumed. **The three commands that actually gate this feature, all of which must
  exit 0:**
  ```sh
  npx vue-tsc -p .nuxt/tsconfig.app.json --noEmit     # the app (pages + components)
  npx vue-tsc -p .nuxt/tsconfig.server.json --noEmit  # Nitro: routes + server utils
  npx nuxt build                                     # what ships
  ```
  ⚠️ **The `TS2321: Excessive stack depth` errors that used to be recorded here are
  GONE** — `.nuxt/tsconfig.app.json` now exits 0 with no output at all. They were
  never café's either; they came from Nitro's typed-route inference, and the
  recursion-depth regression was fixed by **narrowing the fetchers**. ⚠️ **And the
  depth scales with the ROUTE COUNT**, so adding routes can put it straight back: if
  `TS2321` reappears, narrow a fetcher's return type rather than reaching for the
  blunt remedy — **`nitro.experimental.types = false` in `nuxt.config.ts`**, which is
  recorded here as an **unapplied decision and the user's call**: it buys the depth
  back by giving up typed Nitro routes across the whole app. Nobody has applied it.
- **The write gate is two questions, asked in this order — join first.**
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
- **⚠️ BOTH WINDOWS NOW HAVE A LIVE OVERRIDE, AND IT IS A PRECEDENCE.** A
  `cafe:table:message-sending-status` / `cafe:table:secure-chat-status` string
  (§18.6 — no table id, no bounds) replaces the window's **`enabled` flag** and
  nothing else: the start and end still come from `/single` and `windowState` still
  does the arithmetic, so a window switched on outside its own hours stays closed.
  The override is read through `cafe.sendingOverride(id)` /
  `cafe.secureOverride(id)` and is **never written onto `cafe.table`** — that is
  the whole reason the store holds it on the thread.
- **⚠️ ON THIS ROUTE `membership` CAN STILL ONLY BE `"member"` OR `"none"` FROM THE
  PAYLOAD.** Not a choice this app made: `getSingleTable`'s `$lookup` into
  participants carries `{ $match: { status: "active" } }` (controller `:681`), so
  the service only ever looks up ACTIVE participants. Verified live — setting the
  reader's own document to `mute` and re-reading the endpoint answers
  `200 { success: true }` with `subscribe` **absent**, which the screen maps to
  `"none"`.
  So the `"left"` / `"banned"` / `"mute"` arms from the payload are **unreachable
  today**, and a reader who left, was muted or was banned arrives looking exactly
  like a stranger — and gets the join bar, which for a banned reader is an offer the
  server will refuse. **Do not "fix" a band that never draws by tightening the
  gate**; the gate is right and the endpoint withholds the row.
  ⚠️ **The two states this screen CAN claim are the two it has just WRITTEN.** A
  confirmed `POST /table/subscribe` or `POST /table/:id/left` is a fact about the
  reader's own account and is fresher than the row that cannot vouch for itself, so
  a local `localMembership` outranks `/single` until the next navigation clears it.
  With no write of our own the answer stays `none` and nothing is claimed.
  A `secureChat` that was CONFIGURED AND THEN ELAPSED hides the composer too.
  ⚠️ That test is `secureChatConfigured && secureChat === "closed"`, never the
  bare `secureChat === "closed"`: `windowState` answers `closed` for «never
  configured» exactly as it does for «configured and elapsed», and the bare form
  hid the composer — and the whole transcript — on every ordinary table.
- **`composerPlaceholder` reads `!sendingOpen`, never `sendWindow !== "open"`.**
  They are not the same test, and the difference is visible: a manager whose window
  is closed is TYPABLE (they set that window), so showing them «فقط از … تا … فعال
  است» on a live field is a sentence contradicting the control under it. The
  placeholder and `composerEnabled` read one gate so they cannot disagree. A live
  `disabled` override gets its own sentence («ارسال پیام در این میز غیرفعال است»)
  rather than a span that no longer decides anything.
- **The transcript is drawn in every state.** `secureChat` decides what the header
  PINS, never whether `CafeMessageList` is drawn: while the window is open the
  page pins «گفتگوی امن فعال است؛ محتوای این میز از … تا … حذف می‌شود» with the
  span from `secureChatNotice`; when it is closed the table simply shows its
  content. An empty `messages` array renders `CafeMessageList`'s own empty state,
  which is a different sentence from «a window ended» — and only the list knows
  which is true. ⚠️ **That includes a failed `messages` READ**: §15's refusal
  arrives as `success: true`, and the transcript region is drawn whatever
  `errors.messages` holds, because a reader shown «پیام‌ها بارگذاری نشد» over a
  conversation with thirty messages has been told a falsehood. ⚠️ **AND A REFUSAL IS
  DRAWN NOWHERE** — nothing on this route reads `errors.messages`, and that includes
  the paging refusal from `loadOlder`: `fetchMessages` writes `thread.messages` only
  on a real page, so a refused «پیام‌های قدیمی‌تر» costs one press of the button and
  not the conversation, and the button's own spinner stopping is the whole report.
  That silence is a known absence, not an oversight — say so before adding error UI
  for it. The pin above is client-only by design (`now` is a `ref` set in
  `onMounted`, so SSR cannot know the reader's clock without a hydration mismatch). Both windows are re-evaluated on
  an interval cleared in `onBeforeUnmount`.
- **`socketFailure` IS A CHANNEL OF ITS OWN, AND IT IS NOT `errors.messages`.**
  `app:error` means «an operation was refused» — not «the connection is down» — so
  the thread draws it as a dismissible band under the header and clears it with
  `clearSocketFailure()`. It never blanks a good transcript.
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
- **The café header's three stat tiles all count the page already in hand.**
  «تعداد میزها», «میزهای عمومی» (`status === "public"`) and «پیام‌های کافه» (the
  sum of `messageSecunce`) are three readings of `cafe.tables`, each behind
  `loaded.tables`; the `value: string | null → —` contract is kept for the frame
  before that answer lands. ⚠️ «پیام‌های کافه» is deliberately **not** «پیام‌های
  امروز»: the payload carries a lifetime total and no date. `GET /stats` stays
  uncalled: it is admin-oriented, and its three fields count the whole catalogue
  rather than one café — `cafesActive` and `cafesByStatus` are `$group` rows (read
  as `cafesByStatus?.find(r => r._id === 'public')?.count`, never `.length`, which
  counts the *groups*), and `topPublicChannel` is the global top ten. «تعداد
  میزها» is the length of the page requested, because the endpoint sends no total.
- **The café table list has two segments and only one of them works.** «همه میزها»
  and a **locked** «میزهای صوتی» (`disabled` + `solar:lock-linear` + an `sr-only`
  «به‌زودی»); «میزهای من» was removed at the reader's request, so `TabKey` is
  `"all" | "voice"`. `fetchSubscribed()` still runs on that route — `unreadFor`
  answers every badge from `joined`. `onTabKeydown` skips disabled segments in
  both directions, and with one working segment the tab-empty block is
  unreachable (kept on purpose; see the note above `isTabEmpty`).

## Continuing from here

In order, for whoever picks this up:

1. **The upload endpoint.** `CafeAttachSheet`'s `select` and
   `CafeVoiceRecorder`'s `send` are the two dead ends on the thread: both want a
   hosted URL and neither has one. `sendMessage` already takes
   `file: { mainFile, thumbnailFile? }` — it is the upload that is missing, and
   until it exists a `data:` URL would be a lie the server cannot keep. That is
   also the only way a **failed** send could be retried from its own bubble: the
   store has no action to reuse or drop a `local:` row.
2. **§7's two report reasons with no example.** `CAFE_REPORT_REASONS` in
   `app/components/Cafe/ReportSheet.vue` reuses `harassment`, `spam` and
   `impersonation` verbatim from §7's own examples and adds `inappropriate` and
   `other` beside them. ⚠️ `ICafeReportMetadata.reason` is a plain `string` **on
   purpose** — the endpoint stores `metadata` verbatim and never reads it back, so
   there is no server enumeration to check against. If the moderation queue does
   come to have one, that type comment is where the union belongs.
3. **`cafe:session-expired`.** The payload is typed already
   (`CafeSessionExpiredPayload` in `app/types/cafe.ts`) and nothing listens. There
   is no refresh token in this app to renew an expired one with, so a guard has to
   stop rather than loop.
4. **`GET /table/:tableId/users` for the roster and presence UI.** The thread now
   reads it (through `useCafeThreadSocket`'s resync → `cafe.fetchUsers`), but it
   draws presence from it not yet: `CafeMessageList` resolves every name and avatar
   from its `members` prop — which the page feeds straight from `cafe.users` — and
   `presence` is recorded by the socket and never rendered. An empty array is
   **not** an error — a non-member gets `{ success: true, users: [] }`.
   ⚠️ **The store's `memberFor` is NOT what resolves those names, and it currently
   has no caller at all** — it is the roster-merged-with-presence lookup, and
   `MessageList` does its own `members[senderId]` on the map instead. Anything that
   needs presence folded into a member (a «آنلاین» dot, a last-seen line) is the
   case `memberFor` was written for; delete it or wire it, do not leave two answers.
   ⚠️ **AND `ITableUserView` CARRIES EVERY OTHER MEMBER'S `mobile` AND `email`.**
   Those two fields are never rendered anywhere in this feature and must never be:
   `fullName` and `avatar` are the only roster fields that reach a screen. See the
   SSR warning in item 8 before touching how the roster is fetched.
5. **A read receipt that is about somebody else.** `cafe.isRead(sequence)` answers
   «has THIS device reported this one», so the tick is drawn on the reader's own
   messages only. §8 carries exactly one `seen` number per table per user, so
   anything drawn on another person's bubble would be a fabricated claim.
6. Management **actions**, on top of the list `/cafe/management` already draws —
   and only after rule 5 above is respected: the reads are unfiltered and the
   rows are told apart by their populated array, never by `type`. Compare
   `startAt` yourself when you do — the server's `hasAccess` ignores it, so a
   grant already counts before its own start time.
7. The settings switches and logout, against whatever the settings/auth stores
   already expose.
8. ⚠️ **DO NOT CALL `cafe.fetchUsers` FROM A `setup` BODY — IT WOULD LEAK THE ROSTER
   INTO THE SERVED HTML.** This is the one warning in this file with a security
   consequence, so it is written as a rule rather than as a note.
   - **Where it stands today:** `fetchUsers` is reached **only** from `resync()`, and
     `resync()` only from `enter()`, and `enter()` only from `onMounted`, the socket's
     own `connect` / reconnect handlers, and the two route watchers in
     `app/composables/useCafeThreadSocket.ts` — every one of them client-side. So
     `cafe.users` is populated after hydration and **never enters `__NUXT__`**.
   - **Why that is load-bearing:** `ITableUserView` carries **every other member's
     `mobile` and `email`**. The roster is not names and avatars; it is a contact
     list. One awaited `fetchUsers` in the thread page's `setup` body puts all of it
     into the SSR payload, inlined into the HTML any reader — including one who is
     merely logged in and never opens this table — can read.
   - **The rule:** the thread's setup body must not resolve the roster server-side. If
     a future wave genuinely needs names in the first paint, the fix is to **project
     the roster down to `userId` / `fullName` / `avatar` at the store's read boundary**
     (`fetchUsers` maps `ITableUserView[]` into `Record<userId, {fullName, avatar}>`)
     so `mobile` and `email` never enter the payload — not to render them, and not to
     rely on a component not asking for them. `fullName` and `avatar` are the only
     roster fields any screen may read or render.
