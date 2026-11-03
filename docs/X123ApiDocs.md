# NEWTASK.md — Cafe Client Integration Guide (API + Realtime)

> **Audience:** Frontend agents / client developers implementing the Cafe module.
> **Language of this doc:** English (all user-facing content in the app is Persian).
> **Base URL:** all HTTP paths below are relative to the server origin and already include the `/.api/cafe` prefix unless noted.
> **Stack:** Express + TypeScript + MongoDB (Mongoose) + Redis + Socket.io + BullMQ. Timezone: Asia/Tehran (UTC+3:30).

This document covers **every wire contract** the client needs for these features:

1. Get table content (single table)
2. Join table (subscribe)
3. Leave table
4. Create reports (two levels: **table** and **message** — including the right-click context menu)
5. Seen / read receipts (mark-as-read)
6. Like / dislike (toggle)
7. Socket.io connection (realtime)
8. Send message (gated by `messageSendingEnabled`; managers get everything)
9. Edit message (manager / owner rules)
10. Delete message (manager / owner rules)
11. Full realtime sync catalog (every `server → client` event you must handle)

**Read the "Quirks & traps" section before writing any client code.** Several field names and event names contain intentional server-side typos that exist on the wire — they must be used verbatim.

---

## Table of contents

1. [Transport conventions](#1-transport-conventions)
2. [Authentication](#2-authentication)
3. [Error envelope & reason codes](#3-error-envelope--reason-codes)
4. [Feature 1 — Get table content](#4-feature-1--get-table-content)
5. [Feature 2 — Join table](#5-feature-2--join-table)
6. [Feature 3 — Leave table](#6-feature-3--leave-table)
7. [Feature 4 — Reports (table + message level, context menu)](#7-feature-4--reports-table--message-level)
8. [Feature 5 — Seen (mark as read)](#8-feature-5--seen-mark-as-read)
9. [Feature 6 — Like / dislike](#9-feature-6--like--dislike)
10. [Feature 7 — Socket.io connection](#10-feature-7--socketio-connection)
11. [Feature 8 — Send message](#11-feature-8--send-message)
12. [Feature 9 — Edit message](#12-feature-9--edit-message)
13. [Feature 10 — Delete message](#13-feature-10--delete-message)
14. [Feature 11 — Realtime sync catalog](#14-feature-11--realtime-sync-catalog)
15. [Message list pagination](#15-message-list-pagination)
16. [Permissions model (client-side feature gates)](#16-permissions-model-client-side-feature-gates)
17. [Reason code index (switch tables)](#17-reason-code-index-switch-tables)
18. [Quirks & traps (must-read)](#18-quirks--traps-must-read)
19. [Recommended client state-sync recipes](#19-recommended-client-state-sync-recipes)

---

## 1. Transport conventions

### 1.1 Required headers (every HTTP request)

| Header | Value | Notes |
|---|---|---|
| `X-Api-Key` | `<ACCESS_API_KEY>` | Missing/wrong → HTTP 403, `reason: "ERR_ACCESS_API_KEY"`. |
| `Authorization` | `Bearer <access-token>` | JWT access token. Server checks `payload.name === "access-token"`. |
| `Content-Type` | `application/json` | Required for requests with a body. |
| `Accept-Language` | `fa` \| `en` \| `ar` | Optional; defaults handled server-side. |
| `Accept-Language-Secret` | `<secret>` | Optional pairing for `Accept-Language`. |

### 1.2 Base paths

- Cafe HTTP API: `/.api/cafe/...` (all endpoints in this doc).
- Swagger UI (dev reference): `/.api/docs`.
- Socket.io namespace: `/cafe` (see [Feature 7](#10-feature-7--socketio-connection)).

### 1.3 Rate limits

| Scope | Limit | Behavior |
|---|---|---|
| Global (all routes) | 500 req / 60 s per IP+user | HTTP **429**, body: `{ success:false, message, statusCode:429, code:"ERROR", reason:"ERR_RATE_LIMIT", data:{} }` |
| `POST /table/:tableId/messages` (send) | 30 / 60 s per **user** | HTTP **429**, body: `{ success:false, reason:"ERR_TOO_MANY_REQUESTS" }` (no `statusCode`/`message` fields!) |
| `PUT /table/messages/:tableId/:messageId` (edit) | 30 / 60 s per user | Same 429 body as send. |
| `DELETE /table/messages/:tableId/:messageId` | 60 / 60 s per user | Same 429 body as send. |

**Client rule:** treat any 429 with `reason` absent as `ERR_TOO_MANY_REQUESTS` if the request was a message route, else `ERR_RATE_LIMIT`. Back off and retry with jitter.

### 1.4 HTTP status quirk (IMPORTANT)

The global error middleware does **not** set `res.status(...)`. Therefore **most errors are delivered as HTTP 200** with the error state encoded in the body:

```json
{
  "message": "...",
  "statusCode": 400,          // ← the REAL status the client should branch on
  "code": "ERROR",
  "data": [],
  "success": false,
  "reason": "ERR_TABLE_NOT_FOUND"
}
```

**Client rule: always branch on `body.statusCode` + `body.reason`, never on the HTTP status code** — except:
- HTTP 429 rate limiters (they DO set the real status).
- A few explicit success paths that return HTTP 201 (see each endpoint).

Success responses usually look like:

```json
{ "success": true, "message": "...", "statusCode": 200, ... }
```

Exception: `GET /table/:tableId/messages` success body has **no `success` field** (see [§15](#15-message-list-pagination)).

---

## 2. Authentication

### 2.1 HTTP

Include the access token (see §1.1). Token failures:

| Condition | `reason` | `statusCode` |
|---|---|---|
| Missing token | `ERR_TOKEN_UNDEFINED` | 401 |
| Malformed/invalid token | `ERR_TOKEN_INVALID` | 401 |
| User no longer exists | `ERR_LOGIN_USER_NOTFOUND` | 401 |
| Child session revoked | `ERR_CHILD_ACCESS_REVOKED` | 401 |

### 2.2 Socket

Pass the same access token via the Socket.io `auth` payload (see §10). Failure surfaces as the `connect_error` event with `data.reason` ∈ `ERR_AUTH_TOKEN_INVALID`, `ERR_AUTH_TOKEN_EXPIRED`, `ERR_LOGIN_USER_NOTFOUND`, `ERR_LANG_VERIFY`, `ERR_LANG_INVALID`.

---

## 3. Error envelope & reason codes

Every non-429 error follows the envelope in §1.4. Validation failures use:

```json
{
  "success": false,
  "code": "ERROR",
  "statusCode": 400,
  "reason": "ERR_VALIDATION",
  "message": "...",
  "data": {
    "errors": [
      { "code": "too_big", "message": "...", "path": "text" }
    ]
  }
}
```

> Note: `path` is a **scalar** string (the first path element), not an array.

Full reason-code index for client `switch` tables: [§17](#17-reason-code-index-switch-tables).

---

## 4. Feature 1 — Get table content

Fetch everything needed to render a table (chat) screen: table metadata, current user's participant record (best-effort), and the **manager** flag that unlocks all features.

### Endpoint

```
GET /.api/cafe/table/:cafeId/:tableId/single
```

| Param | Meaning |
|---|---|
| `cafeId` | Cafe document `id` (not Mongo `_id`). |
| `tableId` | Table document `id` (not the username/slug `tableId` field — use the `id` field). |

Route is gated to `roles: ['user']` (any logged-in user).

### Success response (HTTP 200)

```json
{
  "success": true,
  "table": {
    "id": "tbl_xxx",
    "cafeId": "cafe_xxx",
    "tableId": "my-room-slug",
    "nikname": "نام میز",
    "profileImage": "https://...",
    "status": "public",
    "tableType": "space",
    "enabled": true,
    "isActive": true,
    "free": true,
    "amount": 0,
    "star": 0,
    "messageSendingEnabled": { "enabled": true, "startAt": null, "endAt": null },
    "secureChat": { "enabled": false, "startAt": null, "endAt": null },
    "messageSecunce": 128,
    "lastMessage": { "text": "...", "sender": "...", "type": "text" },
    "currentSpeakerId": null,
    "speakers": [],
    "raiseHandQueue": [],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "subscribe": { "...participant doc or null..." },
  "isManager": false
}
```

- `table.status`: `"public" | "privite"` (typo is server-side; wire value is literally `privite`).
- `table.tableType`: `"bot" | "club-voice" | "space"`. **Only `"space"` tables accept chat messages.**
- `table.messageSecunce` (typo): monotonic message counter for the table — highest allocated sequence.
- `subscribe`: a `Cafe Table Participants` doc (`userId`, `role`, `status`, `lastReadSequence`, `lastReadAt`, `voiceStatus`, ...) — **but it is NOT filtered by the requesting user** (server bug). It is an arbitrary active participant (or `null` if the table has none after unwind). **Do not use `subscribe.userId` as "me".** Determine your own membership from `GET /table/subscribed` (does my list contain this `tableId`?) or your local store.
- `isManager`: `true` if **any** `Cafe Access` record targets this cafe or table (server does not filter by requesting user). Per product rules, the client treats `isManager === true` as **"enable ALL features for this user in this table"** — sending regardless of `messageSendingEnabled`, edit/delete on any message, manager UI. Server-side the real power comes from management roles or access records; the client gate is this flag.

### Errors

| `reason` | `statusCode` | When |
|---|---|---|
| `ERR_VALIDATION` | 400 | Params fail `entityIdSchema` (`/^[A-Za-z0-9_-]{4,64}$/`). |
| `ERR_CAFE_TABLE_NOT_FOUND` / `ERR_TABLE_NOT_FOUND` | 400 | No matching active table. |

### Client feature-gate recipe (after this fetch)

```
canSend   = isManager === true  ||  table.messageSendingEnabled.enabled === true (and window rules — see §11)
canEdit   = isManager === true  (normal users: only their own active messages — server still enforces)
canDelete = isManager === true  (same as edit)
canReport = any user
```

---

## 5. Feature 2 — Join table

Subscribe the current user to a table (creates/reactivates a participant record and adds them to the Redis member set used for notifications).

### Endpoint

```
POST /.api/cafe/table/subscribe
Content-Type: application/json

{ "tableId": "<table id>" }
```

- Body is **strict** (unknown keys rejected with `ERR_VALIDATION`).
- `tableId` must match `/^[A-Za-z0-9_-]{4,64}$/`.
- Optional manager path (management roles only): `POST /table/subscribe?u=<userId>` to subscribe another user. Normal clients omit `?u`.

### Success response

HTTP **201**:

```json
{ "success": true, "message": "...", "statusCode": 201 }
```

### Behavior notes

- Table must be `{ status: "public", isActive: true, enabled: true }`, otherwise `400 ERR_TABLE_SUBSCRIPTION_ID`.
- Already active → `400 ERR_USER_SUBSCRIBED`.
- Banned (`status: "banned"`) → `400 ERR_TABLE_BANNED`.
- Previously `left` → reactivated to `active` (no duplicate doc).
- Server also runs `SADD channel:<tableId>:members <userId>` in Redis (powers the `cafe:table:receive-new-message` badge event).

### After a successful join

1. Join the Socket.io room: emit `cafe:table:join-room` with `{ roomId: tableId }` (see §10).
2. Optionally also `cafe:join-room` `{ roomId: cafeId }` for cafe-level events.
3. Fetch the initial message window (see §15).
4. Refresh the channels list (`GET /table/subscribed`) so the new table appears with `unreadMessages`.

### Errors

| `reason` | `statusCode` |
|---|---|
| `ERR_VALIDATION` | 400 |
| `ERR_TABLE_SUBSCRIPTION_ID` | 400 |
| `ERR_USER_SUBSCRIBED` | 400 |
| `ERR_TABLE_BANNED` | 400 |
| `ERR_TABLE_NOT_FOUND` | 404 |

---

## 6. Feature 3 — Leave table

Mark the current user as `left` (soft — history is preserved and re-join is possible).

### Endpoint

```
POST /.api/cafe/table/:tableId/left
```

No body. `:tableId` must satisfy `entityIdSchema`.

### Success response

HTTP **201**:

```json
{ "success": true, "message": "...", "statusCode": 201 }
```

### Behavior notes

- Requires an **active** participant record; otherwise `404 ERR_TABLE_NOT_FOUND`.
- Sets `{ status: "left", leftAt }` and runs `SREM channel:<tableId>:members <userId>`.
- On success the client should: emit `cafe:table:leave-room` (socket), leave `cafe_<cafeId>_room` if desired, drop local message cache for the table, and remove it from the channels list.

### Errors

| `reason` | `statusCode` |
|---|---|
| `ERR_VALIDATION` | 400 |
| `ERR_TABLE_NOT_FOUND` | 404 (not an active member) |

---

## 7. Feature 4 — Reports (table + message level)

Two report levels share one endpoint, selected by the query `report-for`. Reports go into a moderation queue (`profanityReportModel`, `status: "pending"`) and are broadcast to an admin room in realtime.

### Endpoint

```
POST /.api/cafe/table/create-report?report-for=message   OR   ?report-for=table
Content-Type: application/json

{ "id": "<message id or table id>", "metadata": { ...optional... } }
```

- `report-for` (query) — required, enum: `message` | `table`. Missing/invalid → `ERR_VALIDATION`.
- `id` (body) — effectively **required**. For `report-for=message` it is the **message `id`**; for `report-for=table` it is the **table `id`**.
- `metadata` (body, optional) — free-form object stored on the report (e.g. `{ reason: "spam", note: "..." }`, reporter UI context, etc.).

### Message-level report (from right-click context menu)

```json
POST /.api/cafe/table/create-report?report-for=message
{ "id": "msg_xxx", "metadata": { "reason": "harassment" } }
```

Stored report (server-side): `{ messageId, originalText: <message.text>, word: [], badWordId: [], userId: <senderId>, contentType: "message", ipAddress, metadata, status: "pending" }`.

### Table-level report (from table menu / header)

```json
POST /.api/cafe/table/create-report?report-for=table
{ "id": "tbl_xxx", "metadata": { "reason": "impersonation" } }
```

Stored report: `{ messageId: <id>, originalText: "", userId: "", contentType: "chat", ipAddress, metadata: { table: {...}, ...body.metadata }, status: "pending" }`.

### Success response

HTTP **201**:

```json
{ "success": true, "message": "...", "statusCode": 201, "result": { ...saved report doc... } }
```

### Errors

| `reason` | `statusCode` | When |
|---|---|---|
| `ERR_VALIDATION` | 400 | Missing/invalid `report-for`. |
| `ERR_MESSAGE_NOT_FOUND` | 400 | `report-for=message` and `id` missing. |
| `ERR_TABLE_NOT_FOUND` | 400 | `report-for=table` and `id` missing. |
| `ERR_MESSAGE_NOT_FOUND` | 404 | `report-for=message` and message does not exist. |
| `ERR_MESSAGE_NOT_FOUND` (mislabeled) | 400 | `report-for=table` and table not found — **server bug**: reason says MESSAGE even for tables. Client should map this case using the request context (`report-for=table`) → "table not found". |

### Right-click context menu specification (client-only UI)

The context menu is a **frontend feature**; the backend provides the primitives below. Recommended menu items and their backing calls:

| Menu item | Visibility | Backing call |
|---|---|---|
| **Report** | Always | Open modal → `POST /table/create-report?report-for=message` with `{ id: messageId, metadata }`. |
| **Reply** | Always (if canSend) | Quote locally; on send include `reaplayToMessageId: messageId` (see §11). |
| **Copy text** | Always | Clipboard (client-only). |
| **Like / Dislike** | Always | `POST /table/messages/:tableId/:messageId/like` (toggle — see §9). |
| **Edit** | `isManager === true` OR message.senderId === me AND message.status === "active" | `PUT /table/messages/:tableId/:messageId` (see §12). Server additionally allows managers to edit ANY message. |
| **Delete** | `isManager === true` OR message.senderId === me | `DELETE /table/messages/:tableId/:messageId` (see §13). |
| **Reactions (emoji)** | ⚠️ **NOT SUPPORTED** | No backend API exists for per-emoji reactions. If product requires it, a **new endpoint + socket event must be added server-side**. Do not fake it with `like[]` (that is a single flat user-id list). |
| **View sender info** | Always | Use participant data from `GET /table/:tableId/users` or message `senderId` + user cache. |

Table-level report entry point: table header / ⋯ menu → modal → `POST /table/create-report?report-for=table`.

### Realtime side-effect (admin clients only)

Reports broadcast to the admin room `cafe_<RECIEVE_PROFANITY_SECRET>_room` (server-side secret room; normal users are never joined). Event: `cafe:table:recieve-bad-message:[admin,cafe]` with `{ report }`. Regular clients ignore this.

---

## 8. Feature 5 — Seen (mark as read)

Persist "I have read up to sequence N" for the current user in this table. Powers unread counts (`unreadMessages` on `GET /table/subscribed`) and read state.

### Endpoint

```
POST /.api/cafe/table/messages/:tableId/seen
Content-Type: application/json

{ "seen": 128 }
```

- `seen` — **must be a JSON number** (the table message `sequence` you have read up to). Strings are NOT cast; they silently fail to advance (`$max` ignores non-numeric values).
- Server clamps `seen` down to `table.messageSecunce` (you cannot mark beyond the table's latest allocated sequence).
- Missing `seen` → still returns 201 but is a **no-op** (except `lastReadAt` is touched). Always send the number.

### Success response

HTTP **201**:

```json
{ "success": true, "statusCode": 201 }
```

### Client recipe

- On open: after loading messages, `POST seen` with the highest sequence rendered.
- While scrolling: debounce (e.g. 1–2 s) and send the latest visible sequence.
- On receiving `cafe:table:send-message:recieve` while the table is the active screen: debounce-send the new max sequence.
- Locally keep `lastReadSequence` and compute `unread = table.messageSecunce - lastReadSequence` (server also computes `unreadMessages` on the subscribed list).

### Errors

No dedicated subscription check; validation errors → `ERR_VALIDATION` (400). Unknown table param still 201 if collection update matches nothing.

---

## 9. Feature 6 — Like / dislike

Single **toggle** endpoint. There is no separate dislike API — "disliking" is un-liking (toggle off). The `like[]` array stores userIds; `liked` tells the caller the new state for **this** user.

### Endpoint

```
POST /.api/cafe/table/messages/:tableId/:messageId/like
```

No body. `:tableId` and `:messageId` must satisfy `entityIdSchema`.

### Success response (HTTP 200)

```json
{
  "success": true,
  "statusCode": 200,
  "liked": true,
  "likeCount": 3,
  "likes": ["user_a", "user_b", "user_c"],
  "messageId": "msg_xxx",
  "message": { "...full updated message doc..." }
}
```

- `liked: true` = you are now in `likes`; `false` = you were removed.
- `likes` = full array of userIds.

### Realtime broadcast (all members of the room)

The server also emits to room `table_<tableId>_room`:

```json
Event:  "cafe:table:like-message"
Data:   { "tableId": "...", "messageId": "...", "liked": true, "likeCount": 3, "likes": ["..."], "userId": "<actor>" }
```

**Client rule:** update the UI from the REST response for the actor, and from the socket event for everyone else (dedupe: ignore the echo if `userId === me` and state already matches).

### Errors

| `reason` | `statusCode` |
|---|---|
| `ERR_MESSAGE_NOT_FOUND` | 404 |
| `ERR_DELETED_MESSAGE_NOT_FOUND` | 404 (message status `deleted`) |

---

## 10. Feature 7 — Socket.io connection

### 10.1 Connect

```js
import { io } from "socket.io-client";

const socket = io(`${SERVER_ORIGIN}/cafe`, {
  auth: { token: accessToken },
  extraHeaders: {
    "accept-language": "fa",
    "Accept-Language-Secret": langSecret
  },
  transports: ["websocket"] // recommended
});
```

- Namespace: **`/cafe`**.
- Redis adapter is used server-side (`@socket.io/redis-adapter`) so broadcasts reach all nodes.
- A separate `/notification` namespace exists for push-style notifications; this doc focuses on `/cafe`.

### 10.2 Connection lifecycle

| Moment | Server behavior |
|---|---|
| Success | `socket.data.userId` set; user marked `online`. |
| `disconnect` | User marked `offline`, `lastSeen` updated. |
| Failure | Client receives **`connect_error`** with `error.data = { message, statusCode, reason, success: false }`. |

`connect_error.data.reason` values:

| reason | Meaning |
|---|---|
| `ERR_AUTH_TOKEN_INVALID` | Missing or invalid token (also when token is absent). |
| `ERR_AUTH_TOKEN_EXPIRED` | Refresh the access token and reconnect. |
| `ERR_LOGIN_USER_NOTFOUND` | User deleted → log out. |
| `ERR_LANG_VERIFY` / `ERR_LANG_INVALID` | Language header/secret problem (400/403). |

### 10.3 Client → Server events (emit these)

| Event | Payload | Ack / response event | Notes |
|---|---|---|---|
| `cafe:table:check-repetitive-username` | `username: string` | `cafe:table:check-repetitive-username:response` → `boolean` (`true` = duplicate) | Table creation UI. |
| `cafe:join-room` | `{ roomId: cafeId }` | `cafe:join-room:response` → `true` | Joins `cafe_<cafeId>_room`. Stored as `socket.data.cafeRoom`. |
| `cafe:leave-room` | _(none)_ | — | Leaves the cafe room. |
| `cafe:table:join-room` | `{ roomId: tableId }` | `cafe:table:join-room:response` → `true` **and** room broadcast `cafe:table:join-new-user` | Joins `table_<tableId>_room`. **Required to receive send/edit/delete/like events.** |
| `cafe:table:leave-room` | _(none)_ | room broadcast `cafe:table:leave-new-user` | Leaves the current table room (`socket.data.tableRoom`). |
| `cafe:join-channels-page` | _(none)_ | — | Joins `channels-page:<userId>`. **Required to receive `cafe:table:receive-new-message` badges.** |
| `cafe:leave-chennels-page` | _(none)_ | — | ⚠️ Event name typo is intentional: `chennels` (double n). Emit exactly this string. |

> Message **send / edit / delete are NOT socket events** — they are REST-only (see §11–§13). Realtime delivery to other clients happens via server broadcasts.

### 10.4 Rooms (mental model)

| Room | Who joins | Purpose |
|---|---|---|
| `cafe_<cafeId>_room` | Clients emitting `cafe:join-room` | Cafe-level events. |
| `table_<tableId>_room` | Clients emitting `cafe:table:join-room` | Message send/edit/delete/like/status/mse events. |
| `channels-page:<userId>` | The user himself (`cafe:join-channels-page`) | Per-user unread badge / list refresh. |
| `cafe_<RECIEVE_PROFANITY_SECRET>_room` | Admin sockets only (server-side) | Moderation reports. Clients never join this themselves. |

### 10.5 Runtime errors

Server may emit **`app:error`** to the requesting socket:

```json
{
  "statusCode": 400,
  "message": "...",
  "data": [],
  "for": "<originating event name>",
  "reason": "ERR_VALIDATION",
  "code": "ERROR"
}
```

Validation variant: `reason: "ERR_VALIDATION"`, `for: "<event>"`, `data.error: [{ code, message, path }]` (`path` scalar).
Blocked-user variant: `statusCode: 403`, `reason: "ERR_USER_BLOCK"`, `for` set.

---

## 11. Feature 8 — Send message

REST-only. Realtime delivery to others is the `cafe:table:send-message:recieve` broadcast (see §14).

### Endpoint

```
POST /.api/cafe/table/:tableId/messages
Content-Type: application/json
```

### Body (strict — unknown keys rejected)

Provide **at least one** of `text`, `file`, `poll`:

```json
{
  "text": "سلام",                    // optional, max 2000 chars
  "file": {                          // optional
    "mainFile": "https://.../file.png",   // http(s) URL, max 2048
    "thumbnailFile": "https://.../thumb.png" // http(s) URL, max 2048
  },
  "poll": {                          // optional
    "title": "Question?",
    "description": "optional",
    "body": "optional",
    "options": [                     // 1..10 options
      { "title": "A", "description": "optional", "value": 1 }
    ]
  },
  "reaplayToMessageId": "msg_xxx"    // optional — REPLY; note the wire typo "reaplay"
}
```

Validation (zod, strict):

- `:tableId` and ids: `/^[A-Za-z0-9_-]{4,64}$/`.
- `text`: max 2000.
- URLs: must be `http`/`https`, max 2048.
- Unknown properties → `ERR_VALIDATION` (400).

### Success response (HTTP 201)

```json
{
  "success": true,
  "statusCode": 201,
  "message": "...",
  "data": {
    "id": "msg_xxx",
    "roomId": "tbl_xxx",
    "file": { "fileType": null, "thubmnail": null, "mainUrl": null },
    "reaplayTo": { "messageId": "msg_yyy", "textType": "text", "text": "...", "userId": "..." },
    "status": "active",
    "poll": null,
    "text": "سلام",
    "type": "text",
    "sequence": 129,
    "senderId": "user_me",
    "createdAt": "...",
    "report": { "usedWordCount": 1, "censoredText": "..." }   // optional, soft-moderated only
  }
}
```

- `type` is inferred server-side: image (`png|jpeg|webp`), audio (`mp3`), voice (`ogg`), else `file`; `poll` if poll provided; else `text`.
- `status`: `"active"` normally; `"submitted-for-review"` when the message contained soft bad words (severity avg ≥ 6) — the message is stored but held for moderation.
- `report` present only when general bad words matched (soft case).

### Access / gating rules (server-enforced; mirror in UI)

Table must be `{ tableType: "space", isActive: true, enabled: true }` with an active cafe → else `404 ERR_SEND_MESSAGE_TABLE_NOT_FOUND`.

Sending decision (`decideSendAccess`):

| Your standing | Allowed when |
|---|---|
| Cafe/table **manager** (owner, cafe admin, or cafe/table access record) | **Always** |
| **Cafe access** or **table access** record | **Always** |
| **Guest access** record | Only while the sending window is **OPEN** |
| **No access record** (plain member) | Only while the sending window is **CLOSED** (legacy server quirk — keep in mind when testing) |
| Other roles | `400 ERR_MESSAGE_SEND_LIMIT` |

"Sending window closed" (`isMessageSendingClosed`) = `messageSendingEnabled.enabled === false` **OR** (`endAt` set and `endAt <= now`). **`startAt` is ignored.**

Blocked users → `403 ERR_USER_BLOCK`.
Hard bad words (sexual / swear / profanity categories) → `400 ERR_MESSAGE_INSULT`.

### Client gating (product rules from the spec)

- Normal user: enable the composer **only if** `messageSendingEnabled.enabled === true` (and, for guest/manager nuances, per the table above). React to live toggles via `cafe:table:message-sending-status` (§14).
- `isManager === true` (from §4): **always** enable the composer regardless of `messageSendingEnabled`.

### Errors

| `reason` | `statusCode` |
|---|---|
| `ERR_VALIDATION` | 400 |
| `ERR_SEND_MESSAGE_TABLE_NOT_FOUND` | 404 |
| `ERR_MESSAGE_INSULT` | 400 |
| `ERR_USER_BLOCK` | 403 |
| `ERR_MESSAGE_SEND_LIMIT` | 400 |
| `ERR_TOO_MANY_REQUESTS` | **HTTP 429** (rate limit) |

### Optimistic UI

Insert a local placeholder keyed by a client-generated nonce; reconcile when:
1. The REST 201 returns `data.id`/`data.sequence`, and
2. The `cafe:table:send-message:recieve` broadcast arrives (may include `report` you must merge).

---

## 12. Feature 9 — Edit message

Product rule: **managers edit anything; normal users edit only their own messages** (server enforces the same ownership rules).

### Endpoint

```
PUT /.api/cafe/table/messages/:tableId/:messageId
Content-Type: application/json

{ "text": "new text" }
```

- `text`: required, non-empty, max 2000, strict body.

### Success response (HTTP 200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": { "tableId": "tbl_xxx", "messageId": "msg_xxx", "text": "new text" }
}
```

Server appends `{ text, editedAt }` to `messageEdited[]` and keeps `status`. Clients typically render an "edited" badge when `messageEdited.length > 0`.

### Realtime broadcast

Room `table_<tableId>_room`:

```json
Event: "cafe:table:edit-message:response"
Data:  { "tableId": "...", "messageId": "...", "text": "new text" }
```

### Access rules (server)

| Standing | Allowed target |
|---|---|
| Management (owner / cafe admin) or cafe/table access | **Any** active message |
| Guest access or no access | **Own** message only (`status: "active"`) |
| Other roles | `404 ERR_EDIT_MESSAGE` |

Message missing or not `active` → `404 ERR_EDIT_MESSAGE_NOT_FOUND`.
Bad words re-checked → `400 ERR_MESSAGE_INSULT`. Blocked → `403 ERR_USER_BLOCK`.
Lacking rights → `403 ERR_EDIT_MESSAGE_ERR_ACCESS`.

### Client visibility rule

Show **Edit** in the context menu when `isManager === true` OR (`message.senderId === me` AND `message.status === "active"`). Server remains the source of truth.

---

## 13. Feature 10 — Delete message

Soft delete: `status` becomes `"deleted"`. Product rule: **managers delete anything; normal users delete their own** (same ownership matrix as edit).

### Endpoint

```
DELETE /.api/cafe/table/messages/:tableId/:messageId
```

No body.

### Success response (HTTP 200)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": { "tableId": "tbl_xxx", "messageId": "msg_xxx" }
}
```

### Realtime broadcast

Room `table_<tableId>_room`:

```json
Event: "cafe:table:delete-message:response"
Data:  { "tableId": "...", "messageId": "..." }
```

Client should remove (or tombstone) the message from the list. Related: `cafe:table:delete-message:bulk:response` carries a **`string[]` of message ids** (batch deletes from secure-chat / MSE auto-disable jobs).

### Access rules (server)

Deletable statuses: `active`, `suspended`, `submitted-for-review`.
Not found / already deleted → `404 ERR_DELETED_MESSAGE_NOT_FOUND`.
Ownership: management/cafe/table access → any; guest/no-access → own only (`403 ERR_DELETE_MESSAGE_ERR_ACCESS`); other roles → `404 ERR_DELETE_MESSAGE`.

### Client visibility rule

Show **Delete** when `isManager === true` OR `message.senderId === me`.

---

## 14. Feature 11 — Realtime sync catalog

Every server→client event you must subscribe to on the `/cafe` namespace. **Payloads below are exact wire shapes.**

### 14.1 Messaging events (room: `table_<tableId>_room`)

| Event | Payload | Client action |
|---|---|---|
| `cafe:table:send-message:recieve` | Full message object (same fields as send-response `data`) + optional `report { usedWordCount, censoredText }` | Append message (or reconcile optimistic placeholder). If `status === "submitted-for-review"`, render pending/moderation state. If `report` present, render censored text. |
| `cafe:table:edit-message:response` | `{ tableId, messageId, text }` | Replace `text`, mark edited. |
| `cafe:table:delete-message:response` | `{ tableId, messageId }` | Remove/tombstone message. |
| `cafe:table:delete-message:bulk:response` | `string[]` (array of message ids) | Remove all listed messages. |
| `cafe:table:like-message` | `{ tableId, messageId, liked, likeCount, likes, userId }` | Update like UI. Skip if echo of your own REST action. |
| `cafe:table:change-message-status` | **Full message object** (moderation outcome: `active` / `suspended`) | Replace local message by `id`. If `suspended`, render moderated state. |

### 14.2 Table state events (room: `table_<tableId>_room`)

| Event | Payload | Client action |
|---|---|---|
| `cafe:table:message-sending-status` | **string** `"enabled"` \| `"disabled"` (NOT a boolean!) | Enable/disable composer for **normal** users. Managers (`isManager`) ignore this and stay enabled. |
| `cafe:table:secure-chat-status` | **string** `"enabled"` \| `"disabled"` | Toggle secure-chat UI/behavior. |
| `cafe:table:join-new-user` | `{ fullName, userId, isOnline, lastSeen, role }` | Add/update participant presence list; optional toast. |
| `cafe:table:leave-new-user` | `{ fullName, userId, isOnline, lastSeen, role }` | Update presence list. |

### 14.3 Per-user badge event (room: `channels-page:<userId>`)

| Event | Payload | Client action |
|---|---|---|
| `cafe:table:receive-new-message` | `tableId: string` (plain string, not an object) | Increment unread badge for that table / refresh channels list (`GET /table/subscribed`). Requires having emitted `cafe:join-channels-page`. Emitted asynchronously via a background job for each member of `channel:<tableId>:members`. |

### 14.4 Ack / response events

| Event | Payload |
|---|---|
| `cafe:join-room:response` | `true` |
| `cafe:table:join-room:response` | `true` |
| `cafe:table:check-repetitive-username:response` | `boolean` (`true` = username taken) |

### 14.5 Errors

| Event | Payload |
|---|---|
| `app:error` | `{ statusCode, message, data, for?, reason, code }`; validation adds `data.error: [{code,message,path}]`. |
| `connect_error` | `error.data = { message, statusCode, reason, success: false }` (see §10.2). |

### 14.6 Admin-only (ignore in normal clients)

- Room `cafe_<RECIEVE_PROFANITY_SECRET>_room`, event `cafe:table:recieve-bad-message:[admin,cafe]` — moderation reports (from sends with general bad words and from user-created reports).

### 14.7 Event-name typos (use verbatim)

| Wire name | Intended meaning |
|---|---|
| `cafe:table:send-message:recieve` | receive |
| `cafe:table:recieve-bad-message:[admin,cafe]` | receive |
| `cafe:leave-chennels-page` | channels |
| `reaplayTo` / `reaplayToMessageId` | replyTo |
| `messageSecunce` | messageSequence |
| `thubmnail` | thumbnail |

---

## 15. Message list pagination

### Endpoint

```
GET /.api/cafe/table/:tableId/messages?direction=new&cursor=<sequence>&loadAll=1
```

| Query | Values | Default / notes |
|---|---|---|
| `direction` | `new` \| `old` | `old` = history before cursor (server sorts desc, then reverses → ascending output). `new` = messages after cursor (ascending). |
| `cursor` | number (message `sequence`) | Omit on first load → server starts from **your participant's `lastReadMessageId` sequence**. |
| `loadAll` | any truthy value | Raises batch cap from 15 to **500**. |

Default page size: **15**. `hasMore` = `messages.length === limit`. `nextCursor` = last `sequence` in the page, or `null`.

### Success response (⚠️ no `success` field)

```json
{
  "messages": [ { "...message docs..." } ],
  "hasMore": true,
  "nextCursor": 120
}
```

Message doc (projected fields):

```json
{
  "id": "msg_xxx",
  "roomId": "tbl_xxx",
  "type": "text",
  "file": { "fileType": null, "thubmnail": null, "mainUrl": null },
  "text": "سلام",
  "reaplayTo": { "messageId": null, "textType": null, "text": null, "userId": null },
  "status": "active",
  "messageEdited": [],
  "poll": null,
  "senderId": "user_x",
  "like": ["user_a"],
  "view": 0,
  "sequence": 100,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Inactive table

HTTP **201** with:

```json
{ "messages": [], "success": true, "reason": "INFO_TABLE_NOT_FOUND" }
```

(Handle this as "table closed / not found" and exit the chat screen.)

### Client recipe

1. **First load:** `GET .../messages` with no cursor → render `messages` (ascending), `nextCursor`.
2. **Older history:** `direction=old&cursor=<oldest sequence>` → prepend.
3. **Newer (catch-up):** `direction=new&cursor=<newest sequence>` → append, until `hasMore === false`; then rely on socket events.
4. Filter out any message with `status === "deleted"` (should already be excluded server-side, but tombstones may arrive via delete events).

---

## 16. Permissions model (client-side feature gates)

Server-side, route access for normal users is determined by `Cafe Access` documents (`type ∈ cafe|table|guest`, `targetId`, `userId`, optional `endAt` expiry). Owners / cafe admins bypass. But the **client gate is simpler**:

```
isManager (from GET .../single) === true
  → ALL features: send (ignore messageSendingEnabled), edit ANY message, delete ANY message, manager UI.

isManager === false
  → send: only when messageSendingEnabled (see §11 window rules) — show composer accordingly
  → edit: own message only (context-menu visibility)
  → delete: own message only
  → like/unlike: yes
  → report (message/table): yes
  → seen: yes
```

Complementary live gates:

- `cafe:table:message-sending-status` (`"enabled"`/`"disabled"`) → flip composer for non-managers in real time.
- `cafe:table:secure-chat-status` → secure-chat mode toggle.
- `cafe:table:change-message-status` → moderated message state.
- Blocked users (`ERR_USER_BLOCK`) cannot send/edit.

Granting manager powers (for backend operators, not the client): `POST /table/:tableId/create-access` with `{ userId, accessTo: "cafe"|"table"|"guest" }`, or `POST /create-access` at the cafe level. Once an access record exists, `isManager` becomes `true` on the next `GET .../single` for **all** users viewing that table (known server quirk — the flag is global to the table, so gate privileged UI actions additionally on the local user's role where feasible; server still authorizes correctly per-user).

---

## 17. Reason code index (switch tables)

Use `reason` (string) as the key in client error handlers. Group by domain.

### Transport / auth

| reason | statusCode | Suggested client handling |
|---|---|---|
| `ERR_ACCESS_API_KEY` | 403 | Fatal config error; show generic failure. |
| `ERR_ACCESS_DENIED` | 403 | Not allowed for this route; `data` lists denied labels. |
| `ERR_TOKEN_UNDEFINED` | 401 | Not logged in → login flow. |
| `ERR_TOKEN_INVALID` | 401 | Refresh token / re-login. |
| `ERR_LOGIN_USER_NOTFOUND` | 401 | Log out. |
| `ERR_CHILD_ACCESS_REVOKED` | 401 | Log out / switch account. |
| `ERR_LANG_VERIFIY` (typo) | 400 | Missing language secret. |
| `ERR_LANG_INVALID` | 400 | Bad language value. |
| `ERR_LANG_VERIFY` | 403 | Bad language secret. |
| `ERR_VALIDATION` | 400 | Map `data.errors[]` → field errors (`path` is scalar). |
| `ERR_RATE_LIMIT` | HTTP 429 | Global rate limit → backoff. |
| `ERR_TOO_MANY_REQUESTS` | HTTP 429 | Message-route rate limit → backoff (body has only `success` + `reason`). |
| `reason: null` | 500 | Uncaught server error → generic retryable error. |

### Cafe / table

`ERR_CAFE_NOT_FOUND` · `ERR_CAFE_TABLE_NOT_FOUND` · `ERR_CAFE_TABLE_UNEXPECTED` · `ERR_CREATE_TABLE_CAFE_DISABLED` · `ERR_TABLE_DUPLICATE_NIKNAME` · `ERR_TABLE_DUPLICATE_USERNAME` · `ERR_TABLE_NOT_FOUND` · `ERR_TABEL_NOT_FOUND` *(typo)* · `ERR_TABLE_UPDATE` · `ERR_TABLE_NOT_CREATED` · `ERR_TABLE_USER_ERR` · `ERR_TABLE_BANNED` · `ERR_TABLE_SUBSCRIPTION_ID` · `ERR_USER_SUBSCRIBED` · `ERR_BANNED_OP` · `ERR_VALIDATION_STATUS` · `ERR_ACCESS_NOT_FOUND` · `ERR_CAFE_ACCESS_NOT_FOUND` · `ERR_ACCESS_TO_CREATE` · `ERR_CAFE_USER_ACCESS_DUPLICATE` · `ERR_CAFE_USER_ACCESS_DUPLICATE_END_TIME` · `ERR_USER_NOT_FOUND` · `ERR_USER_BLOCK` · `ERR_MESSAGE_SEND_LIMIT` · `ERR_MESSAGE_INSULT` · `ERR_MESSAGE_NOT_FOUND` · `ERR_SEND_MESSAGE_TABLE_NOT_FOUND` · `ERR_DELETED_MESSAGE_NOT_FOUND` · `ERR_EDIT_MESSAGE` · `ERR_EDIT_MESSAGE_NOT_FOUND` · `ERR_EDIT_MESSAGE_ERR_ACCESS` · `ERR_DELETE_MESSAGE` · `ERR_DELETE_MESSAGE_ERR_ACCESS` · `ERR_REPORT_NOT_FOUND` · `ERR_BAD_WORD_DUPLICATE_WORD` · `ERR_BAD_WORD_NOT_FOUDN` *(typo)* · `ERR_UNEXPCTED` *(typo)* · `INFO_TABLE_NOT_FOUND` *(success-shaped: HTTP 201, messages empty)* · `SUCCESS_BAD_WORD_CREATED` · `SUCCESS_CAFE_CREATED`

### Socket

- `connect_error.data.reason`: `ERR_AUTH_TOKEN_INVALID` · `ERR_AUTH_TOKEN_EXPIRED` · `ERR_LOGIN_USER_NOTFOUND` · `ERR_LANG_VERIFY` · `ERR_LANG_INVALID`
- `app:error.reason`: `ERR_VALIDATION` (+ `for`, `data.error[]`) · `ERR_USER_BLOCK`

---

## 18. Quirks & traps (must-read)

1. **Wire typos are load-bearing.** Never "fix" them in the client: `reaplayTo`, `reaplayToMessageId`, `messageSecunce`, `thubmnail`, `privite`, `cafe:leave-chennels-page`, `cafe:table:send-message:recieve`, `cafe:table:recieve-bad-message:[admin,cafe]`, `ERR_TABEL_NOT_FOUND`, `ERR_BAD_WORD_NOT_FOUDN`, `ERR_UNEXPCTED`, `ERR_LANG_VERIFIY`.
2. **Branch on `body.statusCode` / `body.reason`, not the HTTP status** — errors usually arrive as HTTP 200. Exceptions: explicit 429s; some successes use HTTP 201.
3. **`GET /table/:tableId/messages` success has no `success` field** — detect success by presence of `messages`. Inactive tables return HTTP 201 + `reason: "INFO_TABLE_NOT_FOUND"`.
4. **`isManager` and `subscribe` in `GET .../single` are not filtered by the requesting user.** Gate features on `isManager === true`; determine "am I a member?" via `GET /table/subscribed` (match `table.id`) or local state — never via `subscribe.userId`.
5. **Like is a single toggle.** No separate dislike endpoint; no emoji reactions in the backend (context-menu reactions require a new API).
6. **`message-sending-status` / `secure-chat-status` payloads are strings** (`"enabled"` / `"disabled"`), not booleans.
7. **`startAt` of `messageSendingEnabled` is ignored** by the server's closed-check; only `enabled` and `endAt` matter.
8. **Legacy send quirk:** a user with **no** access record can only send when the MSE window is **closed**; **guest**-access users only when it's **open**; cafe/table access and managers always can. Do not assume "no access ⇒ cannot send".
9. **Seen must be a number.** Strings don't advance `lastReadSequence`; values above `table.messageSecunce` are clamped.
10. **Report `id` is required in practice** even though the zod schema marks it optional; table-not-found on `report-for=table` is mislabeled `ERR_MESSAGE_NOT_FOUND`.
11. **Only `tableType: "space"` tables accept chat messages.**
12. **Send/edit/delete moved from socket to REST** — do not emit socket events for them; listen for the broadcasts instead.
13. **Join the right rooms or you'll be blind:** `cafe:table:join-room` for message events; `cafe:join-channels-page` for unread badges.
14. **Dedupe socket echoes of your own REST actions** (send/like/edit/delete) using `senderId`/`userId`/`messageId` + optimistic state.
15. **HTTP 429 on message routes has a minimal body** — do not parse `message`/`statusCode` there.

---

## 19. Recommended client state-sync recipes

### 19.1 Opening a table (sequence)

```
1. GET  /.api/cafe/table/:cafeId/:tableId/single
      → store table, isManager, messageSendingEnabled, secureChat, messageSecunce
2. socket.emit("cafe:join-room", { roomId: cafeId })
3. socket.emit("cafe:table:join-room", { roomId: tableId })   // ack: cafe:table:join-room:response
4. socket.emit("cafe:join-channels-page")                     // once per session, for badges
5. GET  /.api/cafe/table/:tableId/messages                    // first window (no cursor)
      → render ascending; record nextCursor
6. POST /.api/cafe/table/messages/:tableId/seen { seen: max(sequence) }
7. Subscribe to all events in §14 before sending anything.
```

### 19.2 Sending

```
if (!isManager && !composerEnabledFrom(messageSendingEnabled + live status)) → block in UI
optimistic insert
POST /table/:tableId/messages → on 201: replace placeholder with data
on cafe:table:send-message:recieve: reconcile (match id or senderId+sequence)
debounced POST seen { seen: latest sequence }
```

### 19.3 Live composer toggle

```
on cafe:table:message-sending-status(payload):
   if (isManager) keep composer enabled
   else composerEnabled = (payload === "enabled")
```

### 19.4 Context menu dispatch

```
Report  → POST /table/create-report?report-for=message { id, metadata }
Reply   → set local replyTarget; send with reaplayToMessageId
Copy    → clipboard
Like    → POST /table/messages/:tableId/:messageId/like   (toggle)
Edit    → PUT  /table/messages/:tableId/:messageId { text }
Delete  → DELETE /table/messages/:tableId/:messageId
```

### 19.5 Channels list & unread

```
GET /table/subscribed?page&limit&sort → channels[] with unreadMessages
on cafe:table:receive-new-message(tableId): increment badge or refetch page 1
on open table: reset that table's badge to 0 (server updates on POST seen)
```

### 19.6 Reconnect strategy

```
socket.io auto-reconnect → re-emit in order:
   cafe:join-room, cafe:table:join-room, cafe:join-channels-page
then catch-up: GET messages?direction=new&cursor=<last sequence> until hasMore=false
refresh GET .../single to resync messageSendingEnabled / secureChat / messageSecunce
```

---

## Appendix A — Quick endpoint reference

| # | Method | Path | Purpose |
|---|---|---|---|
| 1 | GET | `/table/:cafeId/:tableId/single` | Table content + `isManager` |
| 2 | GET | `/table/subscribed` | My tables + `unreadMessages` |
| 3 | GET | `/table/:tableId/messages` | Paginated messages |
| 4 | GET | `/table/:tableId/users` | Participants (manager/guest) |
| 5 | POST | `/table/subscribe` | Join table |
| 6 | POST | `/table/:tableId/left` | Leave table |
| 7 | POST | `/table/messages/:tableId/seen` | Mark read `{ seen }` |
| 8 | POST | `/table/messages/:tableId/:messageId/like` | Like toggle |
| 9 | POST | `/table/create-report?report-for=message\|table` | Report |
| 10 | POST | `/table/:tableId/messages` | Send message |
| 11 | PUT | `/table/messages/:tableId/:messageId` | Edit message `{ text }` |
| 12 | DELETE | `/table/messages/:tableId/:messageId` | Delete message |

## Appendix B — Minimal socket bootstrap (pseudo-code)

```js
const socket = io(`${BASE}/cafe`, { auth: { token }, extraHeaders: langHeaders });

socket.on("connect_error", (err) => handleAuthError(err.data?.reason));

socket.on("cafe:table:send-message:recieve", onNewMessage);
socket.on("cafe:table:edit-message:response", onEditMessage);
socket.on("cafe:table:delete-message:response", onDeleteMessage);
socket.on("cafe:table:delete-message:bulk:response", onDeleteBulk);
socket.on("cafe:table:like-message", onLike);
socket.on("cafe:table:change-message-status", onModerationStatus);
socket.on("cafe:table:message-sending-status", (s) => setComposer(s === "enabled"));
socket.on("cafe:table:secure-chat-status", (s) => setSecureChat(s === "enabled"));
socket.on("cafe:table:join-new-user", onUserJoin);
socket.on("cafe:table:leave-new-user", onUserLeave);
socket.on("cafe:table:receive-new-message", onUnreadBadge);
socket.on("app:error", onAppError);

socket.emit("cafe:join-room", { roomId: cafeId });
socket.emit("cafe:table:join-room", { roomId: tableId });
socket.emit("cafe:join-channels-page");
```

---

*End of NEWTASK.md. When backend behavior and this document disagree, treat the source of truth as: `src/modules/cafe/*`, `src/sockets/modules/cafe/table.socket.ts`, `src/validations/cafe.validation.ts`, `src/middlewares/error.middleware.ts`.*
