/**
 * Cafe (کافه) — the messenger slice of the backend, for the reader's own
 * account: `GET /cafes/feet`, `GET /:id/single`, `GET /table/:cafeId/tables`,
 * `GET /table/:cafeId/:tableId/single`, `GET /table/q`, `GET /me/my-ct`,
 * `POST /table/subscribe`, `GET /table/subscribed`, `POST /table/:tableId/left`,
 * `GET /table/:tableId/users`, `GET /table/:tableId/messages`,
 * `POST /table/:tableId/messages`, `PUT` / `DELETE /table/messages/:tableId/:messageId`,
 * `POST /table/messages/:tableId/seen`,
 * `POST /table/messages/:tableId/:messageId/like`,
 * `POST /table/create-report` — plus the `/cafe` Socket.IO namespace.
 *
 * ## THE RULES THAT SHAPE EVERY INTERFACE BELOW
 *
 * 1. **HTTP 200 IS NOT SUCCESS.** `expressErrorHandler` answers every refusal
 *    with HTTP 200/201 and the real status inside `statusCode`, so a payload is
 *    what is inspected — never the status. `success === true` is the only
 *    success signal, with ONE exception (message history, below).
 * 2. **THE MISSPELLINGS ARE THE CONTRACT.** `privite`, `messageSecunce`,
 *    `thubmnail`, `reaplayTo` / `reaplayToMessageId`, `chennels`, `recieve` and
 *    `nikname` are misspelled **in the backend** and correcting any of them here
 *    would silently read `undefined` forever. They are reproduced verbatim and
 *    must not be "tidied up"; only the Persian label in the UI is corrected.
 * 3. **THE IDS ARE NOT `_id`.** A cafe and a table are addressed by their own
 *    `id` (a `uniqid`), a table's `tableId` (`ch_` / `cv_` / `tb_`) is its
 *    PUBLIC handle, and a message's `roomId` is the **table's `id`**. Socket
 *    room names are built from `table.id` for the same reason.
 *
 * The one place these are NOT optional-everywhere is documented on each member:
 * `id` and `label` on a cafe are what every route and every header is keyed by,
 * so a value without them cannot be rendered at all.
 */

/* ------------------------------------------------------------------ enums -- */

/** `privite` — not `private`. See rule 2 in the file header. */
export type CafeStatus = "public" | "privite";

/**
 * `space` is the ONLY type that carries a text chat: sending to a `bot` or a
 * `club-voice` table is refused with `ERR_SEND_MESSAGE_TABLE_NOT_FOUND`, so the
 * composer must be hidden rather than shown and then refused.
 */
export type TableType = "bot" | "club-voice" | "space";

/** `challange` — not `challenge`. See rule 2 in the file header. */
export type MessageType =
  | "voice"
  | "video"
  | "image"
  | "text"
  | "challange"
  | "file"
  | "audio"
  | "poll";

/**
 * A message's moderation state, and it is a STATE rather than a filter: a
 * `submitted-for-review` or `suspended` message is still in the history and must
 * still render, with a warning. Only `deleted` replaces its body.
 */
export type MessageStatus =
  | "active"
  | "suspended"
  | "submitted-for-review"
  | "deleted";

export type TableUserRole = "admin" | "moderator" | "member";

export type TableParticipantStatus = "active" | "left" | "banned" | "mute";

/**
 * ⚠️ `guest`, not the backend enum's own misspelling. The `accessTo` value that
 * `POST /table/:tableId/create-access` accepts is spelled `guest` on the wire
 * even though an older enum in the schema says `guast`.
 */
export type CafeAccessType = "cafe" | "table" | "guest";

/** Which way to walk the history: `old` = older than `cursor`, `new` = newer. */
export type CafeMessagesDirection = "old" | "new";

/** `report-for` on `POST /table/create-report`. */
export type CafeReportTarget = "message" | "table";

export type CafeSort = "asc" | "desc";

/**
 * ⚠️ The boolean filters of `GET /table/:cafeId/tables` are STRINGS, not
 * booleans — sending `true` filters on nothing and the list comes back whole,
 * which reads as «the filter is not working» rather than as a bad request.
 */
export type CafeBooleanFilter = "yes" | "no";

/**
 * `CafeSort`'s two values, as a runtime list — the `GOAL_DOMAINS` arrangement in
 * `app/types/goal.ts`, for the same reason.
 *
 * A `sort` is what a café screen types a filter with; this is what a Nitro proxy
 * checks an untrusted query value against before forwarding it, because
 * upstream it reaches a Mongo `$sort`, and a value outside the documented pair
 * has no business being on the wire at all.
 */
export const CAFE_SORTS: readonly CafeSort[] = ["asc", "desc"];

/** `CafeBooleanFilter`'s two values, as a runtime list. See `CAFE_SORTS`. */
export const CAFE_BOOLEAN_FILTERS: readonly CafeBooleanFilter[] = ["yes", "no"];

/**
 * `CafeMessagesDirection`'s two values, as a runtime list. See `CAFE_SORTS`.
 *
 * A `direction` is not a filter but the **branch a history read takes** —
 * `old` prepends the page before the `cursor`, `new` appends the page after it —
 * so a value outside the pair is not «the default, probably», it is the
 * opposite of what the caller asked for and would be indistinguishable from a
 * backend bug.
 */
export const CAFE_MESSAGES_DIRECTIONS: readonly CafeMessagesDirection[] = [
  "old",
  "new",
];

/**
 * `CafeReportTarget`'s two values, as a runtime list. See `CAFE_SORTS`.
 *
 * ⚠️ NOT A PREFERENCE, IT IS WHICH DOCUMENT IS WRITTEN: `report-for` selects
 * between two different stored reports — a `message` report captures the
 * message's text and its sender, a `table` report captures none of it — so an
 * unvalidated value cannot be forwarded as «close enough».
 */
export const CAFE_REPORT_TARGETS: readonly CafeReportTarget[] = [
  "message",
  "table",
];

/**
 * Narrows an untrusted query value to a `CafeSort`, or `false` so a proxy can
 * DROP it rather than forward something the upstream has no meaning for.
 *
 * A `CafeSort` typed in a screen is not a filter on this side of the wire: the
 * value that arrives is whatever was typed into the URL, so the check has to
 * happen again where the request is built.
 */
export function isCafeSort(value: unknown): value is CafeSort {
  return typeof value === "string" && CAFE_SORTS.some((sort) => sort === value);
}

/**
 * Narrows an untrusted query value to a `CafeBooleanFilter` — see
 * `isCafeBooleanFilter`'s caller, `server/api/cafe/table/[resourceId]/index.get.ts`.
 */
export function isCafeBooleanFilter(value: unknown): value is CafeBooleanFilter {
  return (
    typeof value === "string" &&
    CAFE_BOOLEAN_FILTERS.some((filter) => filter === value)
  );
}

/**
 * Narrows an untrusted query value to a `CafeMessagesDirection` — see
 * `isCafeBooleanFilter`'s caller, for the same reason: the value that arrives is
 * whatever was typed into the URL, so the check has to happen again where the
 * request is built.
 *
 * A value that fails is **DROPPED by the proxy**, not refused: upstream's own
 * default for `direction` is `old`, so an unreadable value reads as «the first
 * window» rather than as a failure of a screen that is otherwise fine.
 */
export function isCafeMessagesDirection(
  value: unknown,
): value is CafeMessagesDirection {
  return (
    typeof value === "string" &&
    CAFE_MESSAGES_DIRECTIONS.some((direction) => direction === value)
  );
}

/**
 * Narrows an untrusted `report-for` to a `CafeReportTarget`.
 *
 * ⚠️ Unlike the two above, a value that fails here must be **REFUSED** by the
 * caller and not dropped: `report-for` has no default — it is `required`, and
 * omitting it answers `ERR_VALIDATION` — so "dropped" would be a 400 the reader
 * sees as a broken form, while refusing here keeps the refusal ours and never
 * spends an upstream request on a document whose level we could not prove.
 */
export function isCafeReportTarget(value: unknown): value is CafeReportTarget {
  return (
    typeof value === "string" &&
    CAFE_REPORT_TARGETS.some((target) => target === value)
  );
}

/* ------------------------------------------------------------------ models -- */

/**
 * A scheduled window. ⚠️ `startAt` / `endAt` are **millisecond epoch numbers**,
 * not date strings, so they compare against `Date.now()` directly and must never
 * be handed to a date formatter.
 */
export interface ICafeWindow {
  enabled?: boolean;
  startAt?: number | null;
  endAt?: number | null;
}

/** The preview line under a table's name. */
export interface ICafeTableLastMessage {
  text?: string;
  sender?: string;
  type?: MessageType;
}

/**
 * A cafe — a group of tables.
 *
 * `label` is the name every header and every screen is built from, and `id` is
 * what `GET /:id/single` and `/table/:cafeId/…` take; the two are required
 * because a cafe without them has no route and no title.
 *
 * `view` increments on EVERY `GET /:id/single`, so the last response is the
 * only honest one to keep for the counter.
 */
export interface ICafe {
  id: string;
  label: string;
  // ⚠️ The model declares these three nullable; they are modelled as merely
  // ABSENT here, because the list and detail views hand each one straight to a
  // required string prop and a `null` there is a blank title rather than a state
  // to render. `profileImage` keeps its `null` — every use site casts it to the
  // avatar's `src`, which accepts one.
  title?: string;
  body?: string;
  description?: string;
  profileImage?: string | null;
  tags?: string[];
  vip?: boolean;
  isActive?: boolean;
  enabled?: boolean;
  ownerId?: string;
  status?: CafeStatus;
  priviteUsersId?: string[];
  view?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A table — one conversation inside a cafe.
 *
 * `id` (the uniqid) is the `roomId` of its messages AND the `{tableId}` of
 * `table_{tableId}_room` on the socket. `tableId` is the separate PUBLIC handle
 * (`ch_…` / `cv_…` / `tb_…`) that a reader may search for, and using one in
 * place of the other is the single most common way to end up in a room that never
 * receives anything.
 */
export interface ICafeTable {
  id: string;
  tableId?: string;
  cafeId?: string;
  /** ⚠️ Misspelled in the backend model. See rule 2 in the file header. */
  nikname?: string | null;
  profileImage?: string | null;
  enabled?: boolean;
  isActive?: boolean;
  status?: CafeStatus;
  tableType?: TableType;
  /** ⚠️ Misspelled. The table's TOTAL message count — the unread formula's other half. */
  messageSecunce?: number;
  messageSendingEnabled?: ICafeWindow;
  secureChat?: ICafeWindow | null;
  lastMessage?: ICafeTableLastMessage | null;
  free?: boolean;
  amount?: number | null;
  star?: number | null;
  currentSpeakerId?: string | null;
  speakers?: unknown[];
  raiseHandQueue?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A table as the LIST and SINGLE views actually receive it.
 *
 * Two fields are promoted out of `ICafeTable`'s optional set because the views
 * dereference them without a guard and the endpoints always populate them:
 *
 * - `lastMessage` is guaranteed on `GET /table/:cafeId/tables` and
 *   `GET /table/subscribed` (it comes from a `$lookup`, not from the table), so a
 *   card can always print its own empty-history line.
 * - `isManager` is computed by the single-table route alone and decides whether
 *   the management menu is offered at all.
 *
 * `subscribe` stays optional: it is empty — not absent, but the caller must not
 * rely on that — for a reader who is not a member yet.
 */
export interface ICafeTableView extends ICafeTable {
  lastMessage: ICafeTableLastMessage;
  isManager?: boolean;
  subscribe?: ICafeTableParticipant[];
}

/**
 * Membership of one reader in one table. Where present, `roomId` IS the table's
 * `id`.
 *
 * ⚠️ `roomId` and `cafeId` are ABSENT from the single-table endpoint. Its
 * aggregation pipeline `$project`s both fields OUT of every participant document
 * before responding (verified against the controller and a live response), so a
 * participant read from `GET /table/:cafeId/:tableId/single` carries neither.
 * They are optional for that reason — do not make them required again, and do
 * not read them off a participant that came from that endpoint.
 */
export interface ICafeTableParticipant {
  roomId?: string;
  cafeId?: string;
  userId?: string;
  role?: TableUserRole;
  status?: TableParticipantStatus;
  leftAt?: number | null;
  muteUntil?: boolean | number;
  bannedUntil?: boolean | number;
  lastReadMessageId?: string | null;
  lastReadSequence?: number | null;
  lastReadAt?: number | null;
  voiceStatus?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** `thubmnail` — not `thumbnail`. See rule 2 in the file header. */
export interface ICafeTableMessageFile {
  fileType?: string | null;
  thubmnail?: string | null;
  mainUrl?: string | null;
}

/** `reaplayTo` — not `replyTo`. See rule 2 in the file header. */
export interface ICafeTableMessageReply {
  messageId?: string;
  textType?: MessageType;
  text?: string;
  userId?: string;
}

export interface ICafeTableMessagePollOption {
  title?: string;
  description?: string;
}

export interface ICafeTableMessagePoll {
  title?: string;
  description?: string;
  body?: string;
  value?: number;
  options?: ICafeTableMessagePollOption[];
}

/**
 * A message as the HISTORY returns it.
 *
 * `sequence` is the field everything pages on: it is the `cursor` of the history
 * endpoint, the `seen` value of the read receipt, and the only stable ordering
 * key — `createdAt` is not, because messages are persisted by a BullMQ job and
 * arrive out of order.
 */
export interface ICafeTableMessage {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  text?: string;
  sequence: number;
  status: MessageStatus;
  /** userIds, not a count. `like.length` is the count and `like.includes(myId)` the state. */
  like?: string[];
  view?: number;
  createdAt?: string;
  updatedAt?: string;
  file?: ICafeTableMessageFile | null;
  reaplayTo?: ICafeTableMessageReply | null;
  messageEdited?: { editedAt?: number; text?: string }[];
  poll?: ICafeTableMessagePoll | null;
  /** Absent from every REST answer — only the persistence layer sees it. */
  processAt?: string;
}

/**
 * The soft-moderation block that rides along with a sent or broadcast message —
 * §11's `report`, and §14.1's same key on the live broadcast.
 *
 * ⚠️ IT RIDES ALONG **ONLY** WHEN GENERAL BAD WORDS MATCHED, and it is a SUCCESS:
 * a `submitted-for-review` message was STORED, held for a moderator, and its body
 * is the server's censored one. So `censoredText` is the text to render — the
 * backend already censored it and the client is not going to keep a word list of
 * its own — and `usedWordCount` is a fact about the message rather than a headline
 * to put next to somebody's bad words.
 */
export interface ICafeMessageReport {
  usedWordCount?: number;
  censoredText?: string;
}

/**
 * One row of a thread as the client can ACTUALLY hold it.
 *
 * ## ⚠️ IT IS NOT `ICafeTableMessage`, FOR THREE REASONS, AND NONE OF THEM IS COSMETIC
 *
 * 1. **`sequence` IS OPTIONAL AND MAY BE `null`.** A live broadcast carries no
 *    `sequence` at all (§14.1: «same fields as send-response `data`» is the
 *    backend's own summary, and `sequence` is written later by the save job), and
 *    an optimistic row has to exist before the 201 that carries one. So a row with
 *    `sequence === null` is a real state, not a gap in the data: **the sequence
 *    comes from a history read and from nowhere else.** A page is paged by it, and
 *    `seen` is posted as it, so inventing one would corrupt both.
 * 2. **`senderId` MAY BE `null`** — a broadcast is drawn the moment it lands, and one
 *    that arrives without a `senderId` leaves the catch-up to fill it. ⚠️ **One
 *    consequence for every reader of this type:**
 *    `members[message.senderId]` does not compile against a nullable key, so a
 *    component that resolves a sender name must write `members[message.senderId ?? ""]`
 *    (which answers `undefined` and renders no name — the correct picture for a
 *    message whose sender this client has not learned yet).
 * 3. **`report` EXISTS ONLY ON A SEND ANSWER / BROADCAST**, never on a history
 *    read, so a re-read of history loses it. `localId` / `sending` / `failed` /
 *    `provisional` are CLIENT-ONLY and answer one question: has this row been
 *    persisted yet?
 *
 * ## WHY IT LIVES HERE AND NOT IN THE STORE
 *
 * `MessageList` / `MessageBubble` must be able to import the shape of a row from
 * the module they already import from, rather than depending on a store to know
 * it. (The mirror case is the store's own `CafeSingleTableWire`: a WIRE
 * normalisation the store owns, for a field only the wire has.)
 */
export interface ICafeThreadMessage
  extends Omit<
    ICafeTableMessage,
    "sequence" | "senderId" | "roomId" | "type" | "status"
  > {
  /** ⚠️ `null` until a HISTORY READ has filled it in. See the header. */
  sequence?: number | null;
  /** ⚠️ `null` until a history read, a send answer or a moderator has filled it. */
  senderId?: string | null;
  /** The table's `id`. Absent on a live broadcast — the room already names it. */
  roomId?: string;
  type?: MessageType;
  status?: MessageStatus;
  /** Client-only. The `local:` id of the not-yet-answered send this row is. */
  localId?: string;
  /** Client-only. The REST answer has not landed. */
  sending?: boolean;
  /** Client-only. The send was refused; the bubble offers a retry. */
  failed?: boolean;
  /** Client-only. A broadcast no history read has reconciled yet. */
  provisional?: boolean;
  /** The server's own moderation block. `null`/absent = not soft-moderated. */
  report?: ICafeMessageReport | null;
}

/**
 * One table's transcript and everything needed to page it, keyed by the table's
 * **INTERNAL** id (`ICafeTable.id`) — never by the `ch_` / `cv_` / `tb_` handle a
 * `/cafe/…/table/…` URL carries.
 *
 * ## ⚠️ THE PAGE STATE IS **THE SERVER'S**, NEVER RECOMPUTED
 *
 * `hasOlder` / `hasNewer` / `olderCursor` / `newerCursor` are `hasMore` and
 * `nextCursor` as §15 answered them, per direction. They are never derived from
 * `messages.length === 15`: the page size is 15 by default and 500 under
 * `loadAll`, the server may change it, and a client that infers «there is nothing
 * older» from a row count is one constant away from permanently hiding history.
 *
 * ## WHY A CACHE AND NOT ONE REF
 *
 * Two requirements, and only a keyed cache satisfies both: a transcript must
 * SURVIVE navigating away and back (a reader returning to a conversation expects
 * it there), and two tables must not CONTAMINATE each other (one flat ref plus a
 * reset satisfies the second by throwing the first away).
 */
export interface ICafeThread {
  /** Ascending, oldest first, deduped by `id`. */
  messages: ICafeThreadMessage[];
  /** `direction:"old"` has more behind it. See the header. */
  hasOlder: boolean;
  /** The `direction:"old"` cursor — the server's `nextCursor` for that direction. */
  olderCursor: number | null;
  /** `direction:"new"` has more after it. See the header. */
  hasNewer: boolean;
  /** The `direction:"new"` cursor — the server's `nextCursor` for that direction. */
  newerCursor: number | null;
  /** A read-older request is in the air (drives the top spinner). */
  loadingOlder: boolean;
  /** A read-newer request is in the air (drives the bottom spinner). */
  loadingNewer: boolean;
  /**
   * This client's read frontier for the table — the highest `sequence` it has
   * DECIDED is read. ⚠️ It is a local value: §8 carries no per-message read state
   * at all, so `unread = table.messageSecunce - lastReadSequence` (§8) is the only
   * unread figure this client can honestly compute.
   */
  lastReadSequence: number;
  /**
   * ⚠️ The high-water mark of what has actually been POSTed to `/seen`, and the
   * ONLY reason a trailing throttle is not enough: a number already sent is never
   * sent twice, so scrolling a thread of two hundred messages costs one request
   * per new maximum rather than one per scroll tick.
   */
  lastSeenSent: number;
  /**
   * ⚠️ LIVE OVERRIDE of `messageSendingEnabled.enabled`, from
   * `cafe:table:message-sending-status`. `null` means «follow the `/single`
   * payload» — and it is stored HERE rather than written onto `cafe.table`
   * because mutating the REST answer would make a later re-read of `/single`
   * unable to restore the truth.
   */
  sendingOverride: ICafeWindowBroadcast | null;
  /** ⚠️ Same, for `secureChat` / `cafe:table:secure-chat-status`. */
  secureOverride: ICafeWindowBroadcast | null;
  /**
   * Whether a payload this client holds says the reader is an ACTIVE participant
   * of this table.
   *
   * ⚠️ It is **not** a gate on reading, on joining the socket room, or on the
   * transcript — §18.4 is explicit that «am I a member?» is not answerable from
   * `GET …/single`'s `subscribe`, so this stays `false` for a reader the endpoint
   * cannot vouch for. It answers exactly one question: «should the screen offer
   * a join control?», which it must not for a reader who is already in.
   */
  joined: boolean;
}

/**
 * A member as `GET /table/:tableId/users` lists them.
 *
 * ⚠️ An EMPTY ARRAY IS NOT AN ERROR: a reader who is not a member gets
 * `{ success: true, users: [] }`, so "no members" and "not allowed to look" are
 * the same answer and must be presented as the first.
 */
export interface ITableUserView {
  _id?: string;
  userId?: string;
  mobile?: string;
  fullName?: string;
  age?: number;
  avatar?: string;
  email?: string;
  position?: string;
  gender?: string;
  personalityType?: string;
  isOnline?: boolean;
  lastSeen?: number;
  createdAt?: string;
}

/**
 * One of my management grants, from `GET /me/my-ct`.
 *
 * `cafe` and `table` are required as ARRAYS here even though only ONE of the two
 * is ever populated — the `cafe` virtual looks the grant up by `targetId` on
 * `Cafe.id` and the `table` virtual on `Cafe Table.id`, so the pair tells you
 * which kind of grant this is. The grants list reads them unconditionally, and
 * the store normalises an absent pair to `[]` so the guarantee is the one the UI
 * actually gets — `ICafeAccessRow` is the raw row.
 *
 * ⚠️ The server's `hasAccess` ignores `startAt`, so a grant already counts before
 * its own start time. Compare `startAt` here as well.
 *
 * ## ⚠️ `id` AND `type` ARE OPTIONAL, AND THE SCHEMA SAYS THEY ARE NOT
 *
 * `cafe-access.model.ts:10-14` declares both `required: true`, `type` against
 * `enum: ['cafe', 'table', 'guest']` — and Mongoose validation is the ONLY thing
 * that enforces it. A grant document inserted **straight into Mongo**, bypassing
 * the model, therefore carries neither field, and `GET /me/my-ct` hands it back
 * exactly as it was stored. Measured on the live endpoint, for a reader who
 * really holds both kinds of grant:
 *
 * | request            | rows returned                                            |
 * |--------------------|----------------------------------------------------------|
 * | unfiltered         | **2** (one café grant + one table grant)                 |
 * | `?type=cafe`       | **0** ← silently misses the café grant entirely           |
* | `?type=table` | 1 ← matches only the Mongoose-written grant               |
 *
 * ⚠️ Re-measured later, on a session whose table grant had elapsed (`endAt` in
 * the past, which this endpoint filters on and `isManager` does not): unfiltered
 * then answered **1** row and `?type=table` **0**. The filter columns do not move,
 * and neither does the hazard — a café grant the reader really holds stays
 * invisible under `?type=cafe`.
 *
 * So `type` is not a filter you may send: **never forward it**, and never branch
 * on it (see `managedCafeIds` / `managedTableIds` in `app/stores/cafe.ts`, which
 * used to branch on exactly that and were therefore always empty). The populated
 * array is the only discriminator that survives a document that skipped
 * validation.
 */
export interface ICafeAccess {
  /** Absent on a grant inserted directly into Mongo — see the header. */
  id?: string;
  /** Absent on a grant inserted directly into Mongo — see the header. */
  type?: CafeAccessType;
  /** `cafe.id` or `table.id`, whichever of the two the populated array holds. */
  targetId: string;
  ownerId?: string;
  userId?: string;
  startAt?: number | null;
  endAt?: number | null;
  cafe: ICafe[];
  table: ICafeTableView[];
  createdAt?: string;
  updatedAt?: string;
}

/** `GET /me/my-ct` as it arrives: either pair may be absent. See `ICafeAccess`. */
export type ICafeAccessRow = Omit<ICafeAccess, "cafe" | "table"> & {
  cafe?: ICafe[];
  table?: ICafeTableView[];
};

/**
 * One entry of `GET /table/subscribed`, flattened as the endpoint documents it:
 * the table's own fields, plus the unread badge and the cafe it belongs to.
 *
 * ⚠️ THE BACKEND'S PAGINATION IS BROKEN (`$limit` before `$skip`, and `$skip`
 * fed the page NUMBER rather than an offset), so page 2 silently repeats page 1.
 * `getSubscribedChannels` therefore asks for one large page and the list is
 * paged on the client.
 */
export interface ICafeChannel extends ICafeTable {
  /** The table's `id`, under the name the participant records use. */
  roomId?: string;
  unreadMessages: number;
  cafe: ICafe;
}

/**
 * One entry of `GET /table/subscribed` in the shape it actually arrives in —
 * the membership record with `table` and `cafe` populated, plus the badge.
 *
 * `ICafeChannel` above is the documented flattened shape and is what Phase 2
 * normalises to. This one exists because four existing screens read
 * `channel.table.nikname` and `channel.roomId` straight off the response, and a
 * normalisation that lands before those screens move would blank the channel
 * list rather than fix it.
 */
export interface SubscribeItem extends ICafeTableParticipant {
  table: ICafeTableView;
  cafe: ICafe;
  unreadMessages: number;
}

/* ----------------------------------------------------------------- failure -- */

/** One Zod issue. `path` is the field chain it belongs to, so a form can point at it. */
export interface ICafeValidationIssue {
  code?: string;
  message?: string;
  path?: string[];
}

/**
 * The body of a validation failure.
 *
 * ⚠️ REST sends `errors` (plural, an array) and the socket sends `error`
 * (singular, still an array). Both spellings are read by `parseCafeFailure`, so
 * nothing downstream has to know which transport it is looking at.
 */
export interface ICafeErrorData {
  errors?: ICafeValidationIssue[];
  error?: ICafeValidationIssue[];
}

/** The envelope EVERY cafe answer shares, successful or not. */
export interface ICafeEnvelope {
  success?: boolean;
  message?: string;
  statusCode?: number;
  code?: string;
  reason?: string | null;
}

/** The refusal shape, plus the socket's `for` (which operation failed). */
export interface ICafeErrorPayload extends ICafeEnvelope {
  data?: ICafeErrorData | null;
  /** Socket only: `send-message`, `delete-message`, `edit-message`, … */
  for?: string;
}

/**
 * The `reason` values this feature branches on. Anything else is kept as `null`
 * rather than guessed at — an unknown reason is still shown as a sentence, it is
 * just not treated as one of these.
 */
export type CafeFailureReason =
  | "ERR_NET_CONNECTION"
  | "ERR_VALIDATION"
  | "ERR_USER_SUBSCRIBED"
  | "ERR_TABLE_BANNED"
  | "ERR_TABLE_SUBSCRIPTION_ID"
  | "ERR_TABLE_NOT_FOUND"
  | "ERR_CAFE_NOT_FOUND"
  | "ERR_TABLE_UPDATE"
  | "ERR_TABLE_NOT_CREATED"
  | "ERR_CAFE_TABLE_NOT_FOUND"
  | "ERR_TABLE_USER_ERR"
  | "ERR_PROFANITY_REPORT_NOT_FOUND"
  | "ERR_MESSAGE_NOT_FOUND"
  | "ERR_DELETED_MESSAGE_NOT_FOUND"
  | "ERR_ACCESS_DENIED"
  | "ERR_LOGIN_USER_NOTFOUND"
  | "ERR_AUTH_TOKEN_INVALID"
  | "ERR_AUTH_TOKEN_EXPIRED"
  | "ERR_TOKEN_INVALID"
  | "ERR_TOKEN_UNDEFINED"
  /**
   * ⚠️ Not an error at all: `GET /table/:tableId/messages` answers
   * `{ messages: [], success: true, reason: "INFO_TABLE_NOT_FOUND" }` when its
   * `$lookup` finds nothing — and because it carries `success: true`, it passes
   * a plain success check and reaches the reader as an endless empty history
   * unless it is named here.
   */
  | "INFO_TABLE_NOT_FOUND"
  /**
   * ⚠️ THE ONLY CAFÉ REFUSAL THAT **REJECTS** INSTEAD OF ANSWERING. HTTP 429 is
   * the one status the café error middleware sets for real, so `$fetch` throws
   * rather than resolving with an envelope — and the message routes' own limiter
   * answers a body of exactly two keys (`{ success: false, reason }`), with no
   * `message` and no `statusCode` to fall back on. Without this name in the union
   * it narrows to `null` and a throttled reader is shown whatever the caller
   * guessed, which is «اتصال اینترنت را بررسی کنید» on a perfectly good
   * connection. See `parseCafeError` / `isCafeThrottle` in `~/utils/cafe-response`.
   */
  | "ERR_TOO_MANY_REQUESTS"
  /** The global limiter's 429, which — unlike the message routes' — does carry `message`. */
  | "ERR_RATE_LIMIT"
  /**
   * ⚠️ CLIENT-SIDE ONLY — the backend never sends this. The backend's refusals
   * are the `ERR_*` names above; this one is minted by `stores/cafe.ts` for a
   * request that lost the generation race (`superseded()`), so a caller that
   * surfaces a `CafeResult` can tell «the answer belongs to a scope you have
   * left» from «your connection is down» instead of reading the one as the
   * other. It is named like the rest only so it survives the same narrowing.
   */
  | "ERR_SUPERSEDED";

/**
 * What a `cafe:session-expired` listener receives.
 *
 * Reserved for the `/cafe` socket layer, which does not exist yet — see
 * `app/pages/cafe/README.md` ("Continuing from here", step 2); the plugin that
 * used to carry it is deleted, and nothing reads this payload today. There is
 * no refresh token in this app to renew an expired one with, so that layer has
 * to stop rather than loop, and this payload is the one honest signal a session
 * guard has to act on.
 */
export interface CafeSessionExpiredPayload {
  reason: CafeFailureReason | null;
  message: string;
}

const CAFE_FAILURE_REASONS: readonly CafeFailureReason[] = [
  "ERR_NET_CONNECTION",
  "ERR_VALIDATION",
  "ERR_USER_SUBSCRIBED",
  "ERR_TABLE_BANNED",
  "ERR_TABLE_SUBSCRIPTION_ID",
  "ERR_TABLE_NOT_FOUND",
  "ERR_CAFE_NOT_FOUND",
  "ERR_TABLE_UPDATE",
  "ERR_TABLE_NOT_CREATED",
  "ERR_CAFE_TABLE_NOT_FOUND",
  "ERR_TABLE_USER_ERR",
  "ERR_PROFANITY_REPORT_NOT_FOUND",
  "ERR_MESSAGE_NOT_FOUND",
  "ERR_DELETED_MESSAGE_NOT_FOUND",
  "ERR_ACCESS_DENIED",
  "ERR_LOGIN_USER_NOTFOUND",
  "ERR_AUTH_TOKEN_INVALID",
  "ERR_AUTH_TOKEN_EXPIRED",
  "ERR_TOKEN_INVALID",
  "ERR_TOKEN_UNDEFINED",
  "INFO_TABLE_NOT_FOUND",
  "ERR_TOO_MANY_REQUESTS",
  "ERR_RATE_LIMIT",
  "ERR_SUPERSEDED",
];

/** Narrows an untrusted `reason` from the API (or from `app:error`) to a known one. */
export function isCafeFailureReason(
  value: unknown,
): value is CafeFailureReason {
  return CAFE_FAILURE_REASONS.some((reason) => reason === value);
}

/**
 * A refusal, normalised once so no screen has to know the envelope's spelling.
 *
 * `errors` is `null` rather than `[]` when there is nothing to point a field at,
 * and `message` has already been through `refusalMessage`, so it is safe to show
 * a reader — a 5xx with no `reason` is a backend crash and its English
 * `TypeError` never reaches here.
 */
export interface CafeFailure {
  reason: CafeFailureReason | null;
  statusCode: number | null;
  message: string;
  errors: string[] | null;
}

/**
 * What the new store actions return.
 *
 * A discriminated `ok` rather than a thrown error or a bare `null`: the reader
 * of these calls has to tell «the server refused» from «the server accepted and
 * sent nothing to show», and both look like a missing value.
 */
export type CafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: CafeFailure };

/* --------------------------------------------------------------- responses -- */

/** `GET /cafes/feet` — note `privite`. */
export interface ICafeFeetResponse extends ICafeEnvelope {
  data?: { public?: ICafe[]; privite?: ICafe[] } | null;
}

/** `GET /:id/single` — an unknown cafe answers `200` with `cafe` ABSENT, not 404. */
export interface ICafeSingleResponse extends ICafeEnvelope {
  cafe?: ICafe | null;
}

/** `GET /table/:cafeId/tables` */
export interface ICafeTablesResponse extends ICafeEnvelope {
  tables?: ICafeTableView[] | null;
}

/**
 * `GET /table/:cafeId/:tableId/single`.
 *
 * ⚠️ `table` is **ONE OBJECT**, NOT AN ARRAY. `getSingleTable` destructures the
 * FIRST document the aggregation returns (`[table] = await …aggregate([ … ])`,
 * `Server/src/modules/cafe/cafe.controller.ts:670`) and answers with that object
 * (`res.status(200).json({ success: true, table })`, `:741`). So the pipeline's
 * per-participant rows are reduced to one before the answer is built — which is
 * also why `subscribe` on that object is **one participant document**, and
 * whichever one the pipeline emitted first rather than the reader's.
 *
 * ⚠️ The `$unwind` on `subscribe` **DOES** carry `preserveNullAndEmptyArrays`
 * (`:728`) — it is the `[table]` reduction, not the `$unwind`, that is what makes
 * this a single object.
 *
 * The union is the WIRE shape only, and only because the store cannot be sure of
 * an answer shape it is not allowed to change: `stores/cafe.ts` takes `[0]` from
 * an array, the object itself when it is an object, and nothing otherwise — so a
 * table that does exist is never mistaken for a table that does not.
 */
export interface ICafeSingleTableResponse extends ICafeEnvelope {
  table?: ICafeTableView | ICafeTableView[] | null;
}

/** `GET /table/q` — `result` is `null` when no `text` was sent, not `[]`. */
export interface ICafeSearchResponse extends ICafeEnvelope {
  result?: ICafeTableView[] | null;
}

/** `GET /table/subscribed` — see `ICafeChannel` for the pagination trap. */
export interface ICafeSubscribedResponse extends ICafeEnvelope {
  channels?: SubscribeItem[] | null;
}

/**
 * One row of a `$group: { _id: <field>, count: { $sum: 1 } }` — a **count keyed
 * by the value it counted**, never the count itself.
 *
 * `_id` is optional because `$group` emits it as `null` for a document whose
 * field is missing, and it is `null` rather than absent in that case; `null`
 * here also covers a `$group` over a field the pipeline never read.
 */
export interface ICafeStatsCount<TKey> {
  _id?: TKey | null;
  count?: number;
}

/**
 * One `$facet` row of `GET /stats` — the whole payload, because the endpoint
 * aggregates once and answers `stats` as an array holding exactly this object.
 *
 * ⚠️ `cafesActive` and `cafesByStatus` are **ARRAYS OF COUNTS**, not numbers:
 * they are the output of `$group: { _id: "$isActive" | "$status", count }`. So a
 * screen wants `cafesByStatus.find((row) => row._id === "public")?.count ?? 0`
 * and never `stats.cafesByStatus.length` — which counts the GROUPS, not the
 * cafés, and silently reads «1» for a café split between two statuses.
 *
 * ⚠️ `topPublicChannel` is at most ten cafés, `$project`ed to drop `isActive`
 * and `priviteUsersId`, so on THESE rows `isActive` is **absent** (not `false`).
 * A card that filters its list by `isActive === true` empties a list that
 * arrived full.
 *
 * ⚠️ `GET /stats` is admin-oriented — `docs/Cafe-Api-Docs.md` §15 lists it as
 * «not for the end user» — so nothing here is guaranteed on a reader's token,
 * and every field is optional for that reason rather than out of caution.
 */
export interface ICafeStats {
  cafesActive?: ICafeStatsCount<boolean>[];
  cafesByStatus?: ICafeStatsCount<CafeStatus>[];
  topPublicChannel?: ICafe[];
}

/**
 * `GET /stats` — `stats[0]` is the row above, and is what the store keeps.
 *
 * ⚠️ The array always holds exactly one `$facet` document when the aggregation
 * ran at all, so it is never a "list of stat groups" and must not be iterated.
 */
export interface ICafeStatsResponse extends ICafeEnvelope {
  stats?: ICafeStats[] | null;
}

/** `GET /me/my-ct` */
export interface ICafeMyAccessResponse extends ICafeEnvelope {
  data?: ICafeAccessRow[] | null;
}

/** `GET /table/:tableId/users` */
export interface ICafeUsersResponse extends ICafeEnvelope {
  users?: ITableUserView[] | null;
}

/** The subscribe / leave / seen answers: a message and nothing else. */
export interface ICafeActionResponse extends ICafeEnvelope {
  /** `POST /table/messages/:tableId/seen` sets no message of its own. */
  result?: unknown;
}

/**
 * `POST /table/:tableId/messages` — HTTP **201**, and ⚠️ `data` is the **FULL
 * STORED MESSAGE**, not an echo of what was sent.
 *
 * This is the single fact that makes optimistic sending tractable: the answer
 * carries `id`, `sequence`, `senderId`, `createdAt` and `status`, so the row the
 * reader is already looking at can be completed by the RESPONSE and does not have
 * to wait for the broadcast (which carries none of those five). `report` rides
 * along only when soft bad words matched — see `ICafeMessageReport`.
 *
 * `data` is typed as `ICafeThreadMessage` rather than `ICafeTableMessage` on
 * purpose: it is a real, persisted message (so it has a sequence), but the store
 * still owns the client-only flags, and typing the answer as the client row lets
 * the optimistic reconciliation carry them across in one assignment.
 */
export interface ICafeSendMessageResponse extends ICafeEnvelope {
  data?: ICafeThreadMessage | null;
}

/**
 * `POST /table/messages/:tableId/:messageId/like` — a TOGGLE, so it returns the new state.
 *
 * ⚠ §9's answer also carries `message` (the full updated document), and it is
 * **deliberately not declared here**: `ICafeEnvelope` already gives every café answer
 * a `message?: string` — the Persian sentence — so a second `message` of a different
 * type on the same interface is a type error, and widening the envelope's field to
 * `string | ICafeTableMessage` would make every reader in this file guess which of the
 * two it has. Nothing in this client needs the document: the four values below are the
 * whole answer, and the row's `like` array is what gets written.
 */
export interface ICafeLikeResponse extends ICafeEnvelope {
  liked?: boolean;
  likeCount?: number;
  likes?: string[];
  messageId?: string;
}

/**
 * What one toggle ACTUALLY changed — the four values `ICafeLikeResponse` can be
 * read into, already narrowed, and nothing else.
 *
 * A function and not a computed: the answer belongs to one message and is handed
 * to one caller, and §9's `likes` array is **the authoritative list** (there is no
 * count to recompute and no second endpoint to disagree with), so the outcome is
 * carried as-is rather than re-derived by whoever reads it.
 */
export interface ICafeLikeOutcome {
  messageId: string;
  /** The state AFTER the toggle. There is no separate dislike. */
  liked: boolean;
  /** `likes.length`, carried because the answer states it. */
  likeCount: number;
  /** The full flat user-id list. ⚠️ NOT a reaction map — §7 and §18.5. */
  likes: string[];
}

/**
 * The optional `metadata` object of `POST /table/create-report`.
 *
 * ⚠️ **THERE IS NO ENUM FOR `reason`, AND THAT IS DELIBERATE.** The endpoint
 * stores this object verbatim on the moderation report and never reads it back,
 * so the documented values are three unrelated words — `spam`, `harassment`,
 * `impersonation` — with no enumeration in the backend to check them against. A
 * `CafeReportReason` union would therefore be a list this client invented, and
 * the one place it is enforced (the proxy that rebuilds the body) would start
 * refusing reports with a reason the moderation queue accepts perfectly well.
 * `string` is the honest type; the label the reader picks comes from the report
 * modal, which is a UI concern and not part of this contract.
 *
 * `note` is the reader's own free text and is capped at 500 characters by the
 * proxy (`REPORT_NOTE_MAX`) — a report is a moderation queue entry, not a
 * message thread, and nothing reads a longer one.
 */
export interface ICafeReportMetadata {
  reason: string;
  /** Free text from the reader. Capped at 500 characters; dropped when longer. */
  note?: string;
  /** Where in the UI the report was raised from — reporter context, free-form. */
  source?: string;
}

/** `POST /table/create-report` — the report document is undocumented, so it stays opaque. */
export interface ICafeReportResponse extends ICafeEnvelope {
  result?: Record<string, unknown> | null;
}

/**
 * `GET /table/:tableId/messages` — ⚠️ THE ONE SUCCESS WITHOUT `success`.
 *
 * A real page has no `success` field at all; the presence of `messages` IS the
 * signal. The refusal for the same endpoint arrives as
 * `{ messages: [], success: true, reason: "INFO_TABLE_NOT_FOUND" }`, so both
 * keys are declared and both have to be read.
 *
 * The order is ALWAYS ascending (oldest first) in both directions — `direction:
 * "old"` sorts descending and then reverses — so a caller prepends on `old` and
 * appends on `new` without re-sorting anything.
 */
export interface ICafeMessagesResponse {
  messages: ICafeTableMessage[];
  hasMore?: boolean;
  /** The numeric `sequence` to send as the next `cursor`; `null` at the start. */
  nextCursor?: number | null;
  /** Present only on the `INFO_TABLE_NOT_FOUND` shape, where it is `true`. */
  success?: boolean;
  reason?: string | null;
}

/* ------------------------------------------------------------------ queries -- */

export interface ICafeFeetQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export interface ICafeSubscribedQuery {
  page?: number;
  limit?: number;
  sort?: CafeSort;
}

export interface ICafeTablesQuery {
  page?: number;
  limit?: number;
  status?: CafeStatus;
  q?: string;
  sort?: CafeSort;
  type?: TableType;
  isActive?: CafeBooleanFilter;
  enabled?: CafeBooleanFilter;
  free?: CafeBooleanFilter;
}

export interface ICafeSearchQuery {
  text: string;
  page?: number;
  limit?: number;
}

export interface ICafeMyAccessQuery {
  type?: CafeAccessType;
  limit?: number;
  page?: number;
}

/**
 * The history's paging is by SEQUENCE, not by offset: `cursor` is the
 * `sequence` of the message to walk away from, and `loadAll` swaps the server's
 * 15-item page for a 500-item one.
 *
 * ⚠️ `cursor` is OPTIONAL AND NOT A DEFAULT: §15 says omitting it starts the walk
 * from **the reader's own `lastReadMessageId`**, so an absent cursor on a «load
 * older» request silently becomes a read-receipt-relative one. Send the page's
 * `nextCursor` explicitly.
 *
 * ⚠️ `loadAll` reaches the wire as the STRING `"true"` (that is what this boolean
 * serialises to) and the proxy matches it, together with a literal `"1"` — see
 * `server/api/cafe/table/[resourceId]/messages.get.ts`, which is why either spelling
 * works and a truthiness test does not.
 */
export interface ICafeMessagesQuery {
  direction?: CafeMessagesDirection;
  cursor?: number;
  loadAll?: boolean;
}

/* ---------------------------------------------------------------- resources -- */

/**
 * The ten independent things a café screen can know, and therefore the keys of the
 * store's `loaded` / `pending` / `errors` records.
 *
 * ⚠ PER-RESOURCE, NOT ONE `loading` FLAG, and the reason is that two café
 * screens are legitimately in flight at the same time: `/cafe/[cafeId]/table`
 * holds its table list while its header still wants that café's detail, and
 * `/cafe/[cafeId]/table/[tableId]` holds a table while the bottom menu wants
 * the reader's subscribed channels. A shared flag is only ever right for one of
 * them, so it blanks the list that already arrived and leaves the other showing
 * «loading» over a refusal it already has. One key per resource also makes
 * `reset(key)` possible, which is what the empty states' `#action` retry needs.
 *
 * ⚠ **THE MESSAGING PAIR IS THE SECOND HALF OF THE SAME ARGUMENT, AND IT IS WHY THE
 * LIST IS PER-RESOURCE AT ALL.** A thread screen holds its transcript AND its roster
 * AND the single-table answer at once, and a `messages` flag must not blank the
 * header or the composer while the roster loads, nor a `users` flag may leave the
 * transcript claiming messages have not arrived.
 *
 * ⚠ **AND EVERY MUTATION BYPASSES THIS MACHINERY ENTIRELY.** `messages` and `users` are
 * COLD READS, and they go through `run()` exactly like the other eight — which clears
 * the resource on a refusal. A mutation must NOT: `run()` calling `CLEARED.messages()`
 * over a refused like toggle would empty a perfectly good transcript. So `send`,
 * `edit`, `delete`, `like`, `seen`, `report` and the membership writes are not in this
 * union at all, because they are not resources — see `app/stores/cafe.ts`.
 *
 * Six of the ten are SCOPED — `cafe` and `table` by their ids, `tables` by
 * its café, `search` by its term and page, and `messages` by its direction and
 * cursor — so an answer held for one table must never be handed back for another.
 * The other four describe the reader's own whole list and are scoped only by the
 * filter they were asked for.
 */
export type CafeResource =
  | "feet"
  | "cafe"
  | "tables"
  | "table"
  | "myAccess"
  | "stats"
  | "search"
  | "joined"
  | "messages"
  | "users";

/* ------------------------------------------------------------ socket shapes -- */

/** `cafe:table:join-room` / `cafe:join-room` take the TABLE's `id` as `roomId`. */
export interface ICafeRoomJoinPayload {
  roomId: string;
}

/**
 * The `POST /table/:tableId/messages` body — the WHOLE call.
 *
 * ⚠️ **SEND IS REST-ONLY AND NEVER A SOCKET EMIT.** It used to be typed as the
 * `cafe:table:send-message` emit, which the backend does not have: the API doc is
 * explicit that send/edit/delete moved from the socket to REST, and that the only
 * socket traffic for a message is the `cafe:table:send-message:recieve`
 * **broadcast** the other members receive. An emit the server does not listen
 * for is a message that silently never arrives — the composer appears to work and
 * the conversation never grows — so this is the REST shape.
 *
 * ⚠️ `tableId` is **NOT a body key**: it is the path segment the proxy reads from
 * the route, and it is declared here only so one object can describe the whole
 * call. Forwarding it in the body is what the upstream's strict zod refuses
 * (`Unknown properties → ERR_VALIDATION`), and the proxy
 * (`server/api/cafe/table/[resourceId]/messages.post.ts`) rebuilds the body from an
 * allowlist that does not include it.
 *
 * ⚠️ `reaplayToMessageId` — with the `lay` — is the load-bearing wire typo; the
 * response reads it back as `reaplayTo`. `ICafeLiveMessage` and
 * `ICafeTableMessage` both carry the RESPONSE spelling, which is a different key
 * on a different object.
 */
export interface ICafeSendMessagePayload {
  tableId: string;
  text?: string;
  file?: { mainFile?: string; thumbnailFile?: string };
  poll?: unknown;
  reaplayToMessageId?: string;
}

/**
 * The `POST /table/:tableId/messages` body AS THE CALLER WRITES IT — i.e.
 * `ICafeSendMessagePayload` minus the one key that is a path segment rather than
 * a body field, with `mainFile` **required** inside `file`.
 *
 * ⚠️ Two things it exists to make impossible at the call site, both of which §11's
 * strict zod turns into `ERR_VALIDATION`: forwarding `tableId` in the body, and
 * forwarding a `file` with nothing in it — `{}` counts towards «at least one of
 * `text` / `file` / `poll`», so a file-less "attachment" would pass as a real one.
 *
 * ⚠️ `reaplayToMessageId` — with the `lay` — is the load-bearing wire typo. See
 * `ICafeSendMessagePayload`.
 */
export type ICafeSendMessageBody = Omit<
  ICafeSendMessagePayload,
  "tableId" | "file"
> & {
  file?: { mainFile: string; thumbnailFile?: string };
};

/**
 * A message named by its two ids.
 *
 * Both are the call's identity rather than its body — a REST path is built from
 * them, and `PUT` / `DELETE` carry no `id` of their own — so one object can
 * describe the call and the proxy still refuses anything that is not an id before
 * it becomes a path segment.
 */
export interface ICafeMessageRefPayload {
  tableId: string;
  messageId: string;
}

/**
 * The `PUT /table/messages/:tableId/:messageId` call — `ICafeMessageRefPayload`
 * plus the ONE field its body accepts.
 *
 * ⚠️ Edit is REST-only for the same reason send is: see
 * `ICafeSendMessagePayload`. `text` is required and the only key upstream's strict
 * body allows, so the proxy rebuilds `{ text }` and nothing else.
 */
export interface ICafeEditMessagePayload extends ICafeMessageRefPayload {
  text: string;
}

/**
 * The message a room receives the INSTANT it is sent.
 *
 * §14.1 documents it as «Full message object (**same fields as send-response `data`»)»,
 * and that `data` carries `senderId` and `createdAt` (§11's 201) — so both are declared
 * here and read when they arrive, which is what puts a name and a time on a bubble
 * immediately instead of after the catch-up. `sequence` is the one field that
 * description covers which this type deliberately does **not** declare: the note at the
 * position it would occupy says why.
 *
 * So this is deliberately NOT `ICafeTableMessage`: an optimistic message has to be
 * recognised by its own client id until a history read replaces it with the persisted
 * one, and a broadcast may reach this client before the row is persisted at all.
 */
export interface ICafeLiveMessage {
  id?: string;
  roomId?: string;
  text?: string;
  /** ⚠️ §14.1's «same fields as send-response `data`». Read when present; without it a
   * live row — including the READER'S OWN — has no author until the catch-up fills it. */
  senderId?: string | null;
  /** ⚠️ Same §14.1 line. Read when present, so the bubble has a timestamp on arrival. */
  createdAt?: string;
  // ⚠ NO `sequence` KEY HERE, AND NONE MAY BE ADDED. The catch-up owns sequences: one
  // read off a socket would sit inside the `newestSequence` window `direction:"new"`
  // pages from and inside the value POSTed to `/seen`, so a broadcast-supplied
  // `sequence` corrupts both paging AND the read receipt.
  type?: MessageType;
  status?: MessageStatus;
  poll?: ICafeTableMessagePoll | null;
  reaplayTo?: ICafeTableMessageReply | null;
  /**
   * ⚠️ BOTH SPELLINGS ARE DECLARED, AND THE READER MUST TRY BOTH. §14.1 describes
   * this payload as «same fields as send-response `data`» — whose `file` is
   * `{ fileType, thubmnail, mainUrl }`, misspelled — while this interface already
   * carried the correctly spelled `thumbnail`. Which one a broadcast actually
   * sends is not documented anywhere, so the store reads `thubmnail ?? thumbnail`
   * and neither half is dropped for being wrong.
   */
  file?:
    | {
        fileType?: string | null;
        thumbnail?: string | null;
        thubmnail?: string | null;
        mainUrl?: string | null;
      }
    | null;
  /** §14.1: rides along only when soft bad words matched. See `ICafeMessageReport`. */
  report?: ICafeMessageReport | null;
}

/**
 * One member's presence as the socket reported it, kept per `userId`.
 *
 * ⚠️ IT IS **NOT** A ROSTER AND IT DOES NOT REPLACE ONE. `GET /table/:tableId/users`
 * returns USER documents and `cafe:table:join-new-user` returns a PRESENCE — two
 * different facts about the same people, and a presence event for somebody the
 * roster has never heard of is recorded rather than dropped, because a nameless
 * bubble is worse than a thinner roster.
 */
export interface ICafePresence {
  userId: string;
  /** The event carries it, which is how a presence-only member gets a name. */
  fullName?: string;
  isOnline: boolean;
  lastSeen?: number;
  role?: TableUserRole;
}

export interface ICafeLikeBroadcast {
  tableId?: string;
  messageId?: string;
  liked?: boolean;
  likeCount?: number;
  likes?: string[];
  userId?: string;
}

export interface ICafePresenceBroadcast {
  fullName?: string;
  userId?: string;
  isOnline?: boolean;
  lastSeen?: number;
  role?: TableUserRole;
}

export type ICafeWindowBroadcast = "enabled" | "disabled";

/** `app:error` — the socket's single failure channel. */
export interface ICafeSocketError {
  reason?: string | null;
  /** Which operation failed: `send-message`, `delete-message`, `edit-message`, … */
  for?: string;
  message?: string;
  statusCode?: number;
  data?: ICafeErrorData | null;
}

/**
 * Everything the client sends on `/cafe`.
 *
 * ## ⚠️ AND NOTHING ELSE — THERE ARE NO MESSAGE WRITES HERE, ON PURPOSE
 *
 * Send, edit and delete are **REST-only**. The API doc moved all three off the
 * socket and says so twice (§10.3's footnote, and §18's trap 12): the server does
 * not listen for those emits, and the only socket traffic a message produces is
 * the BROADCAST the room receives afterwards
 * (`cafe:table:send-message:recieve`, `…edit-message:response`,
 * `…delete-message:response`).
 *
 * `cafe:table:send-message`, `cafe:table:edit-message` and
 * `cafe:table:delete-message` were typed here until Phase 2 and are now gone,
 * because an emit the server ignores is not a harmless extra: the composer looks
 * like it sent, the optimistic bubble stays pending forever, and the conversation
 * never grows — a failure with nothing on screen to point at it. What is left is
 * exactly the seven §10.3 documents: room membership and the unread-badge
 * subscription. **Do not add a message write back here.** The REST shapes are
 * `ICafeSendMessagePayload` and `ICafeEditMessagePayload`.
 */
export interface ICafeClientToServerEvents {
  "cafe:table:join-room": (
    payload: ICafeRoomJoinPayload,
    ack?: (ok: boolean) => void,
  ) => void;
  "cafe:table:leave-room": () => void;
  "cafe:join-room": (
    payload: ICafeRoomJoinPayload,
    ack?: (ok: boolean) => void,
  ) => void;
  "cafe:leave-room": () => void;
  "cafe:join-channels-page": () => void;
  /** ⚠️ `chennels` — two `n`s. See rule 2 in the file header. */
  "cafe:leave-chennels-page": () => void;
}

/** Everything the `/cafe` namespace sends back. */
export interface ICafeServerToClientEvents {
  /** Only the table's `id` — this is the unread-badge channel, not the body. */
  "cafe:table:receive-new-message": (tableId: string) => void;
  "cafe:table:send-message:recieve": (message: ICafeLiveMessage) => void;
  "cafe:table:like-message": (payload: ICafeLikeBroadcast) => void;
  "cafe:table:delete-message:response": (
    payload: ICafeMessageRefPayload,
  ) => void;
  "cafe:table:edit-message:response": (
    payload: ICafeMessageRefPayload & { text?: string },
  ) => void;
  /** The secure-chat window closed: every one of these messages is now `deleted`. */
  "cafe:table:delete-message:bulk:response": (messageIds: string[]) => void;
  "cafe:table:change-message-status": (message: ICafeTableMessage) => void;
  /** ⚠️ Also delivered to the reader who joined — ignore `userId === myId`. */
  "cafe:table:join-new-user": (payload: ICafePresenceBroadcast) => void;
  "cafe:table:leave-new-user": (payload: ICafePresenceBroadcast) => void;
  "cafe:table:message-sending-status": (status: ICafeWindowBroadcast) => void;
  "cafe:table:secure-chat-status": (status: ICafeWindowBroadcast) => void;
  "cafe:table:check-repetitive-username:response": (taken: boolean) => void;
  "cafe:table:join-room:response": (ok: boolean) => void;
  "cafe:join-room:response": (ok: boolean) => void;
  "app:error": (error: ICafeSocketError) => void;
}