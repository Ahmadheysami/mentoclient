# Café Messaging — Phase 2 Architecture Decision Record

Status: PROPOSED (frontend-architect). Derived from `docs/X123ApiDocs.md` (the authoritative
wire contract), `app/stores/cafe.ts`, `app/types/cafe.ts`, `app/plugins/cafe-socket.client.ts`,
`app/pages/cafe/[cafeId]/table/[tableId].vue`, `app/components/Cafe/*` and `server/api/cafe/**`.

**Nothing in this document has been implemented.** It is a decision record; the ordered work
list at the end is what an implementing agent follows.

Verification for this wave is `npx vue-tsc --noEmit` plus reasoning against the wire contract
stated inline. This repo has **no test framework** (no vitest / playwright, no `test` script in
`package.json`), and none is proposed — adding one is out of scope.

---

## 1. Context

`app/pages/cafe/README.md` ended Phase 1 with the café module's six list screens working off
`useCafe()` and a `/cafe` socket that connects but carries nothing. Its "Continuing from here"
listed six follow-ups; this document covers **steps 1–4** (messages history, socket traffic,
`subscribe` / `left`, `GET /table/:tableId/users`) plus the operational messaging features the
product spec named: reports at two levels, `seen` receipts, like toggle, send, edit, delete, and
manager-only affordances.

What exists today, and what each phase-2 piece must extend rather than recreate:

| Layer | File | What it already does | What phase 2 adds |
|---|---|---|---|
| Screen | `app/pages/cafe/[cafeId]/table/[tableId].vue` | one `fetchTable`, membership band, secure-chat pin, gated composer drawn **disabled**, empty transcript | wires every gate to a real action; keeps every existing computed |
| Data | `app/stores/cafe.ts` (1283 lines) | 8 resources, `run()` / `reset()` / `generation`, `CafeResult<T>` | `messages` + `users` resources, a per-table thread cache, mutation actions, socket appliers |
| Contract | `app/types/cafe.ts` (943 lines) | nearly the whole messaging contract incl. socket shapes | thread row type, client-only absences, new reason codes, report-reason constant |
| Envelope | `app/utils/cafe-response.ts` | `isCafeSuccess`, `isCafeMessagesPayload`, `parseCafeFailure` | a reader for a **thrown** request (real HTTP 429) |
| Transport | `app/plugins/cafe-socket.client.ts` | ticket, `io()`, status, `provide` | `onCafeSocket` registration; `cafe:join-channels-page` once per **connection** — corrected, see §Post-implementation corrections |
| Proxies | `server/api/cafe/**` | 7 routes, all mirroring upstream paths | 8 more |

Three facts from the code shape the whole design and are worth stating before anything else:

1. `CafeMessageList` already takes `members?: Record<string, ITableUserView>` and the thread page
   passes **nothing**, so every incoming bubble currently renders an empty sender name. `users` is
   therefore not a nice-to-have; it is the difference between a readable thread and an anonymous one.
2. `CafeMessageBubble` and `CafeMessageList` **emit nothing** today. Every interaction this wave
   adds is a new event contract on those two files.
3. `CafeComposerShell` already emits `submit`, and the page deliberately does not bind it. That
   unbound emit is the exact seam phase 2 fills.

---

## 2. Wire contract facts this design depends on (with the traps)

Everything in this section is quoted from `docs/X123ApiDocs.md` and cross-checked against
`app/types/cafe.ts`. **Anything marked ⚠️ is a trap: getting it wrong produces a screen that looks
healthy and is wrong.**

### 2.1 Envelope

- ⚠️ **HTTP 200 is not success.** Every refusal is delivered as HTTP 200/201 with the real code in
  `statusCode`. Branch on `body.success` + `body.reason`. Explicit exceptions: real HTTP 429;
  several successes are HTTP 201; and `GET /table/:tableId/messages` success has **no `success`
  field** (presence of `messages` is the signal) while its refusal is
  `{messages:[], success:true, reason:"INFO_TABLE_NOT_FOUND"}`. `isCafeMessagesPayload()` exists
  for exactly this and `isTableNotFoundFailure()` names the refusal.
- ⚠️ **HTTP 429 REJECTS.** Rate limiters set a real status, so `ofetch` **throws**. The store's
  `readCafe()` catches and returns `null`, which today means a 429 on a message route would be
  reported to the reader as «اتصال اینترنت را بررسی کنید». §5.2 fixes this.

### 2.2 `GET /table/:cafeId/:tableId/single`

- `{ success, table (ONE OBJECT), subscribe (ONE arbitrary participant, NOT the reader), isManager }`.
- ⚠️ `subscribe` is not the reader's row and not the roster; `normalizeSubscribe()` wraps it in a
  1-element array. `GET /table/:cafeId/:tableId/single` can only ever carry a participant with
  `status:"active"` (the controller's `$lookup` `$match`es on it), so the page's existing
  `membership` computed collapses `left` / `mute` / `banned` into `"none"`. **`GET /table/:tableId/users`
  is the endpoint that carries a real roster** — an empty array there is **not** an error.
- ⚠️ `isManager` is **not filtered by the requesting user** (it is a `$lookup` on `targetId` alone,
  ignoring `userId` and `endAt`). It is a **UX gate, never an authorization gate.** The server still
  authorizes per user, so a wrong `isManager` shows a row that then refuses.
- ⚠️ `messageSecunce` (misspelled) is the latest allocated sequence and is what `seen` clamps against.
- `messageSendingEnabled` and `secureChat` are `{enabled, startAt, endAt}` with **ms epoch** bounds.
  ⚠️ The server **ignores `startAt`**; a window is closed when `enabled===false || (endAt && endAt<=now)`.
  The page's `isWindowOpen()` honours `startAt`, which is stricter than the server — a divergence
  that can only ever refuse *more*, never less, and is left as it is (it is the existing computed).

### 2.3 History — `GET /table/:tableId/messages?direction=new|old&cursor=<sequence>&loadAll=1`

- Output is **always ascending**, in both directions (`old` sorts desc then reverses).
- Default page **15**; `loadAll` → 500. `hasMore` and `nextCursor` come from the server — do not
  recompute them.
- ⚠️ **Omitting `cursor` starts from the reader's own `lastReadMessageId`, and the default
  `direction` is `old`.** So the documented "first load, no cursor" recipe can return a window that
  is *behind* the newest messages. §3.2 solves this with a catch-up that phase 2 needs anyway for
  reconnect; it is the single most important ambiguity to verify against the live backend.
- ⚠️ Inactive table → HTTP 201 with `{messages:[], success:true, reason:"INFO_TABLE_NOT_FOUND"}`.

### 2.4 Membership

- `POST /table/subscribe {tableId}` → 201. `ERR_USER_SUBSCRIBED` when already active (which is a
  *confirmation*, not a failure, for this client — §3.13). Re-subscribing after `left` reactivates.
- `POST /table/:tableId/left` → 201, soft (`status:"left"`, `leftAt`). Requires an **active**
  participant row, else 404.

### 2.5 Send / edit / delete — REST ONLY

- ⚠️ **There is no socket event for send, edit or delete.** `docs/X123ApiDocs.md` §10.3 says so
  explicitly. Realtime delivery to *others* is the server broadcast. Nothing in this design emits
  `cafe:table:send-message`.
- `POST /table/:tableId/messages` body is **strict**: at least one of `text` (≤2000), `file`
  (`{mainFile, thumbnailFile}`, http(s), ≤2048), `poll`; plus `reaplayToMessageId` (⚠️ misspelled).
  Unknown keys → `ERR_VALIDATION`.
- Success **201** with `{success, statusCode, message, data: <FULL MESSAGE>}` — and ⚠️
  **`data` carries `id`, `sequence`, `senderId`, `createdAt` and `status`.** This is the fact that
  makes optimistic sending tractable without waiting for any broadcast (§3.3).
- `status: "submitted-for-review"` when soft bad words matched (severity avg ≥ 6); an optional
  `report:{usedWordCount, censoredText}` rides along **only in that case**.
- Hard bad words → `400 ERR_MESSAGE_INSULT`. Blocked → `403 ERR_USER_BLOCK`. Rate limit → real
  **HTTP 429** with a minimal body `{success:false, reason:"ERR_TOO_MANY_REQUESTS"}` (no
  `statusCode`, no `message`).
- Edit: `PUT /table/messages/:tableId/:messageId {text}` → 200 `{data:{tableId,messageId,text}}`;
  appends `{text, editedAt}` to `messageEdited[]`.
- Delete: soft, `status:"deleted"`. Deletable statuses: `active`, `suspended`, `submitted-for-review`.

### 2.6 Socket

- Namespace `/cafe`, `websocket` only. Rooms: `cafe_<cafeId>_room`, `table_<tableId>_room`,
  `channels-page:<userId>`.
- Client emits: `cafe:join-room {roomId}`, `cafe:leave-room`, `cafe:table:join-room {roomId}`,
  `cafe:table:leave-room`, `cafe:join-channels-page`, `cafe:leave-chennels-page`
  (⚠️ `chennels`, two n's, intentional).
- Server → client (payload shapes are exact):

| Event | Payload | ⚠️ Note |
|---|---|---|
| `cafe:table:send-message:recieve` | live message + optional `report` | **no `sequence`** — §14.1 says the rest match the send-response `data`, so `senderId`/`createdAt` MAY arrive and ARE read (corrected) |
| `cafe:table:edit-message:response` | `{tableId,messageId,text}` | |
| `cafe:table:delete-message:response` | `{tableId,messageId}` | |
| `cafe:table:delete-message:bulk:response` | `string[]` | **a bare id array — no `tableId`** |
| `cafe:table:like-message` | `{tableId,messageId,liked,likeCount,likes,userId}` | full `likes` array |
| `cafe:table:change-message-status` | a **full message** | |
| `cafe:table:message-sending-status` | the **string** `"enabled"`/`"disabled"` | not a boolean, **no `tableId`** |
| `cafe:table:secure-chat-status` | the **string** `"enabled"`/`"disabled"` | not a boolean, **no `tableId`** |
| `cafe:table:join-new-user` / `:leave-new-user` | `{fullName,userId,isOnline,lastSeen,role}` | ⚠️ also delivered to **the reader themselves** |
| `cafe:table:receive-new-message` | a bare `tableId` **string** | `channels-page` room only |
| acks | `cafe:join-room:response`, `cafe:table:join-room:response`, `cafe:table:check-repetitive-username:response` | |
| `app:error` | `{statusCode,message,data,for,reason,code}` | |

- ⚠️ **Because three of those payloads carry no table id, room membership is the only thing that
  makes them unambiguous.** The invariant "this client is in **at most one** `table_<id>_room` at a
  time" is therefore load-bearing, not a nicety, and it gets exactly one owner (§3.4).
- ⚠️ Load-bearing spellings to reproduce verbatim: `messageSecunce`, `reaplayTo`,
  `reaplayToMessageId`, `thubmnail`, `privite`, `cafe:leave-chennels-page`,
  `cafe:table:send-message:recieve`.

### 2.7 `seen`, like, report, users

- `POST /table/messages/:tableId/seen {seen:<number>}` → 201. ⚠️ **must be a JSON number** (strings
  silently do not advance `lastReadSequence`); the server clamps down to `messageSecunce`. ⚠️ There
  is **no per-message read state anywhere on the wire** — one number per table. Anything a UI shows
  about "who has read what" has to be derived or invented; §3.6 derives only what is derivable.
- Like is a **single TOGGLE**; "dislike" is un-like. Response `{success, liked, likeCount, likes,
  messageId, message}`. ⚠️ **There are no reactions and no emoji endpoint at all** — `like[]` is one
  flat user-id list, not a map. §3.8 states this as a product answer, not an omission.
- `POST /table/create-report?report-for=message|table` body `{id, metadata}`. ⚠️ `id` is the
  **message `id`** or the **table `id`** respectively; for a table report that is the table's
  *internal* uniqid, not the `ch_`/`cv_`/`tb_` URL handle. ⚠️ `report-for=table` on a missing table
  is mislabelled `ERR_MESSAGE_NOT_FOUND` — map by request context, not by the string.
- `GET /table/:tableId/users` → `{success, users:[]}`. ⚠️ An empty array is **not** an error.
  The docs carry **no detail section** for this endpoint — only the menu row "use participant data
  from it" and the appendix line. `ITableUserView` in `app/types/cafe.ts` is the existing type for
  it; its field set is unverified against the backend and every field is optional for that reason.

### 2.8 Security caveat carried forward (not fixed here)

`server/api/cafe/socket-ticket.post.ts` echoes the `access-token` cookie to page JS as the socket
`auth` token. It is an acknowledged interim bridge (its own header, and the README, name the real
fix: a backend-minted short-lived ticket). Phase 2 must not make it worse: no new route returns a
credential, nothing logs the token, and `cafe-socket.client.ts` keeps the token inside the `io()`
options object where it already is.

⚠️ **`app/plugins/cafe-socket.client.ts:280` is `console.log(socket.value)` on the hot path.** A
`Socket` carries `socket.auth`, so that line prints the **access token** to the browser console —
and devtools is exactly where a screenshot gets taken. It must be deleted in this wave (§3.4).

---

## 3. Decisions

Each decision states the choice, the rejected alternative, and why.

### 3.1 Where messages + users live → **extend `app/stores/cafe.ts`**, with a per-table `threads` cache

**Decision.** All messaging state and every messaging request goes into the existing store. Two new
`CafeResource` keys (`messages`, `users`) are added, so `SENTENCES`, `CLEARED`, `generation`,
`loaded`, `pending`, `errors` and `scopes` all gain two entries. The message **array** is not a
single ref but a `Record<tableId, ICafeThread>` cache, plus one `activeThreadId: string | null` that
names the thread the socket writes into.

**Rejected: a sibling `app/stores/cafeTable.ts`.**

- The store's header states, in bold, that it is *"the only place a café request is made."* A second
  café store that makes café requests breaks a rule the file exists to enforce, and every later
  reader has to learn the exception.
- `CafeResource` is the key of `SENTENCES` / `CLEARED` / `generation`. Those are closures over `ref`s
  inside the store. A sibling store would either duplicate the whole machinery — exactly the
  "parallel mechanism" that must not be invented — or export it, which is worse.
- The per-table cache does **not** need its own file. `scopes` already proves a resource can be
  re-scoped per navigation (`"${cafe}|${handle}"`), so `messages` is scoped the same way.

**Rejected: keep `messages` as one flat ref and reset it on every table change.**

Rejected because the spec's "must survive navigation between two tables without cross-contamination"
is two requirements, and only a keyed cache satisfies both: cache-per-table **survives** going back
(no reload, which is what a reader returning to a conversation expects), and keying **isolates** the
two (no contamination). A single ref + reset satisfies isolation and throws away the cache.

**Rejected: mutations go through `run()`.** `run()` calls `CLEARED[resource]()` on a refusal. A
refused **like toggle** would therefore **empty the entire transcript** and replace it with the
refusal sentence. Mutation actions bypass `run()` entirely and return a `CafeResult` without
touching the `errors` record; the page toasts the sentence. Reads still use `run()`, so **no
existing bookkeeping changes behaviour** — the only edit is two more keys.

`activeThreadId` is not "UI state in a data store": it is the room/session identity the socket
handlers write against, and it has exactly one writer (`enterThread` / `leaveThread`, §3.4).

### 3.2 History paging state machine → store-owned, per thread, three entry points

**Decision.** The whole machine is `ICafeThread` (§4), driven by three actions:

| Trigger | Action | Query |
|---|---|---|
| screen open, thread not cached | `fetchMessages(tableId)` | `{direction:"old"}`, **no cursor** |
| reader reaches the top of the scroller | `fetchMessages(tableId, {direction:"old", cursor: thread.olderCursor})` | prepend |
| reconnect, or after a provisional live row | `catchUpMessages(tableId)` | `{direction:"new", cursor: thread.newerCursor}` loop |

- `olderCursor` / `newerCursor` are the **server's** `nextCursor` values, kept separately per
  direction. `hasOlder` / `hasNewer` are the server's `hasMore` per direction. **Never recomputed
  from `messages.length === 15`.**
- **Ordering is the server's.** Both directions arrive ascending, so merging is: index existing rows
  by `id`, overwrite with incoming, re-sort ascending by `sequence`, and place rows whose `sequence`
  is still `null` (provisional live rows, §3.3) at the end in arrival order. One re-sort per merge,
  bounded by the page size — the alternative (splice at an index) is where off-by-one bugs live.
- **Dedupe is by `id`, always.** `id` is the only field guaranteed on every shape: the REST 201
  `data`, the history projection, and the live broadcast all carry it.

⚠️ **The first load is followed by a catch-up, always.** Because omitting `cursor` starts from the
reader's `lastReadMessageId` and the default direction is `old`, the documented first-load recipe can
land behind the newest messages. `fetchMessages` with no cursor therefore schedules `catchUpMessages`
whenever the thread's newest known `sequence` is behind `table.messageSecunce`. If the backend turns
out to return the tail already, the catch-up answers `hasMore:false` on its first call and costs one
cheap request. **Either way the reader gets a correct window, and it is the same code path reconnect
needs.** ⚠️ Must be verified against the live backend (§13, blocker 1).

⚠️ **A catch-up with no rows yet sends no cursor.** With an empty thread there is no `newerCursor`, and
an empty first page plus `hasMore:false` must not be read as "there is nothing new". The fallback is
one `direction:"new"` call **without** a cursor, bounded by `CATCH_UP_MAX_ROUNDS = 20` so a backend
that never answers `hasMore:false` cannot spin.

**Idempotence.** `isFresh("messages", scope)` short-circuits **only** for the cursorless first load
(scope = the table id). A paged read always goes to the server — the held answer is a *page*, not a
thread, and serving it twice would drop the page the reader asked for.

**Rejected: page state in the thread page.** It would be re-created on every navigation between two
tables, it would need its own generation guard, and the socket appliers — which live in the store —
would have to call into a component. Rejected.

**Rejected: an infinite-scroll sentinel + `useInfiniteScroll`.** Tempting, but "load older" and
"load newer" pull in *opposite* directions from one scroll container, and a single sentinel at the
bottom cannot express both. `MessageList` emits `reach-start` / `reach-end` and the page dispatches;
explicit, and it also gives the auto-scroll-on-new-message rule somewhere to live (§3.11).

### 3.3 Sending → optimistic, reconciled by `id`, with the sequence coming from the REST 201

**Decision. Optimistic, and the REST answer — not the broadcast — is what completes the row.**

The decisive fact is §2.5: the 201's `data` carries `id`, `sequence`, `senderId`, `createdAt` and
`status`. So:

1. On submit the store inserts a row with **`id = "local:" + nonce`**, `senderId = myId`,
   `createdAt = Date.now()`, `sequence: null`, `sending: true`.
   ⚠️ The `local:` prefix is **load-bearing**: `:` is outside the backend's
   `/^[A-Za-z0-9_-]{4,64}$/`, so a local id can never collide with a wire id. A `local-` prefix
   would sit inside that charset and could in principle collide.
2. The 201 arrives. The store looks for a row with `id === data.id` **first**:
   - found → the reader's own broadcast beat the HTTP response. That row is **upgraded in place**
     (`senderId`, `sequence`, `createdAt`, `status`, `report` filled in, `sending:false`, `provisional:false`).
   - not found → the `local:` row is **replaced in place** by the persisted message.
   Either branch is one rule: *the persisted form always wins, matched by `id`.*
3. **A broadcast for a message the store did not send** is appended as a **provisional** row
   (`sequence: null`, `senderId: null`, `provisional: true`) and schedules a debounced
   `catchUpMessages`. The catch-up returns the persisted rows — with `sequence`, `senderId` and
   `createdAt` — and the merge fills them in by `id`.
   This is the answer to "how does a message get its `sequence`": **it gets it from a history read,
   always.** No path invents one, and the live broadcast is never trusted to carry it (§2.6).

**What happens if the broadcast never comes.** Nothing breaks for the reader's own message: step 2
already completed it from the REST answer, so the broadcast is redundant for us. For *someone else's*
message, the provisional row plus its catch-up is the whole path — the catch-up is what fills it in,
and it is the same routine reconnect uses. **If the REST answer never comes** (network drop),
`sendMessage` returns `{ok:false}`, the row is marked `failed: true` and keeps its text so the bubble
offers a retry; the row is never silently dropped, because a message the reader believes they sent
must never vanish without saying so.

**Soft moderation (`status:"submitted-for-review"`).** When the answer or the broadcast carries it,
the bubble renders:

- the **censored** body (`report.censoredText` when present, else `text`) — the server already
  censored it, so the client does not attempt its own word list;
- a caption under the bubble: **«پیام شما برای بررسی ارسال شد»**;
- and only when `report.usedWordCount > 0`, the count in the caption's own sentence
  («۲ واژه حساس شناسایی شد و پیام برای بررسی ارسال شد»), as an `sr-only` + `title` pair rather
  than a visible count of somebody's bad words. The count is a *fact about the message*, and
  rendering it as a headline is the tone the product does not want.
- `cafe:table:change-message-status` later replaces the row wholesale, so a `suspended` outcome shows
  «این پیام تعلیق شده است» and a later `active` one shows the body again.

**In-flight protection.**

- ⚠️ **The send rate limit is 30/60s per user.** A double-tap would spend two of those on one intent.
  The store holds `sendPending: boolean`, set before the request and cleared in a `finally`;
  `sendMessage` returns the held result immediately if it is already true. The page also binds
  `:disabled="composerEnabled && !sendPending"`. A latch, not a debounce: a debounce also delays a
  *deliberate* second message.
- `MESSAGE_TEXT_MAX = 2000` is declared **once** in the store, enforced there (a refusal, not a
  silent truncation), passed to `ComposerShell` as `maxlength` so the field cannot reach it, and
  **re-checked in the Nitro route** (a client-side cap is a UX affordance, not a boundary).
- What the UI shows while in flight: the bubble at `opacity-70` with a `sending` flag, and the
  composer keeps focus. Never a spinner over the whole thread.

**Rejected: server-first (no optimistic row).** Rejected on UX: on a phone the 201 routinely lands
200–600 ms later, and a composer that clears with nothing appearing reads as a dropped message.
**Rejected: optimistic with matching by `text` + `senderId`.** Rejected because the live broadcast
has **no `senderId`** (§2.6), so the only shared key is `id` — and `id` is not known until the 201
lands, which is exactly why step 2 looks in both places instead of guessing.

### 3.4 Socket wiring split → plugin = transport, one composable = listeners + room lifecycle, store = state

**Decision.** Three owners, three files, no overlap:

| Owner | File | Owns |
|---|---|---|
| Transport | `app/plugins/cafe-socket.client.ts` | ticket, `io()`, connection status, lifecycle bind/unbind, **and** `cafe:join-channels-page` once per **connection** (corrected — see §Post-implementation corrections) |
| Room lifecycle + listeners | **new** `app/composables/useCafeThreadSocket.ts` | enter/leave the table + café rooms, bind/unbind every `/cafe` listener, re-join + resync on every `(re)connect` |
| State | `app/stores/cafe.ts` | `apply*` methods that turn a payload into state; every request |

**The plugin gains exactly three things:**

1. ⚠️ **`console.log(socket.value)` at line 280 is deleted.** It prints a `Socket` whose `auth` holds
   the access token into the browser console. One line, and it is the single highest-severity finding
   in this document.
2. A registration hook, `provide: { onCafeSocket }`, where
   `onCafeSocket(handler: (socket: CafeSocket | null) => void): () => void` calls the handler with the
   current socket **immediately** and again whenever a new instance is built. **Why a hook and not
   "the composable calls `connectCafeSocket()`":** a terminal `io server disconnect` or a refused
   handshake makes the plugin build a *replacement* instance, and the old binding is gone with the old
   one. A composable that bound to the instance it got would be silently deaf after the first kick —
   which is the exact failure the README already records as unbuilt ("stays قطع اتصال until a full
   page reload"). The hook makes "every socket instance, including replacements" a one-line contract.
3. `cafe:join-channels-page` emitted **once per socket instance**, from the first successful
   `connect`. ⚠️ Not once per app session and not once per page: the room is derived server-side from
   `socket.data.userId`, and a replacement instance is a new session on the wire that has joined
   nothing. A module-scoped boolean in the plugin's scope is the whole implementation, and it means
   no screen has to remember to ask for unread badges.

**The composable owns the room lifecycle** (`useCafeThreadSocket(cafeId, tableId)`), instantiated
once by the thread page:

- `onMounted` → `enterTable()`: emit `cafe:join-room {roomId: cafeId}`,
  `cafe:table:join-room {roomId: tableId}`, then `catchUpMessages` + `fetchTable` refresh.
- `onBeforeUnmount` → `leaveTable()`: emit `cafe:table:leave-room`, `cafe:leave-room`, and
  `off()` every listener it attached. ⚠️ Because the store keeps the thread cache, unmounting does
  **not** clear messages — so no listener may outlive the page, and none may write into a thread that
  is no longer `activeThreadId`.
- On every `connect` (ordinary reconnect **and** a replacement instance) → the same `enterTable()`
  sequence, then the catch-up loop until `hasMore === false`, then `fetchTable` to resync
  `messageSendingEnabled` / `secureChat` / `messageSecunce` / `isManager`.
- ⚠️ **The table room is bound to the resolved internal table id, not the URL handle.** The page
  already has `currentTable.value?.id` after `fetchTable`; joining with the `ch_` handle would put the
  client in a room that never receives anything (`app/types/cafe.ts` rule 3).
- ⚠️ **Watcher on the route pair**: vue-router reuses the component instance when only params change,
  so `onMounted`/`onBeforeUnmount` do **not** re-run for `/cafe/A/table/X → /cafe/A/table/Y`. The
  composable takes the ids as refs and a `watch` on their pair does leave-then-enter. Without it, the
  second table would render under a room joined for the first — the same hazard the page's existing
  `watch` on `` `${cafeId}|${tableId}` `` already handles for `cafe.table`.

**Rejected: bind every listener in the plugin.** Rejected because the plugin is app-wide and knows
nothing about a table; it would need `useRoute()` and a table lookup to decide whether a message is
for the screen on top, and the channels list (`/cafe/joined`) needs the badge events while the thread
needs the message events. **Rejected: put listeners in the store.** Rejected because a store has no
lifecycle and must not own `off()` calls; a listener that outlives its page is the leak rule 13 of
`AGENTS.md` forbids. **Rejected: a new Pinia store for the room.** Rejected — the room state is two
strings that live for one page.

`app/composables/` does not exist yet. Creating it with this one file is Nuxt's own convention (it is
auto-imported, so no ceremony) and creates no conflicting convention. ⚠️ One rule to state in the
file header: **the composable is client-only in effect** — it is only ever instantiated from a
page's `onMounted`, and it must not touch `useCafeSocket()` state during SSR.

### 3.5 Event → store mapping

See §8 for the full table. The guards that are not obvious:

- `join-new-user` / `leave-new-user`: ⚠️ **ignore `userId === myId`** — the server also delivers the
  reader's own join to the reader.
- `delete-message:bulk:response`: ⚠️ a **bare `string[]`** with no `tableId`; it is applied to the
  **active** thread, which is correct precisely because of the one-table-room invariant (§2.6).
- `message-sending-status` / `secure-chat-status`: ⚠️ plain strings, no table id; applied as an
  **override on the active thread** (`sendingOverride` / `secureOverride`), not by mutating the REST
  `table` row — `null` means "follow the payload".
- `send-message:recieve`: if `roomId` is present and does not equal the active thread's table id,
  drop it. `roomId` is optional on this payload, so a missing one is **accepted** (it is a room
  broadcast, and we are in exactly one table room).
- `like-message`: ⚠️ `userId === myId` is our own echo — it is still applied, because the payload
  carries the **authoritative** `likes` array and applying it can only correct our optimistic guess.
  "Skip the echo" in the docs means *skip the REST response you already applied*, which this design
  handles by ordering, not by dropping (§3.7).
- `receive-new-message`: a bare table id on the channels room. Not for the thread; it bumps
  `cafe.joined` (or marks the row stale) and is **ignored** when the table is the one on screen.

### 3.6 Read receipts (`seen`) → one throttled number, and **no per-message receipt UI**

**Decision.**

- `markSeen(tableId, sequence)` posts `{seen: <number>}` — ⚠️ **as a JSON number**, never a string
  (§2.7), clamped down to `table.messageSecunce` client-side as well, so a stale local maximum
  cannot even be attempted.
- **Throttled, not debounced.** A debounce starves under continuous scrolling; a trailing throttle
  of `SEEN_THROTTLE_MS = 1500` with a leading call fires immediately when the reader is already at
  the bottom (the common case) and at most once every 1.5 s otherwise.
- Triggers: (a) after the first page of a thread lands, (b) `MessageList`'s `reach-end`,
  (c) a live row arriving while the scroller is already at the end.
- **Never re-sends a number it has already sent**: `thread.lastSeenSent` is the high-water mark, and
  a lower or equal `sequence` returns without a request. This is the whole reason the throttle is
  backed by a high-water mark rather than being the only guard.
- ⚠️ **`import.meta.client` guard.** The store runs during SSR (the page awaits `fetchTable` in the
  setup body), and a POST that fires on the server is a mutation fired by a page *view*. Legal only
  in an event handler or behind an `onMounted` ref (`AGENTS.md` §3); `markSeen` returns early
  otherwise.

⚠️ **What is deliberately NOT built: any "seen" tick on a bubble.** The wire carries exactly one
number per table per user. Consequences, stated so the absence is a decision and not an omission:

- **Who else has read what is not derivable.** `GET /table/:tableId/users` returns *user* documents,
  not participant records, so it carries no `lastReadSequence`. There is no `view` increment documented
  anywhere. So «دیده شد» on a bubble would be a fabricated claim about other people's reading, which
  is the exact class of lie `MessageList`'s header and the thread page's `append()` removal were
  about.
- **What IS derived, and is honest:** `thread.lastSeenSent` gives a client-side read frontier, used
  for one thing — a **«پیام‌های تازه» divider** in the transcript at `lastSeenSent + 1` for the current
  visit. It says "since you were here", which is a statement about this device and this session, and
  is labelled as such.
- The **verifiable** outcome of posting `seen` is the channels-list badge, which the store already
  computes (`unreadFor`). Posting `seen` is what makes it correct.

Per-message read receipts require a backend field. Listed in §14.

### 3.7 Like / dislike → one toggle action, optimistic, both answers authoritative

**Decision.**

- The toggle lives in the **store** (`toggleLike`), not the bubble. ⚠️ There is no "dislike" — the
  item in the menu reads **«برداشتن پسند»** (un-like) when `liked`, **«پسندیدن»** otherwise. The
  label says what the press will do; a row called «Dislike» on an endpoint that toggles would be
  wrong twice.
- **Optimistic:** flip `like` locally (add/remove `myId`) and record `pendingLikes[messageId] =
  previousLiked` before the request.
- ⚠️ **While `pendingLikes[messageId]` exists, a second press is ignored.** Two presses would invert
  twice and land on the original state, and the rate limit here is a global 500/60s — the cheapest
  possible way to burn it.
- **Both answers are authoritative and both are applied**, because both carry the full `likes`
  array:
  - REST 201/200 → set `like` from `likes ?? []`, then clear the pending entry.
  - `cafe:table:like-message` → set `like` from `likes`, then clear the pending entry **only if**
    there is none (i.e. the REST answer has not landed); if there is one, the broadcast still writes
    `like` but the entry is left for the REST answer to clear.
  The outcome does not depend on which arrives first — both write the same authoritative array, and
  the pending entry exists only to render the gap between the tap and the first answer.
- **Rendering.** `MessageList` resolves `liked` and `likeCount` (same doctrine as `own` and
  `senderName`: identity and roster questions are answered once, at the list) and passes two plain
  props. `MessageBubble` draws a row under the bubble **only when `likeCount > 0 || liked`** — a
  heart on every bubble is noise; the tap target is the menu row, plus the counter itself when it is
  there. Pressing the counter toggles, so the affordance is reachable without the long-press.

**Rejected: a separate `/unlike` endpoint.** It does not exist.
**Rejected: faking reactions out of `like[]`.** Impossible — it is one flat array of userIds with no
key to attach an emoji to. See §3.8.

### 3.8 Reactions → **not implementable.** The backend has no such capability

**Decision: emoji reactions are not built, and the like toggle is the supported alternative.**

This is a product answer, not a scheduling one. `app/types/cafe.ts`'s own header and
`docs/X123ApiDocs.md` §7 say it in the same words: *"⚠️ NOT SUPPORTED — no backend API exists for
per-emoji reactions… do not fake it with `like[]` (that is a single flat user-id list)."* There is
no endpoint, no socket event, and no field that could hold one. Building a reaction picker would mean
either inventing calls that 404 or overloading `like[]` into a fake shape the server would rewrite on
the next write — a lie in a data structure rather than in a label, which is strictly worse.

The context menu therefore offers a single sentiment action (like / un-like), and the docs'
"maybe Reactions" is answered plainly: **it needs a new endpoint plus a new broadcast event,
server-side, before any client can show it.**

### 3.9 Report (table + message) → one Nitro route, a bottom sheet, and a closed reason list

**Decision.**

**Nitro.** One new route, `server/api/cafe/table/report.post.ts`, because one upstream endpoint
serves both levels and one allowlist serves both levels:

- `?report-for=` is narrowed to `message | table` against a documented constant and **dropped** if
  unusable (never relayed);
- the body is **rebuilt field-by-field**: `{id, metadata}` only, `id` passed through `isResourceId`;
- ⚠️ `metadata` is **rebuilt from an allowlist** too: `{reason, note?, source?}` — `reason` from the
  closed reason list, `note` trimmed and capped at `NOTE_MAX = 500` with control characters stripped,
  `source` from a closed pair. **Never relayed.** §11.

Two routes were rejected: the query enum and the body differ by only one discriminator, so two files
would be two allowlists to keep in step for one upstream call.

**Client.**

- **Message-level:** the context menu (§10.1) → «گزارش پیام» → `CafeReportSheet` (§10.2).
- **Table-level:** a `⋯` in `ChatHeader`'s new `#actions` slot → `CafeTableMenu` → «گزارش این میز» →
  the **same** `CafeReportSheet` with a different reason list (a table is not spammed; a table is
  impersonated, unsafe, or should not exist).
- `id` for a table report is `currentTable.id` — the **internal** uniqid. ⚠️ Not the `ch_`/`cv_`/`tb_`
  URL handle; the stored report would name a document that does not exist.
- ⚠️ The `report-for=table` refusal is mislabelled `ERR_MESSAGE_NOT_FOUND`. The page maps by request
  context: for a table report that reason renders «این میز در دسترس نیست».

**Reasons come from one documented constant**, `CAFE_REPORT_REASONS` in `app/types/cafe.ts`, beside
`CAFE_SORTS` — the same arrangement as `GOAL_DOMAINS` in `app/types/goal.ts`, and the same reason
that `isCafeSort` sits beside `CafeSort`: the list is shown in a UI *and* is an allowlist on the
server, so a second copy would drift. Two lists (`MESSAGE_REPORT_REASONS`, `TABLE_REPORT_REASONS`),
one constant name for the pattern, one `CafeReportReason` value type.

### 3.10 Manager features → exactly edit + delete on every message, plus the composer bypass

**Decision.** Derived from **one** flag, `cafe.table.isManager`, which is already on the single-table
answer and already read by the page's existing `sendingOpen`.

`isManager === true` ⇒

1. the composer stays typable regardless of `messageSendingEnabled` — **already implemented**
   (`sendingOpen`), untouched;
2. **Edit** and **Delete** appear in the context menu for **every** message in the table, not only the
   reader's own (the page's existing `membership`/`myParticipant` computeds are not consulted for
   these two rows);
3. nothing else. See below.

For a non-manager the two rows keep the docs' narrower rules, which are ownership checks and belong
to the **list**, where `own` is already resolved:
`Edit` ⇔ `own && status === "active"`; `Delete` ⇔ `own`.

**Explicitly NOT built, because the documented contract has no endpoint for it:** kicking a member,
muting, banning, changing a role, pinning, granting or revoking access, editing the table, closing
the table, moderating the report queue. `POST /table/:tableId/create-access` and `POST /create-access`
appear in the docs §16 **as backend-operator instructions**, not as client features, and
`/cafe/management` today is a list. Each of those is a real product wish with no wire behind it;
inventing the calls would be the same failure as reactions. Listed in §14.

⚠️ **`isManager` is not per-reader.** The server's `$lookup` on `Cafe Access` reads no `userId` and no
`endAt`, so once any grant names that café or table, **every** reader viewing it sees
`isManager: true` (recorded already in `README.md` rule 5 and in `app/types/cafe.ts`). It is a **UX
gate**: a wrong row produces one refused request and a Persian sentence, never an unauthorized write.
The header of the code that reads it must say so.

### 3.11 Thread page → extend around the existing computeds; exactly one new argument

**Decision.** `membership`, `sendWindow`, `showComposer`, `composerEnabled`, `showComposer`,
`composerPlaceholder`, `windowState` and the `now` clock ref all stay **byte-identical in name,
meaning and body** — with one seam:

```ts
// NEW: one computed. Everything downstream is unchanged.
const sendingWindowSource = computed<ICafeWindow | undefined>(() => {
  const override = cafe.sendingOverride(tableId.value);        // "enabled" | "disabled" | null
  const window = currentTable.value?.messageSendingEnabled;

  if (override === null || window === undefined) return window;

  return { ...window, enabled: override === "enabled" };         // live event beats the payload
});
```

`sendWindow` then reads `windowState(now.value, sendingWindowSource.value)` and **nothing else on the
page changes**. The same two-line shape exists for `secureChat`. This is why §3.5 stores the window
statuses as an *override* on the thread rather than mutating `cafe.table`: mutating the REST answer
would make a re-read of `/single` unable to restore the truth, and the override makes the precedence
(live event > payload) explicit and testable in one place.

**⚠️ Why `sendingOpen` itself is not edited.** The user constraint says keep it. Keeping it *and*
honouring `cafe:table:message-sending-status` is only possible by changing the value it reads, which
is what `sendingWindowSource` does. Editing `sendingOpen`'s body instead would have had to duplicate
the window arithmetic in a second place — the exact drift the file's own comments about
`sendWindowNotice`/`composerPlaceholder` warn about.

Also on the page, and why:

- the local `messages` ref is **removed** and replaced by `cafe.threadMessages` (the thread cache);
- the `thread` template ref + `querySelector('[role="log"]')` scroll hack is **replaced** by
  `defineExpose({ scrollToEnd, atEnd })` on `CafeMessageList` and a template ref — reaching into the
  DOM by ARIA role was a stated workaround for the list exposing no handle, and the list now does;
- `scrollToBottom()` on mount is kept in spirit and re-issued **once more** after the first history
  page lands (the existing mount-time call happens while the list is still empty);
- the `stripDismissed` reset in the existing route watcher is **extended**, not replaced, to also
  `cafe.enterThread(newTableId)` / `cafe.leaveThread()`.

### 3.12 Scroll behaviour → the list emits, the page decides, auto-scroll only when already at the end

**Decision.** `MessageList` emits `reach-start`, `reach-end`, `load-older`, `load-newer` and
`jump-end`, and exposes `scrollToEnd()` / `atEnd()`.

- **Prepending older history must preserve the scroll position.** The rows above change height, so a
  naive `scrollTop` restore makes the thread jump. `MessageList` measures `scrollHeight` before the
  merge and restores the delta afterwards, on the next frame. This is the one piece of scroll
  arithmetic in the whole feature and it belongs in the component that owns the scroller.
- **Auto-scroll on a new row only when `atEnd()`** — otherwise a `jump-end` button appears. The page's
  existing comment ("yanking the reader to the bottom while they are reading something twenty messages
  up is the single most irritating thing a chat screen can do") is the rule, and it now has code.
- `role="log"` stays, and **no `aria-live` is added** — `MessageList`'s header already rejects it, and
  a long-press menu plus an inline editor add nothing that changes that.

### 3.13 `subscribe` / `left` → wired, with `ERR_USER_SUBSCRIBED` treated as success

**Decision.** `joinTable(tableId)` and `leaveTable(tableId)` in the store, bound to the thread page's
currently-`disabled` join button and leave control.

- ⚠️ **`ERR_USER_SUBSCRIBED` is a confirmation, not a failure.** It is what the endpoint answers when
  the reader is already active — which the client cannot reliably know (§2.2: `subscribe` on
  `/single` is not the reader's row). `joinTable` therefore maps it to `{ok:true}` and refreshes
  `fetchTable`. Treating it as a refusal would put «خطا» under a button that did exactly what the
  reader asked.
- After a join: `fetchTable` (membership + `isManager`), `enterTable` rooms, `fetchMessages`,
  `fetchUsers`, `fetchSubscribed` (the new table's badge).
- After a leave: emit `cafe:table:leave-room`, `leaveThread()`, **drop that thread's cache** (the
  reader gave up this conversation; a stale transcript for a table you left is exactly the
  "stale list under a fresh state" the store's own header warns about), and `fetchSubscribed`.
- ⚠️ The existing proxy `server/api/cafe/table/left.post.ts` takes the id in the **query** and keeps
  its traversal guard. **It is left exactly as it is.** Its header proposes moving it to
  `table/[tableId]/left.post.ts` "with the membership wave that is going to call the route" — but a
  rename of a published URL is not required by anything in this wave, and the `isResourceId` guard
  already closes the hole it was written for. Scope discipline wins; the move is a separate,
  two-line cleanup.

### 3.14 Context-menu / report / edit / delete UX

Designed in §10 in full, with the reasoning inline.

---

## 4. State shape

### 4.1 Types added to `app/types/cafe.ts`

```ts
/** The soft-moderation block that rides along with a sent / broadcast message. */
export interface ICafeMessageReport {
  usedWordCount?: number;
  censoredText?: string;
}

/**
 * One row of a thread as the client can actually hold it.
 *
 * ⚠️ IT IS NOT `ICafeTableMessage`, FOR THREE REASONS, AND NONE OF THEM IS COSMETIC:
 *  1. `sequence` is OPTIONAL — a live broadcast carries none (§2.6) and a row must exist before it
 *     does.
 *  2. `report` exists only on a send answer / broadcast, never on a history read.
 *  3. `localId` / `sending` / `failed` / `provisional` are CLIENT-ONLY and say whether a row has been
 *     persisted yet.
 *
 * ⚠️ IT LIVES HERE AND NOT IN THE STORE, so `MessageList` / `MessageBubble` can import it from the
 * same module they already import from — the components must not depend on a store to know the shape
 * of a row. (The store's `CafeSingleTableWire` is the mirror case: a WIRE normalisation the store
 * owns, for a field only the wire has.)
 */
export interface ICafeThreadMessage extends Omit<ICafeTableMessage, "sequence"> {
  sequence?: number | null;
  /** Client-only. Present while the row is a not-yet-answered send. */
  localId?: string;
  /** Client-only. The REST answer has not landed. */
  sending?: boolean;
  /** Client-only. The send was refused; the bubble offers a retry. */
  failed?: boolean;
  /** Client-only. A broadcast not yet reconciled by a history read. */
  provisional?: boolean;
  report?: ICafeMessageReport | null;
}
```

`CafeResource` gains `| "messages" | "users"`.
`CafeFailureReason` gains `ERR_TOO_MANY_REQUESTS`, `ERR_RATE_LIMIT`, `ERR_MESSAGE_INSULT`,
`ERR_USER_BLOCK`, `ERR_MESSAGE_SEND_LIMIT`, `ERR_SEND_MESSAGE_TABLE_NOT_FOUND`, `ERR_EDIT_MESSAGE`,
`ERR_EDIT_MESSAGE_NOT_FOUND`, `ERR_EDIT_MESSAGE_ERR_ACCESS`, `ERR_DELETE_MESSAGE`,
`ERR_DELETE_MESSAGE_ERR_ACCESS`, `ERR_REPORT_NOT_FOUND` — plus their entries in
`CAFE_FAILURE_REASONS`. ⚠️ **Without these, `parseCafeFailure` narrows every one of them to `null`
and the client cannot branch on the single most important one (`ERR_TOO_MANY_REQUESTS`, whose 429
body carries nothing else at all).**

⚠️ **`ICafeClientToServerEvents` loses three emits**: `cafe:table:send-message`,
`cafe:table:delete-message`, `cafe:table:edit-message`, plus the now-dead `ICafeSendMessagePayload`
and `ICafeEditMessagePayload`. The contract does not accept them (§2.5), and their presence in the
type is worse than absent: `socket.emit("cafe:table:send-message", …)` compiles today and would be
silently swallowed by the server. Removing them turns that into a **compile error**, which is the
point of typing both directions of a `Socket`. The REST body contract is added as
`ICafeSendMessageBody` / `ICafeEditMessageBody` (with `reaplayToMessageId` reproduced verbatim) so the
store's payload type comes from the same module.

New: `CafeReportTarget` already exists. Add `CafeReportSource = "context-menu" | "header-menu"`,
`CafeReportReason`, `CAFE_REPORT_REASONS: Record<CafeReportTarget, readonly CafeReportReason[]>`,
`isCafeReportTarget`, and the two Persian label records
(`CAFE_REPORT_REASON_LABELS`, `CAFE_REPORT_SOURCE_LABELS`) — labels in the types file beside the values,
which is where `CAFE_SORTS` and `GOAL_DOMAINS` put their companions.

### 4.2 Store state added to `app/stores/cafe.ts`

```ts
/** One table's transcript and everything needed to page it. Keyed by the table's INTERNAL id. */
export interface ICafeThread {
  /** Ascending, oldest first, deduped by `id`. */
  rows: ICafeThreadMessage[];
  /** `direction:"old"` cursor — the oldest `sequence` held. `null` before the first page. */
  olderCursor: number | null;
  /** `direction:"new"` cursor — the newest `sequence` held. `null` before the first page. */
  newerCursor: number | null;
  hasOlder: boolean;
  hasNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  /** The highest sequence POSTed to `/seen` this session. The high-water mark, not a value. */
  lastSeenSent: number;
  /** ⚠️ LIVE OVERRIDE of `messageSendingEnabled.enabled`; `null` = follow the `/single` payload. */
  sendingOverride: ICafeWindowBroadcast | null;
  /** ⚠️ Same for `secureChat`. */
  secureOverride: ICafeWindowBroadcast | null;
}

const threads = ref<Record<string, ICafeThread>>({});
/** The one thread the socket writes into. `null` off the thread screen. One writer only. */
const activeThreadId = ref<string | null>(null);
const users = ref<ITableUserView[]>([]);
/** `userId` → the presence the socket reported. Merged OVER the roster; never replaces it. */
const presence = ref<Record<string, ICafePresence>>({});
/** `messageId` → the `liked` state we guessed, while a toggle is in flight. */
const pendingLikes = ref<Record<string, boolean>>({});
/** One send at a time. The 30/60s rate limit is the reason. */
const sendPending = ref(false);
```

New `CafeResource` entries in `SENTENCES` (three Persian sentences each, refused / net / superseded),
`CLEARED` (`messages` → drop the active thread's rows; `users` → `[]`), `generation`, and the four
records. ⚠️ `CLEARED.messages` must be careful: it runs on a **read** refusal, so dropping the rows is
correct — but it must not drop `olderCursor` bookkeeping the reader would lose. Decision: `CLEARED`
clears `rows` and both cursors for the active thread, and `reset("messages")` additionally forgets the
whole thread entry. The `#action` retry of the empty state therefore starts from a clean thread.

Getters:

```ts
const thread = computed<ICafeThread | null>(...);            // the active thread or null
const threadMessages = computed<ICafeThreadMessage[]>(...);   // EMPTY_ROWS singleton when null
function memberFor(userId: string): ITableUserView | null;   // roster merged with presence
function isRead(sequence: number | null | undefined): boolean;
function sendingOverride(tableId: string): ICafeWindowBroadcast | null;
function secureOverride(tableId: string): ICafeWindowBroadcast | null;
```

⚠️ `EMPTY_ROWS` is a module-level frozen `[]`, returned by the computed when no thread is active, so
an absent thread does not allocate a new array identity on every read (which would re-render the
transcript on every tick of the page's 15-second clock).

---

## 5. Action signatures

All of them in `useCafe()`. Every one takes `useRequestFetch()` **synchronously on its first line**
(§1 rule 1) and returns a `CafeResult` — **no action throws, no action rejects** (§1 rule 3).

### 5.1 Reads — these use `run()`

```ts
/** ⚠️ The table's INTERNAL id, never the `ch_`/`cv_`/`tb_` URL handle. */
function enterThread(tableId: string): void;
function leaveThread(discard?: boolean): void;   // `true` after a leave: drop the cache

async function fetchMessages(
  tableId: string,
  query?: ICafeMessagesQuery,     // omitted = first page (cursorless); {direction:"old"} = older; {direction:"new"} = newer
): Promise<CafeResult<ICafeThreadMessage[]>>;

async function catchUpMessages(tableId: string): Promise<CafeResult<ICafeThreadMessage[]>>;

async function fetchUsers(tableId: string): Promise<CafeResult<ITableUserView[]>>;
```

### 5.2 Mutations — these **bypass `run()`** (§3.1) and never clear a list

```ts
/** Body rebuilt field-by-field; `reaplayToMessageId` verbatim. Inserts the optimistic row. */
async function sendMessage(
  tableId: string,
  payload: { text?: string; file?: {mainFile: string; thumbnailFile: string}; poll?: unknown; reaplayToMessageId?: string },
): Promise<CafeResult<ICafeThreadMessage>>;

async function editMessage(tableId: string, messageId: string, text: string): Promise<CafeResult<null>>;
async function deleteMessage(tableId: string, messageId: string): Promise<CafeResult<null>>;
async function toggleLike(tableId: string, messageId: string): Promise<CafeResult<ICafeLikeOutcome>>;
async function markSeen(tableId: string, sequence: number): Promise<CafeResult<null>>;   // ⚠️ import.meta.client only
async function reportTarget(input: {
  target: CafeReportTarget; id: string; reason: string; note?: string; source?: CafeReportSource;
}): Promise<CafeResult<null>>;

async function joinTable(tableId: string): Promise<CafeResult<null>>;   // ⚠️ ERR_USER_SUBSCRIBED ⇒ ok:true
async function leaveTableById(tableId: string): Promise<CafeResult<null>>;
```

⚠️ **`readCafe()` returns `null` for a thrown request, which is a refusal with no `reason` — and a
real HTTP 429 on a message route IS thrown.** So every mutation action uses a new helper pair in
`app/utils/cafe-response.ts`:

```ts
/** The parsed body of a REJECTED request, so a real HTTP 429 is not read as a dropped connection. */
export function readCafeThrown(error: unknown): unknown;
/** `parseCafeFailure` for a thrown request: reads `error.data` first, `error.status` as the fallback. */
export function cafeFailureFrom(error: unknown, fallback: string): CafeFailure;
```

and, for send / edit, the rate-limit sentence is passed as the fallback so a 429 reads as
«پیام‌ها را خیلی سریع فرستادید…» rather than as a network problem. ⚠️ The 429 body has **no
`statusCode` and no `message`**, so `refusalMessage` will fall through to the fallback — which is
exactly why the fallback has to be the right Persian sentence for that case.

### 5.3 Socket appliers — synchronous, never fetch, never throw

```ts
function applyLiveMessage(live: ICafeLiveMessage): void;          // + schedules a catch-up
function applyEditBroadcast(p: ICafeEditMessageBroadcast): void;
function applyDeleteBroadcast(p: ICafeMessageRefPayload): void;
function applyDeleteBulkBroadcast(ids: string[]): void;            // ⚠️ active thread only
function applyLikeBroadcast(p: ICafeLikeBroadcast): void;
function applyMessageStatusBroadcast(m: ICafeTableMessage): void;  // ⚠️ a FULL message
function applySendingStatus(status: ICafeWindowBroadcast): void;    // ⚠️ a STRING
function applySecureChatStatus(status: ICafeWindowBroadcast): void;// ⚠️ a STRING
function applyPresence(p: ICafePresenceBroadcast, online: boolean): void;
function applyUnreadBadge(tableId: string): void;
```

Each begins with the same two lines of self-defence: bail if there is no active thread, and bail if
`p.tableId` is present and does not match it.

---

## 6. Nitro route table

Eight new files under `server/api/cafe/`, each mirroring its upstream path and following the four
existing rules: validate every router param with `isResourceId`, rebuild the outbound body
field-by-field, never `throw` (the `catch` answers `connectionResponseError()`), and allowlist the
query.

| New file (our path) | Method | Upstream | Guarded / rebuilt |
|---|---|---|---|
| `table/[tableId]/messages.get.ts` | GET | `GET /cafe/table/:tableId/messages` | `tableId` via `isResourceId`; query allowlist `direction` (narrowed to `old\|new`), `cursor` (finite integer ≥ 0), `loadAll` (literal `"1"` only) |
| `table/[tableId]/messages.post.ts` | POST | `POST /cafe/table/:tableId/messages` | `tableId`; body rebuilt as `{text?, file?:{mainFile,thumbnailFile}, poll?, reaplayToMessageId?}` — every URL string scheme-checked and ≤2048, `text` ≤2000, unknown keys **dropped** |
| `table/[tableId]/users.get.ts` | GET | `GET /cafe/table/:tableId/users` | `tableId`; no query relayed |
| `table/messages/[tableId]/seen.post.ts` | POST | `POST /cafe/table/messages/:tableId/seen` | `tableId`; body rebuilt as `{seen}` where `seen` is a **finite number ≥ 0** — ⚠️ a string is refused here, because upstream does not cast it and silently does not advance |
| `table/messages/[tableId]/[messageId]/like.post.ts` | POST | `POST /cafe/table/messages/:tableId/:messageId/like` | both ids; **no body forwarded at all** |
| `table/messages/[tableId]/[messageId].put.ts` | PUT | `PUT /cafe/table/messages/:tableId/:messageId` | both ids; body rebuilt as `{text}` only, non-empty after trim, ≤2000 |
| `table/messages/[tableId]/[messageId].delete.ts` | DELETE | `DELETE /cafe/table/messages/:tableId/:messageId` | both ids; no body |
| `table/report.post.ts` | POST | `POST /cafe/table/create-report?report-for=…` | `report-for` narrowed to `message\|table` and **dropped** if unusable; body rebuilt as `{id, metadata}` with `id` via `isResourceId` and `metadata` rebuilt from the allowlist in §11 |

⚠️ **Upstream's own paths are inconsistent** — `/table/:tableId/messages` for the write but
`/table/messages/:tableId/seen` for the read receipt. Mirroring it exactly (rather than imposing our
own tidier order) means a reader can compare our route to the contract line by line with no mental
translation. That is worth more than the tidiness, and it matches what the existing proxies do.

**Not added, deliberately:** any `POST /table/:tableId/create-access`, `POST /create-access`, poll
vote, pin, or moderation-queue route. §14.

---

## 7. Socket lifecycle

```
                    ┌───────────────────────── app/plugin (transport, app-wide) ─────────────────────────┐
   plugin init ───▶ readTicket() ─▶ io(base + "/cafe", {transports:["websocket"], auth:{token}})
                          │                          │
                          │(no token)                ├─ connect      ─▶ cafeSocket.markConnected()
                          ▼                          │                  onCafeSocket handlers (current socket)
                  socket=null, disconnected           │                  + emit("cafe:join-channels-page")  ⚠️ ONCE PER INSTANCE
                                                     ├─ disconnect   ─▶ setStatus("disconnected")
                                                     ├─ connect_error─▶ setError(msg); releaseIfTerminal()
                                                     └─ io.reconnect_attempt ─▶ setStatus("connecting")
                                                                                              │
   ┌──────────────────────────────┴────────────────────────────── onCafeSocket fires for EVERY new instance ─────────────┐
   │                                                                                                                       │
   │   useCafeThreadSocket(cafeIdRef, tableIdRef)   ← owned by app/pages/cafe/[cafeId]/table/[tableId].vue                │
   │                                                                                                                       │
   │   onMounted ─▶ enter()                                     onEveryConnect ─▶ enter() (again, verbatim)                  │
   │   watch(cafeId|tableId) ─▶ leave(); enter()               onBeforeUnmount ─▶ leave() + off(ALL listeners)           │
   │                                                                                                                       │
   │   enter():  store.enterThread(internalId)                                                                            │
   │             emit "cafe:join-room"        {roomId: cafeId}                                                            │
   │             emit "cafe:table:join-room"  {roomId: tableId}      ⚠️ internal id, never the ch_/cv_/tb_ handle            │
   │             await store.catchUpMessages(tableId)   // loop until hasMore === false (max 20 rounds)                      │
   │             await store.fetchTable(cafeId, handle) // resync mse / secureChat / messageSecunce / isManager             │
   │                                                                                                                       │
   │   leave():  emit "cafe:table:leave-room"; emit "cafe:leave-room"                                                       │
   │             store.leaveThread()        // ⚠️ keeps the cache; a table you LEFT discards it (§3.13)                      │
   │                                                                                                                       │
   │   listeners (all `socket.on`, all removed by `leave`/scope dispose):                                                   │
   │     the 12 message/table/badge events of §8  +  app:error (one listener, sets cafeSocket.setError)                     │
   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Invariants this shape enforces:

1. **At most one `table_<id>_room` per client** — required, because three event payloads carry no
   table id (§2.6). `enter()` always follows a `leave()`, on mount, on a param change and on unmount.
2. **Every listener is attached and detached by the same owner.** No `on`-without-`off`, no
   `setInterval`/`addEventListener` outside a `useEventListener` (which disposes with scope).
3. **Every `(re)connect` re-runs the identical sequence.** A socket.io manager reuses one instance
   across ordinary drops, so the instance-level `connect` listener is enough for those; the
   `onCafeSocket` hook covers the replacement instance the plugin builds after a terminal kick — the
   case the README records as still broken.
4. **Resync is ordered**: rooms first (so nothing that arrives during the catch-up is missed), then
   catch-up to the tail, then `/single` for the flags. Reversing 2 and 3 would let a status broadcast
   be overwritten by a stale payload.
5. **The `channels-page` room is joined by the plugin on every `connect`, for every reader** — so the
   channels lists get unread badges without a screen asking for them, and a replacement instance
   rejoins automatically.

---

## 8. Event → store mapping table

| Server event | Store method | Guard / dedupe |
|---|---|---|
| `cafe:table:send-message:recieve` | `applyLiveMessage` → insert or upgrade by `id`, then a debounced `catchUpMessages` | drop if `roomId` present and ≠ active table. A row already holding that `id` is **upgraded, not re-appended**. An unresolved send's `localId` is re-pointed at the wire `id` so the later 201 finds it. Schedules the catch-up **only** for a row that is still `provisional` |
| `cafe:table:edit-message:response` | `applyEditBroadcast` | drop if `tableId` ≠ active. Unknown `messageId` → ignored (a row older than the window is not invented). Sets `text`; sets `wasEdited` via `messageEdited.length > 0` |
| `cafe:table:delete-message:response` | `applyDeleteBroadcast` | drop if `tableId` ≠ active. Unknown id → ignored. Sets `status:"deleted"` (a **tombstone**, not a removal — `MessageBubble` already draws that state) so the timeline keeps its shape |
| `cafe:table:delete-message:bulk:response` | `applyDeleteBulkBroadcast` | ⚠️ **no `tableId` in the payload** — applied to the ACTIVE thread, which is correct only under invariant §7.1. Every id is tombstoned; unknown ids ignored |
| `cafe:table:like-message` | `applyLikeBroadcast` | drop if `tableId` ≠ active. ⚠️ `userId === myId` is **still applied** — the payload carries the authoritative `likes` array, so applying it can only correct our optimistic guess. Clears `pendingLikes[id]` only when there is none to clear |
| `cafe:table:change-message-status` | `applyMessageStatusBroadcast` | the payload is a **full message**: replaced wholesale by `id` inside the active thread. Keeps our client-only flags (`localId`, `sending`) when the ids match |
| `cafe:table:message-sending-status` | `applySendingStatus` | ⚠️ a plain **string**; `thread.sendingOverride = status === "enabled" ? "enabled" : "disabled"`. No table id, active thread only. Never mutates `cafe.table` |
| `cafe:table:secure-chat-status` | `applySecureChatStatus` | as above, `thread.secureOverride` |
| `cafe:table:join-new-user` | `applyPresence(p, true)` | ⚠️ **`p.userId === myId` → return.** A user absent from the roster is still recorded (the event carries `fullName`), because a nameless bubble is worse than a thinner roster |
| `cafe:table:leave-new-user` | `applyPresence(p, false)` | same guard |
| `cafe:table:receive-new-message` | `applyUnreadBadge` | ⚠️ a bare **table id string**, `channels-page` room. **Ignored when it names the table on screen** (the reader is looking at it). Otherwise bumps the badge in `cafe.joined` / marks it stale |
| `cafe:join-room:response`, `cafe:table:join-room:response` | — | `true` ack; nothing to do. Recorded so a reader debugging a silent thread knows the room join was accepted |
| `app:error` | `cafeSocket.setError(message)` | the badge's `title`/`sr-only` path already exists. ⚠️ **never** written into `errors.messages` — this fires for a refused operation, not a failed read, and blanking the transcript over it would be the `run()`/`CLEARED` mistake §3.1 avoids |
| `connect_error` | already bound in the plugin | unchanged |

---

## 9. Component changes

### 9.1 `app/components/Cafe/MessageList.vue` — the largest change

**New props:** `loading?: boolean` (drives a `USkeleton` column instead of the empty state),
`hasOlder?: boolean`, `loadingOlder?: boolean`, `hasNewer?: boolean`, `canReply?: boolean`,
`canEdit?: boolean`, `canDelete?: boolean`, `liked?: string[]` → *not a prop*; see below,
`editingId?: string | null`, `myTableType` → *no*.

Concretely: `loading`, `hasOlder`, `loadingOlder`, `hasNewer`, `canReply`, `canEdit`, `canDelete`,
`editingId`. `myId`, `now`, `members`, `messages` are unchanged.

⚠️ `canEdit` / `canDelete` / `canReply` are passed **pre-resolved by the page**, not computed here.
`MessageList` owns identity (`own`), the roster (`senderName`) and grouping; **permission is a page
decision**, because it needs `isManager` (a `single` payload) and the reader's membership (another
payload) — neither of which this component holds, and asking for them would put two API answers
inside a primitive.

**New emits:**

```ts
"load-older": [];          // reach-start, or the «پیام‌های قبلی» button
"load-newer": [];          // reach-end
"jump-end": [];            // the reader is scrolled up and something arrived
"reply":    [message: ICafeThreadMessage];
"like":     [message: ICafeThreadMessage];
"edit":     [message: ICafeThreadMessage];        // opens the inline editor
"edit-submit": [messageId: string, text: string];
"edit-cancel": [messageId: string];
"delete":   [message: ICafeThreadMessage];        // opens the confirm
"report":   [payload: { message: ICafeThreadMessage; reason: string; note?: string }];
```

**Behaviour added:**

- `ICafeThreadMessage` replaces `ICafeTableMessage` in `messages` and in `ThreadRow`.
- `liked` / `likeCount` are **resolved here** from `message.like` + `myId` (the file's own doctrine
  about `own`), and passed to the bubble as two plain props.
- The `reaplayTo` blockquote gains a **tappable affordance** (emits `reply`) — one tap to quote, which
  is the same action as the menu row, and it is already on screen.
- A **«پیام‌های تازه» divider** at `newMessagesFrom` (a new optional prop, the sequence from
  §3.6) — drawn only when the thread has a client-side read frontier from this visit.
- **Scroll-position preservation on prepend**: measure `scrollHeight` before, restore the delta after
  the next frame. ⚠️ Without it, loading older messages teleports the reader.
- `defineExpose({ scrollToEnd, atEnd })` for the page (§3.11).
- `role="log"` unchanged; **no `aria-live`** (the header already rejects it).
- Owns `CafeMessageMenu`, `CafeReportSheet` and `CafeConfirmDelete`, plus the inline edit state, so
  the thread page keeps composing exactly two things (`CafeMessageList`, `CafeComposerShell`).

### 9.2 `app/components/Cafe/MessageBubble.vue`

**New props:** `liked?: boolean`, `likeCount?: number`, `editing?: boolean`, `editDraft?: string`,
`sending?: boolean`, `failed?: boolean`, `censored?: boolean`, `pendingReview?: boolean`.
`ICafeTableMessage` → `ICafeThreadMessage` for `message`.

**New emits:** `toggle-like: []`, `update:editDraft: [value: string]`, `edit-submit: []`,
`edit-cancel: []`, `open-menu: [event: PointerEvent]`.

**Behaviour added:**

- The whole bubble becomes the long-press target: `onLongPress(el, …, {delay: 500,
  distanceThreshold: 12})` plus a native `@contextmenu` handler (§10.1). ⚠️
  `-webkit-touch-callout: none` + `touch-action: manipulation` so the OS callout does not fight the
  menu; `user-select: text` is **kept** so long-press text selection still works where the browser
  offers it.
- The like row, drawn only when `likeCount > 0 || liked`, with the count in Persian digits
  (`faNumber`, already used across this feature).
- The inline editor, replacing the body: a `UInput`/`UTextarea` pre-filled with `message.text`,
  «ذخیره» and «انصراف», `Ctrl/Cmd+Enter` to submit, Escape to cancel.
- A `sending` state at `opacity-70` with a `sr-only` «در حال ارسال», and a `failed` state with a
  «ارسال نشد · تلاش دوباره» affordance emitting a retry.
- `pendingReview` caption (§3.3) and `censored` styling — ⚠️ **the censored body comes from the
  server** (`report.censoredText`), never from a client word list.
- A `view`-style single tick for likes is **not** added (no field supports it, §3.6).

### 9.3 `app/components/Cafe/ChatHeader.vue`

**New:** one optional named slot `#actions`, rendered **after the identity block, before the video /
call buttons** (they must stay at the far inline-end — the header's own note about the FIRST child
is the mirror of this). Hosts `<CafeSocketStatusBadge />` and the `⋯` button.

**New props:** none. **New emits:** none. ⚠️ Deliberately: the report is a page concern (it needs the
table id and the store), and a `menu?: boolean` + `open-menu` emit would put a boolean flag for one
caller into a shared primitive.

### 9.4 `app/components/Cafe/ComposerShell.vue`

**New prop:** `maxlength?: number` → bound to `UInput`'s `maxlength` (default `undefined`, so the
caller decides).
**New emits:** `reply-cancel: []` — because the page renders the reply preview **above** this bar (it
is thread state: the quoted message), and the cancel control belongs beside it.
**Unchanged:** `submit` already exists and the page will now bind it; the Enter/`isComposing` guard
is already correct for Persian input.

### 9.5 New components

| File | Purpose |
|---|---|
| `app/components/Cafe/MessageMenu.vue` | the long-press / right-click sheet. Items, a11y and dismissal per §10.1 |
| `app/components/Cafe/ReportSheet.vue` | reason list + optional note + submit. Shared by the message and table paths |
| `app/components/Cafe/TableMenu.vue` | the `⋯` sheet: «گزارش این میز» and «خروج از میز» — the only two rows with an endpoint |
| `app/components/Cafe/ConfirmDelete.vue` | the delete confirmation, wrapping the existing `Ui/Alert` inside a `UModal` exactly as `app/components/Settings/ConfirmModal.vue` does |

None of them re-implements anything Nuxt UI provides: `USlideover side="bottom"` for the two sheets
(`AttachSheet`'s stated reason: a picker with no form is not a `UModal`), `UModal` for the confirm
(the house precedent for a form-shaped dialog).

### 9.6 `app/pages/cafe/[cafeId]/table/[tableId].vue`

Computed **additions** (nothing removed except the local `messages` ref and the scroll hack):
`sendingWindowSource`, `secureWindowSource`, `members`, `hasOlder`, `loadingOlder`, `hasNewer`,
`threadRows`, `newMessagesFrom`, `replyTarget`, `editingMessage`, `sendError`, `isManager`.

Refs added: `replyTarget`, `tableMenuOpen`, `reportOpen`, `deleteTarget`.
Handlers added: `submitMessage`, `sendReply`, `cancelReply`, `retrySend`, `onEditSubmit`,
`onDeleteConfirm`, `onReport`, `doJoin`, `doLeave`, `onLoadOlder`, `onLoadNewer`.
Refs wired: the `disabled` join button and the `disabled` leave control get their handlers (§3.13).
The `SocketStatusBadge` moves into `ChatHeader`'s `#actions` alongside the `⋯`.

---

## 10. UX specs

### 10.1 The message context menu

**Trigger, mobile-first.** Two paths to the same sheet:

- **Long press** — `onLongPress` (VueUse, already a dependency) at `delay: 500`,
  `distanceThreshold: 12` px, so a scroll gesture that starts on a bubble never opens it.
- **Right click / mouse** — a native `@contextmenu` handler that opens the same sheet and calls
  `preventDefault()`. ⚠️ **The two paths must not double-fire:** `onLongPress` fires on a mouse hold
  too, after 500 ms. Opening is idempotent (`open = true`) and both handlers set the same target, so
  a double-fire costs nothing — but the sheet must not `toggle`, or one long-press-then-release would
  open and immediately close it.
- **Keyboard**: the bubble carries a real focusable `⋯`-less affordance — the entire bubble is a
  `<button>`-role target? No. ⚠️ Wrapping every bubble in a button is wrong (it swallows text
  selection and adds a tab stop per message). Decision: `MessageList` renders **one** visually-hidden
  `<button>` per bubble («گزینه‌های پیام») that opens the same menu, and the visible long-press target
  is the bubble itself. So the menu is reachable by keyboard and by screen reader **without** making
  every bubble a control.

**Container.** `USlideover side="bottom"`, `role="menu"` on the container and `role="menuitem"` on
each row — the exact contract `CafeFabMenu.vue` already documents and implements, including its
honest note that arrow-key roving `tabindex` is *not* added without the handler that goes with it.
`aria-label` «گزینه‌های پیام». Max height `max-h-[70vh]` with `overflow-y-auto`, because the manager
row set is six items on a small phone.

**Dismissal** — all three, every one of them the `FabMenu` precedent:

1. outside **`pointerdown`** (not `click`), via `useEventListener(window, "pointerdown", …,
   {passive:true})` so the listener exists only while the sheet is open;
2. **Escape**, which also **returns focus to the bubble** that opened it;
3. choosing a row.

**Items, in this order** (RTL; logical utilities only, `start-`/`ps-`/`pe-`, never `left`/`right`):

| Row | Visible when | Does |
|---|---|---|
| «پاسخ» | `canReply` | emits `reply`; the page sets `replyTarget`, the composer preview appears above the bar |
| «رونوشت» | always, and only when `message.text` is non-empty | `useClipboard` (VueUse) + a toast «رونوشت شد» |
| «پسندیدن» / «برداشتن پسند» | always; the label **flips** on `liked` | emits `like` |
| «گزارش پیام» | always | opens `ReportSheet` |
| «ویرایش پیام» | `canEdit` | opens the inline editor on that bubble |
| «حذف پیام» | `canDelete` | opens the confirm |

`min-h-11` per row (44 px), `text-start` labels, `UIcon` at `aria-hidden` with a Persian
`aria-label` per row. ⚠️ No row is drawn `disabled` — a row that cannot act is not drawn, which is the
`FabMenu` rule and the reason this menu has no inert entries.

### 10.2 The report flow

**Sheet.** `USlideover side="bottom"`, title «گزارش پیام» (or «گزارش این میز»), one
`role="radiogroup"` of reasons, an optional `UTextarea` («توضیح (اختیاری)», `maxlength=500`,
`rows=3`), and a primary «ارسال گزارش».

- **Reasons from one constant** (§3.9). Message-level: توهین، آزار، مزاحمت/اسپم، محتوای نامناسب،
  جعل هویت، تبلیغ، مزاحم. Table-level: جعل هویت، محتوای نامناسب، ناامن بودن، محتوای تکراری.
  Each carries its own Persian label; the *value* is the machine token sent in `metadata.reason`.
- **The note is optional and never required** — a reader who does not want to write prose can report
  with one tap.
- **Submit states:** idle → sending (`UButton :loading`, sheet stays open so a refusal is readable) →
  success (`$toast.success("گزارش شما ثبت شد")`, sheet closes, `metadata.source` recorded) →
  refusal (`$toast.error(failure.message)`, **sheet stays open** and the message stays in the note,
  because losing a typed report on a 500 is the worst thing this flow could do).
- ⚠️ **No double-submit:** the button is `:loading` and `:disabled` while pending.
- ⚠️ **A table report's `id` is `table.id`** (the internal uniqid). Using the URL handle would file a
  report naming a document that does not exist, and the reader would be told «ثبت شد» about nothing.

**Where the table-level entry lives.** The `⋯` in `ChatHeader`'s `#actions` → `CafeTableMenu` →
«گزارش این میز». ⚠️ **The `⋯` is drawn only when at least one row in it can act** — and both of its
rows always can, so it is always drawn. It is placed *before* the call buttons so the call buttons
keep the far inline-end corner.

### 10.3 Edit

**Decision: inline, in the bubble — not the composer.**

- Choosing «ویرایش پیام» puts that bubble into edit mode: its body is replaced by a `UInput` with the
  current text, and two buttons — «ذخیره» (primary, `Enter` or `Ctrl/Cmd+Enter`) and «انصراف»
  (ghost, `Escape`). The editor **auto-focuses and selects the text**, because editing usually means
  changing one word.
- `text` is non-empty after trim and ≤2000 before submit; otherwise the same inline hint the composer
  uses, never a silent truncation.
- On save: `PUT` → `editMessage`; the 200's `{tableId,messageId,text}` plus the broadcast both
  converge on `applyEditBroadcast`, and `MessageBubble` draws «ویرایش شد» from
  `messageEdited.length > 0` (a field the history projection does carry).
- On refusal the editor **stays open with the reader's text intact** and the sentence appears under
  it. ⚠️ Closing on failure and losing the edit is the one outcome that must not happen.
- Only one message is editable at a time; opening a second closes the first.

**Rejected: reusing the composer.** Rejected because the composer's state is `draft + replyTarget`,
and folding "editing" into the same field would make one input mean two things, would have to decide
what happens to an in-flight reply preview, and would lose the quoted context the editor needs. The
bubble is where the text is; the editor belongs to it.

### 10.4 Delete

**Confirm, always, even for the reader's own message.** `UModal` → `Ui/Alert` →
`app/components/Settings/ConfirmModal.vue`'s exact composition, with title «حذف پیام» and description
«این پیام برای همیشه از این گفتگو حذف می‌شود.» — the backend is a **soft** delete (`status:"deleted"`),
so the copy says «برای همیشه» only in the sense the reader experiences, and the confirm exists because
the action is destructive and irreversible **for the reader** (there is no restore endpoint).

- «انصراف» (ghost) / «حذف» (error tone), `:loading` while pending, both disabled while pending.
- On success: the row is tombstoned locally (`status:"deleted"`), the confirm closes, a toast
  «پیام حذف شد». The bubble's existing deleted-state branch renders «این پیام حذف شده است».
- On refusal: the confirm **stays open** and toasts the sentence.
- ⚠️ The `delete-message:response` broadcast and the REST answer both converge on the same
  tombstone, so a manager deleting somebody else's message and that person's client agree without a
  refetch.

---

## 11. Security notes — a review of this design

1. **Body rebuilding (mass assignment).** Every write route rebuilds its body field-by-field and
   **drops unknown keys**; upstream's schemas are `.strict()`, so a relayed extra key becomes an
   `ERR_VALIDATION` — but the real hazard is the reverse: `subscribe`'s body could carry a `userId`
   and join somebody else's table (which is exactly why `subscribe.post.ts` sends one field). Send,
   edit, seen and report all follow that precedent. `like` and `delete` forward **no body at all**.
2. **`isResourceId` on every interpolated id.** All eight new routes validate each router param.
   h3 does not decode a router param, but the WHATWG URL parser ofetch uses still folds `..`, so the
   guard is the boundary — and it is the same guard `single.get.ts` and `left.post.ts` already use.
   `report`'s `report-for` is narrowed to a two-value enum and dropped when unusable, so it can never
   become an upstream path fragment.
3. **Query allowlists, never relay.** `messages.get.ts` forwards only `direction` (enum), `cursor`
   (finite integer ≥ 0) and `loadAll` (literal). Express's default `qs` turns `?cursor[$gt]=1` into a
   Mongo operator, so an un-allowlisted query is an injection, not a nuisance.
4. ⚠️ **`seen` must be a number.** The route refuses a non-finite `seen` outright rather than
   forwarding it: upstream does not cast and `$max` silently ignores a string, so a forwarded string is
   a read receipt that reports success and advances nothing.
5. **No token, OTP or cookie is logged, stored or returned.** The new routes never touch
   `socket-ticket.post.ts`, and `cafe-socket.client.ts`'s `console.log(socket.value)` is **deleted** —
   that line printed an object carrying `socket.auth`, i.e. the access token, to the console. Phase 2
   makes the interim bridge no worse: no new route returns a credential, and the token still only ever
   exists inside the `io()` options object.
6. ⚠️ **`metadata` is free-form user input landing in a moderation document.** Allowed: `reason`
   (closed enum), `note` (≤500 chars, trimmed, control characters stripped) and `source` (closed
   pair). **Not allowed: anything else** — in particular **not the message text** (the server already
   stores `originalText` from the message itself, so sending it duplicates it into an admin surface),
   **not the reporter's `userId`** (the server records it from the session), and not any key the
   server might later interpret. A moderation queue is an operator-facing surface; free-form input
   from an untrusted client belongs there at a bounded size and a fixed shape, or nowhere.
7. ⚠️ **The REST-only write rule is enforced by the type system, not by discipline.**
   `ICafeClientToServerEvents` loses its three phantom emits (§4.1), so `socket.emit("cafe:table:
   send-message")` becomes a **compile error**. This is the single most valuable change in the type
   file.
8. **`report`'s `id` is checked, not trusted.** It reaches an endpoint that stores a moderation
   document naming it. It is `isResourceId`-guarded on the proxy and taken from a row the client
   already holds — never typed by a reader — and for a table report it is the **internal** id.
9. **`isManager` gates UI only.** ⚠️ It is not per-reader on the backend (§3.10), so privileged rows
   may appear to a reader who does not hold the grant. Every privileged action is still authorized
   server-side, and the worst outcome of the mismatch is one `ERR_*_ERR_ACCESS` and a Persian
   sentence. **No client-side check is added that pretends to be an authorization boundary**, and the
   code that reads `isManager` says so in its header.
10. **`Connection: no-store` is not needed on the new routes** (they return no credential and are
    `POST`/`GET` of user data behind an `httpOnly` session cookie, exactly like the existing café
    proxies). Nothing here widens CORS.
11. **SSR.** Nothing in the new code runs a request during SSR except the reads the page already
    awaits. `markSeen`, the socket composable and the long-press listeners are all client-only, and
    `markSeen` carries an explicit `import.meta.client` guard because the store is instantiated on the
    server too.

---

## 12. Ordered work list

Each step depends only on the ones above it. Comments in the delivered code carry the same
⚠️ markers as this document.

**1 — `app/types/cafe.ts`** · the contract everything else is typed against
add `ICafeMessageReport`, `ICafeThreadMessage`; `CafeResource` += `messages|users`;
`CafeFailureReason` + `CAFE_FAILURE_REASONS` += the 12 messaging reasons;
add `CafeReportSource`, `CafeReportReason`, `CAFE_REPORT_REASONS`, `isCafeReportTarget`, the two label
records; add `ICafeSendMessageBody` / `ICafeEditMessageBody`; ⚠️ **delete**
`"cafe:table:send-message"`, `"cafe:table:delete-message"`, `"cafe:table:edit-message"` from
`ICafeClientToServerEvents` and their now-dead payload interfaces.

**2 — `app/utils/cafe-response.ts`** · the one envelope reader
add `readCafeThrown(error)` and `cafeFailureFrom(error, fallback)` so a **real HTTP 429** becomes
`ERR_TOO_MANY_REQUESTS` instead of `null`. Pure functions, no state, no clock — same contract as the
rest of the file.

**3 — the eight Nitro routes** · `server/api/cafe/table/…`
`[tableId]/messages.get.ts`, `[tableId]/messages.post.ts`, `[tableId]/users.get.ts`,
`messages/[tableId]/seen.post.ts`, `messages/[tableId]/[messageId]/like.post.ts`,
`messages/[tableId]/[messageId].put.ts`, `messages/[tableId]/[messageId].delete.ts`,
`report.post.ts`. Each with the four-rule header comment.

**4 — `app/stores/cafe.ts`** · state, then reads, then mutations, then appliers
`SENTENCES` + `CLEARED` + `generation` + the four records for `messages`/`users`; `ICafeThread` +
`threads` + `activeThreadId` + `users` + `presence` + `pendingLikes` + `sendPending`; the getters;
`enterThread` / `leaveThread` / `fetchMessages` / `catchUpMessages` / `fetchUsers` (via `run()`);
`sendMessage` / `editMessage` / `deleteMessage` / `toggleLike` / `markSeen` / `reportTarget` /
`joinTable` / `leaveTableById` (bypassing `run()`); the eight `apply*` appliers and the row-merge
helpers. ⚠️ Add the ⚠️ note to the store header stating that `messages`/`users` joined the resource
list and that mutations deliberately bypass `run()`.

**5 — `app/plugins/cafe-socket.client.ts`** · transport, three small changes
⚠️ delete `console.log(socket.value)` (line 280); add `provide.onCafeSocket`; emit
`cafe:join-channels-page` on **every** `connect` (a per-instance latch here was a defect — see
§Post-implementation corrections).

**6 — `app/composables/useCafeThreadSocket.ts`** (new) · room lifecycle + all listeners
`useCafeThreadSocket(cafeIdRef, tableIdRef)`, `onCafeSocket` subscription, `enter` / `leave`, the
param watcher, the catch-up + `/single` resync, `off()` of every listener. Header states the
one-table-room invariant and the client-only nature.

**7 — `app/components/Cafe/MessageList.vue`** · props, emits, menu/report/confirm ownership, scroll
maths, `defineExpose`.

**8 — `app/components/Cafe/MessageBubble.vue`** · props, emits, long-press + contextmenu, like row,
inline editor, sending/failed/moderation states.

**9 — `app/components/Cafe/MessageMenu.vue`, `ReportSheet.vue`, `TableMenu.vue`, `ConfirmDelete.vue`**
(new) · the four small surfaces of §10.

**10 — `app/components/Cafe/ChatHeader.vue`** · the `#actions` slot, in the right position.

**11 — `app/components/Cafe/ComposerShell.vue`** · `maxlength` prop + `reply-cancel` emit.

**12 — `app/pages/cafe/[cafeId]/table/[tableId].vue`** · `sendingWindowSource` +
`secureWindowSource`, drop the local `messages` ref and the scroll hack, all handlers, wire the join /
leave controls and the header `⋯`, extend the existing param watcher's reset to
`enterThread`/`leaveThread`.

**13 — `app/pages/cafe/README.md`** · rewrite "What is NOT built yet" (messaging, membership
mutations and the roster are now built; reactions, uploads, polls, per-message read receipts,
management actions and the terminal-reconnect gap are not), and rewrite "Continuing from here" so it
lists what is actually left.

**14 — verification** · `npx vue-tsc --noEmit`, then walk each ⚠️ in this document against the code.

---

## 13. Blockers and ambiguities to resolve before implementation

1. ⚠️ **BLANKER — what does the cursorless history read actually return?** The contract says omitting
   `cursor` starts from the reader's `lastReadMessageId` and the default `direction` is `old`. If
   that is literally true, the documented "first load, no cursor" recipe returns a window *behind* the
   newest messages, and a client that follows it alone renders a stale thread. §3.2 mitigates this
   without needing the answer (a catch-up always runs), but the mitigation should be **confirmed
   against the live backend** so it can be simplified if the backend already returns the tail.
2. ⚠️ **`GET /table/:tableId/users` has no detail section.** It appears only in the appendix and in a
   context-menu row. `ITableUserView`'s field set is a **guess from the types file**. It is needed for
   sender names on every bubble, so its real shape should be measured once — particularly whether
   `userId` and `fullName` are present and whether an empty array really means "not allowed to look".
3. ⚠️ **The live broadcast's `id` — is it the persisted message id?** `ICafeLiveMessage.id` is typed
   optional and the docs describe the payload as "the same fields as send-response `data`". §3.3's
   whole reconciliation (upgrade by `id`, catch-up by `id`) assumes it is. If the broadcast omits `id`,
   the upgrade path never fires and every message goes through the catch-up — slower but still correct,
   which is why the design survives the case, but it should be measured.
4. **Manager actions** are limited to edit + delete because nothing else is documented. If product
   expects kick / mute / ban / pin from this wave, that is a **backend gap** to be raised, not a
   client decision.
5. **Reactions** are a **backend gap** (§3.8): a new endpoint plus a broadcast event. Stated in the
   product terms so it is not re-litigated.
6. **Per-message read receipts** are a **backend gap** (§3.6): the wire carries one number per table
   and nothing that says who read what.
7. The **socket ticket** remains an interim bridge (§2.8). Out of scope; recorded so nothing in this
   wave widens it.

---

## 14. Explicitly out of scope

Named so that a later reader does not read each absence as an oversight, and so that none of them
gets "finished" the way `append()` was finished.

### 14.1 No endpoint exists — the backend gap, not a scheduling decision

- **Emoji reactions.** No endpoint, no broadcast, no field. `like[]` is one flat user-id list. §3.8.
- **Per-message read receipts.** The wire carries one `seen` number per table per user and nothing
  about who read what; `GET /table/:tableId/users` returns user documents, not participant records,
  so it has no `lastReadSequence` either. §3.6.
- **Poll voting.** The send body accepts `poll`; there is no vote endpoint and the history projection
  carries no per-option counts (`MessageBubble`'s poll parser already assumes `votes: null`).
- **Message management beyond edit/delete**: pin, pin-order, kick, mute, ban, role change, access
  grant/revoke, table close/edit, moderation-queue triage. §3.9 in §3.10's terms — each is a real
  product wish with nothing behind it on the wire.
- **Re-opening the socket after a terminal handshake refusal / server kick.** This wave makes the
  *instance replacement* work through `onCafeSocket` (§3.4), so the transport rebuilds itself; it does
  **not** refresh an expired access token, because this repo has no refresh token to renew one with
  (`app/stores/cafeSocket.ts`'s header says so). That remains the README's open gap.

### 14.2 Uploads and attachments

`AttachSheet` has no `select` handler and `VoiceRecorder` has no `MediaRecorder` behind it, and this
wave does not change either. `sendMessage`'s `file` branch is **typed and proxied** (the URL scheme
and length checks are in the Nitro route) so the contract is complete, but nothing in the app
produces a URL to hand it: there is no upload endpoint in the documented contract. The `+` and the mic
stay exactly as Phase 1 left them, drawing real UI that reaches no terminal action.

### 14.3 Admin / employer panel

No café surface is added to any panel. `isManager` is a gate on the **thread screen's** context menu
and nothing else. `/cafe/management` stays the list it is.

### 14.4 Housekeeping the wave deliberately does not do

- **No refactor of `cafe.ts`.** Two `CafeResource` keys are added; nothing existing is restructured,
  renamed or re-scoped. `run()` is **not** modified — the design sidesteps it instead (§3.1).
- **No move of `server/api/cafe/table/left.post.ts`** to a router-param path, even though its own
  header proposes it. §3.13.
- **No new npm dependency.** `onLongPress`, `useEventListener` and `useClipboard` all come from the
  `@vueuse/core` already installed; `USlideover` / `UModal` / `UTextarea` from Nuxt UI; `toast` from
  the `vue-sonner` plugin already in `plugins/sonner.client.ts`.
- **No test framework**, and no `test` script. Verification is `npx vue-tsc --noEmit` plus the
  reasoning recorded inline, exactly as this repository already works.
- **No change to the socket-ticket bridge** beyond deleting the `console.log`. §11.5.


---

## Post-implementation corrections

This document is the *design* record. Three of its decisions were **overturned by
code review against `docs/X123ApiDocs.md`, which governs**. Read these before
implementing anything from the sections above.

1. **`cafe:join-channels-page` is emitted on EVERY `connect`, not once per instance.**
   The per-instance latch was a silent defect: socket.io reuses the client-side
   instance across a drop, but the **server-side** socket is new and holds no rooms.
   After any ordinary reconnect the client silently lost `channels-page:<userId>` and
   every unread badge froze for the rest of the session while still reading «متصل».
   §19.6 lists this emit with the other two as a reconnect re-emit; §10.3 gives it no
   ack and no side effect beyond joining the room, so repeating it is safe.
2. **The live message DOES carry `senderId` / `createdAt`.** §14.1 says "full message
   object, same fields as the send-response `data`". The row above claimed otherwise.
   They are now declared optional on `ICafeLiveMessage` and read when present, so a live
   bubble is named and timestamped at once. **`sequence` is still never read or added** —
   it would sit inside both the `newestSequence` window the catch-up pages from and the
   value posted to `/seen`, so the catch-up must own it alone.
3. **A refusal never clears a transcript.** `CLEARED.messages` resets no rows and no
   cursors; `CLEARED.users` is a no-op. A throttled «پیام‌های قدیمی‌تر» tap used to delete the whole
   conversation and then render a **false** «هنوز پیامی در این گفتگو نیست» empty state with no
   explanation, because no screen reads `errors.messages`. `catchUpMessages` already
   worked this way; the paged path did not.
