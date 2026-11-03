/**
 * `useCafeThreadSocket` — the `/cafe` socket's ROOM LIFECYCLE and EVERY LISTENER,
 * for one conversation.
 *
 * ## THREE OWNERS, THREE FILES, NO OVERLAP
 *
 * | Owner | File | Owns |
 * |---|---|---|
 * | Transport | `app/plugins/cafe-socket.client.ts` | ticket, `io()`, connection status, `cafe:join-channels-page`, and the `onCafeSocket` replacement contract |
 * | **This file** | `app/composables/useCafeThreadSocket.ts` | entering / leaving the rooms, every server→client listener, the resync on every (re)connect |
 * | State | `app/stores/cafe.ts` | the `apply*` methods that turn a payload into state, and every request |
 *
 * The line is deliberate and it is the reason this file exists: **transport and
 * lifecycle here, state in the store, nothing else anywhere.** So nothing below
 * writes a ref, and nothing in the store ever calls `off()` — a store has no lifecycle,
 * and a listener that outlives its page is the leak `AGENTS.md` rule 13 forbids.
 *
 * ## ⚠️ THE ONE-TABLE-ROOM INVARIANT IS LOAD-BEARING, NOT TIDY
 *
 * Three of §14's payloads carry **no table id you can trust**:
 * `cafe:table:delete-message:bulk:response` is a bare `string[]`,
 * `cafe:table:message-sending-status` and `cafe:table:secure-chat-status` are plain
 * strings. Room membership is therefore the ONLY thing that makes them unambiguous, and
 * a client in two `table_<id>_room`s at once applies one conversation's traffic to
 * another with nothing able to object. So:
 *
 * - `enter()` always follows a `leave()`, on mount, on a params change and on unmount;
 * - the table room is joined with the table's **INTERNAL** id
 *   (`cafe.internalTableId(cafeId, handle)`), never the `ch_`/`cv_`/`tb_` handle a URL
 *   carries — §18.13 is blunt about the consequence of getting that wrong
 *   («join the right rooms or you'll be blind»);
 * - `leave()` is safe to call twice and is called from every teardown path.
 *
 * ## ⚠️ CLIENT-ONLY IN EFFECT, AND THE FILE SAYS SO BECAUSE IT IS NOT BY DECLARATION
 *
 * The transport plugin is `cafe-socket.client.ts`, so `$onCafeSocket` does not exist
 * during a server render. Nothing below touches it outside `onMounted`, and the two
 * watchers are inert during SSR for the ordinary reason that no watcher fires while the
 * setup body is still running. `useCafe()` IS instantiated on the server — the thread
 * screen awaits `fetchTable` there — which is why every request this file triggers is
 * either a read the page would make anyway or one the store itself guards behind
 * `import.meta.client`.
 *
 * ## ⚠️ EVERY LISTENER IS BOUND BY `on` AND RELEASED BY THE SAME `off`
 *
 * All of them are named functions in this scope, so the `unbind` closure can remove
 * exactly what it attached — from whichever instance is current. A REPLACEMENT instance
 * (a terminal kick, then `openSocket()` again) is handled by `onCafeSocket`, which calls
 * this file's handler with the new instance: the previous binding is released and the
 * new one takes over in the same call. One socket instance therefore carries one copy of
 * each handler, and none outlives the page.
 */

import type {
  ICafeLikeBroadcast,
  ICafeLiveMessage,
  ICafeMessageRefPayload,
  ICafePresenceBroadcast,
  ICafeSocketError,
  ICafeTableMessage,
  ICafeWindowBroadcast,
} from "~/types/cafe";
import type { CafeSocket } from "~/plugins/cafe-socket.client";

/**
 * What a screen gets back. Three members and no more:
 *
 * - `enter(force?)` — idempotent, and the only way into the rooms. A screen calls it
 *   after `cafe.joinTable(...)`, because re-joining a conversation this client is
 *   already in changes nothing by itself: the REST answer moved the membership and the
 *   ROOM is what makes the socket deliver. `force: true` re-runs the resync for a table
 *   already entered (a «تلاش دوباره») and never opens a second room.
 * - `leave()` — leaves both rooms and clears the active thread. Safe twice; the screen
 *   calls it before `cafe.leaveTable(...)` so the room is gone first.
 * - `resync()` — the catch-up half on its own: `direction:"new"` to the tail, then the
 *   roster, then `/single`, then the read receipt. It does NOT touch the rooms, so it
 *   can never open a second one.
 */
export interface ICafeThreadSocket {
  enter: (force?: boolean) => Promise<void>;
  leave: () => void;
  resync: () => Promise<void>;
}

/**
 * @param cafeId the café's id, straight off the route.
 * @param tableHandle the table's **PUBLIC** handle (`ch_` / `cv_` / `tb_`), also off
 * the route. The internal id is resolved from it — see the file header.
 *
 * ⚠ BOTH ARE **REFS**, not values, and that is not a style choice. vue-router REUSES a
 * component instance when only the params change, so `/cafe/A/table/X → /cafe/A/table/Y`
 * never re-runs a setup body: a composable that captured two strings would keep its
 * first table's room while the address said another. The watchers at the bottom are what
 * make the move a real leave-then-enter.
 */
export function useCafeThreadSocket(
  cafeId: Ref<string>,
  tableHandle: Ref<string>,
): ICafeThreadSocket {
  const cafe = useCafe();
  const socketStatus = useCafeSocket();
  const nuxt = useNuxtApp();

  /** The instance the listeners are currently attached to. Never assumed permanent. */
  let instance: CafeSocket | null = null;

  /** Releases the listeners of the CURRENT instance. See `bind`. */
  let unbind: (() => void) | null = null;

  /** Releases the `onCafeSocket` registration. Held so the page can drop it. */
  let stopWaiting: (() => void) | null = null;

  /** The table whose room we are IN. `null` means «in no table room». */
  let entered: string | null = null;

  /** Bumped by every handshake, so a re-join after a drop is not read as a repeat. */
  let handshake = 0;

  /** The handshake `entered` was established on. */
  let enteredOn = -1;

  /** Has the cold first-window read happened yet? See `enter`. */
  let needsFirstWindow = true;

  /**
   * The table's internal id, or `null` while it cannot be resolved yet.
   *
   * ⚠ `null` IS A NORMAL STATE, not an error, and it is the deep-link case: a reader who
   * arrives at `/cafe/A/table/ch_xyz` with an empty store has nothing to resolve the
   * handle against, so the answer only becomes known once `GET …/single` lands. The
   * watcher at the bottom is what turns that into an enter, so a screen never has to
   * poll for it.
   */
  const roomId = computed(() => cafe.internalTableId(cafeId.value, tableHandle.value));

  /* ------------------------------------------------------------- resync -- */

  /**
   * Rooms first, then the tail, then `/single` — and the order is the whole point.
   *
   * ⚠ REVERSING THE LAST TWO WOULD LET A STATUS BROADCAST BE OVERWRITTEN BY A STALE
   * PAYLOAD: `cafe:table:message-sending-status` lands as an OVERRIDE on the thread, so
   * a `/single` read that ran after it would replace the live fact with whatever the
   * table said a moment ago. Joining first means nothing that arrives during the
   * catch-up is missed either.
   */
  async function resync(id: string, cold: boolean): Promise<void> {
    // ⚠ NOT A CALLER'S PROBLEM: `roomId` is `null` until the single-table answer (or a
    // list row) resolves the handle, and both entry paths already guard. This guard is
    // the third door onto the same function and it costs one line.
    if (id === "") return;

    // ⚠ A COLD ENTRY READS THE FIRST WINDOW — AND **ONLY** A COLD ONE. A refusal now
    // preserves the transcript (it clears no rows and no cursors), so this is NOT
    // about protecting the messages on screen: §19.1's first-window step is scoped to
    // the first entry, and re-running a cursorless window read on every reconnect
    // would re-anchor `olderCursor` at the reader's `lastReadMessageId` and cost a
    // request per recovery for no new page. Recovery pages `direction:"new"` below.
    if (cold) await cafe.fetchMessages(id);

    // ⚠ THE WARM PATH. `direction: "new"` to the tail, bounded, refusals included
    // WITHOUT losing what is on screen — the store, not this file, is what keeps the
    // transcript through one.
    await cafe.catchUpMessages(id);

    // ⚠ And the reader may have navigated while that was in the air: every await below
    // re-checks, because a resync that finishes against a table the reader has left is
    // the same late answer `superseded()` exists to refuse on the store side.
    if (entered !== id) return;

    await cafe.fetchUsers(id);

    if (entered !== id) return;

    // ⚠ `/single` LAST: `messageSecunce` (the clamp and the catch-up's ceiling),
    // `messageSendingEnabled`, `secureChat` and `isManager` all live on it, and the
    // store's live window overrides are read as overrides ON TOP of it.
    //
    // ⚠ `refreshTable` and NOT `fetchTable`: this runs on every (re)connect, where the
    // held answer is precisely the one thing that cannot be trusted — anything may have
    // changed while this client was away, and `isFresh` would answer «yes, serve the
    // pre-drop payload».
    await cafe.refreshTable(cafeId.value, tableHandle.value);

    if (entered !== id) return;

    // ⚠ AND THE READ RECEIPT FOR WHAT IS NOW ON SCREEN. The store debounces it and
    // high-water-marks it, so this is safe to call on every scroll tick — and it is
    // called here because §19.1 posts it after the first page lands.
    const newest = cafe.newestRenderedSequence(id);

    if (newest !== null) cafe.scheduleMarkSeen(id, newest);
  }

  /* ---------------------------------------------------- enter / leave -- */

  /**
   * Join the rooms and make the state current. Idempotent, and safe to call at any time.
   *
   * @param force re-run the resync even if this table is already entered — the
   * «تلاش دوباره» path. It never opens a second room: the guard below is about the
   * RESYNC, and the emits are idempotent server-side.
   */
  async function enter(force = false): Promise<void> {
    const socket = instance;
    const id = roomId.value;

    // ⚠ NOT CONNECTED IS NOT «ENTERED». `onConnect` runs the same sequence, and it is
    // the handshake that decides whether a room exists on the wire.
    if (socket === null || id === null || !socket.connected) return;

    if (!force && entered === id && enteredOn === handshake) return;

    // ⚠ SET **BEFORE** THE FIRST `await`, and the reason is a double enter: a screen
    // that calls `enter()` from its own `onMounted` while the socket's own `connect`
    // handler is doing the same thing must produce ONE sequence, not two reads racing
    // over one thread.
    entered = id;
    enteredOn = handshake;

    const cold = needsFirstWindow;

    needsFirstWindow = false;

    // ⚑ THE STORE'S SESSION IDENTITY, and the single writer of `activeThreadId`. It is
    // set before the emits so an event that arrives in the same tick already has
    // somewhere to land.
    cafe.enterThread(id);

    socket.emit("cafe:join-room", { roomId: cafeId.value });
    // ⚠⚠️ THE **INTERNAL** ID, and the one that matters: `table_<id>_room` is built from
    // `Cafe Table.id`, so joining with the URL handle puts this client in a room that
    // never receives a single message — silently, and with every other symptom looking
    // like a backend that is not broadcasting.
    socket.emit("cafe:table:join-room", { roomId: id });

    // ⚠ NOTHING FOLLOWS THE RESYNC, and that is deliberate: `resync` returns as soon as
    // `entered` stops naming this table, so a navigation mid-read is already a no-op and
    // there is nothing here for a trailing guard to catch.
    await resync(id, cold);
  }

  /**
   * Leave both rooms and stop being THE thread.
   *
   * ⚠ THE CACHE IS **KEPT**. Going back to a conversation should show what was there
   * rather than a re-read (`ICafeThread`), and a table the reader deliberately LEFT is
   * discarded by `cafe.leaveTable()` instead — one owner for that decision, so there
   * is never a case where the room is gone and the transcript is not, or the reverse.
   *
   * Safe to call twice, and called from every teardown path.
   */
  function leave(): void {
    const socket = instance;

    // ⚠ CLEARED FIRST, so any event that lands between the two emits is DROPPED rather
    // than applied to a thread this client has already left. `apply*` reads
    // `activeThreadId` and finds `null`.
    entered = null;
    enteredOn = -1;

    // ⚠ AND THE ROOMS GO **BEFORE** `cafe.leaveThread()`, so an event that is already in
    // the socket's buffer when we are done finds a store with no active thread and is
    // dropped rather than written into a conversation this client is walking away from.
    //
    // ⚠ The CACHE IS **NOT** DROPPED — see the header. `cafe.leaveTable()` owns that
    // decision, for the one case that earns it.
    if (socket !== null) {
      socket.emit("cafe:table:leave-room");
      socket.emit("cafe:leave-room");
    }

    cafe.leaveThread();
  }

  /* --------------------------------------------------------- listeners -- */

  /**
   * §14.1's live message. Routed STRAIGHT into the store: the payload carries no
   * `sequence`, so this file has nothing to add to it — deciding what a message
   * without a sequence is belongs to the store (`applyLiveMessage`). It MAY carry
   * `senderId`/`createdAt` (§14.1 says "same fields as the send-response `data`"),
   * and the store reads them when they arrive so a live bubble is named and
   * timestamped immediately instead of waiting for the catch-up.
   */
  function onLiveMessage(message: ICafeLiveMessage): void {
    cafe.applyLiveMessage(message);
  }

  /** §14.1: `{ tableId, messageId, text }`. */
  function onEditMessage(payload: ICafeMessageRefPayload & { text?: string }): void {
    cafe.applyEditBroadcast(payload);
  }

  /** §14.1: `{ tableId, messageId }` — a soft delete, so a tombstone. */
  function onDeleteMessage(payload: ICafeMessageRefPayload): void {
    cafe.applyDeleteBroadcast(payload);
  }

  /** ⚠ §14.1: a BARE `string[]` with no table id. The store's one-table-room guard. */
  function onDeleteBulk(messageIds: string[]): void {
    cafe.applyDeleteBulkBroadcast(messageIds);
  }

  /** §14.1: `{ tableId, messageId, liked, likeCount, likes, userId }`. */
  function onLikeMessage(payload: ICafeLikeBroadcast): void {
    cafe.applyLikeBroadcast(payload);
  }

  /** ⚠ §14.1: a **FULL MESSAGE**, not a status and an id. */
  function onChangeMessageStatus(message: ICafeTableMessage): void {
    cafe.applyMessageStatusBroadcast(message);
  }

  /** ⚠ §18.6: the **STRING** `"enabled"` / `"disabled"` — not a boolean. */
  function onSendingStatus(status: ICafeWindowBroadcast): void {
    cafe.applySendingStatus(status);
  }

  /** ⚠ §18.6 again, the other window. */
  function onSecureChatStatus(status: ICafeWindowBroadcast): void {
    cafe.applySecureChatStatus(status);
  }

  /** §14.1: presence. ⚠ ALSO DELIVERED TO THE READER THEMELVES — the store drops it. */
  function onJoinNewUser(payload: ICafePresenceBroadcast): void {
    cafe.applyPresence(payload, true);
  }

  function onLeaveNewUser(payload: ICafePresenceBroadcast): void {
    cafe.applyPresence(payload, false);
  }

  /**
   * §14.3: a **BARE table-id STRING** on the `channels-page:<userId>` room, and the
   * unread badge's only signal. ⚠ It is ignored when it names the table on screen —
   * the store owns that decision, because it owns `activeThreadId`.
   */
  function onReceiveNewMessage(tableId: string): void {
    cafe.applyUnreadBadge(tableId);
  }

  /**
   * §10.5 / §14.5: `app:error` — the socket's ONE failure channel.
   *
   * ⚠ IT IS A REFUSED **OPERATION**, NOT A DROPPED CONNECTION. A table may refuse one
   * message while the transport carries others perfectly well, so `cafeSocket`'s
   * `setError` here describes the refusal and NOT an outage — the status stays whatever
   * it is, and the badge keeps whatever sentence this wrote until the next successful
   * handshake clears it.
   *
   * ⚠ AND THE SENTENCE IS NORMALISED FIRST, IN ONE PLACE. `applySocketError` runs the
   * store's envelope reader, which refuses a 5xx-with-no-reason — so a backend
   * `TypeError` never reaches a reader — and narrows `reason` to the documented union.
   * Both channels then get the same Persian sentence, computed once.
   */
  function onAppError(error: ICafeSocketError): void {
    const failure = cafe.applySocketError(error);

    if (failure !== null) socketStatus.setError(failure.message);
  }

  /**
   * Every `(re)connect` runs the identical sequence.
   *
   * ⚠ This instance-level listener is what covers an **ordinary** reconnect:
   * socket.io's manager REUSES one instance across drops, so `connect` fires again on
   * the same object — and the server-side socket is NEW, holding none of the rooms it
   * had. `onCafeSocket` covers the other half, the REPLACEMENT instance the plugin
   * builds after a terminal kick. Both paths end here, which is why the resync is
   * written once and not per cause.
   */
  function onConnect(): void {
    handshake += 1;

    void enter();
  }

  /**
   * Bind to a socket instance, or release the current one when handed `null`.
   *
   * ⚠ EVERY LISTENER IS ATTACHED AND RELEASED HERE, BY NAME, IN ONE PLACE — so an
   * `on` without an matching `off` is impossible to write by accident, and a replacement
   * instance is a single call rather than a second set of binds.
   */
  /**
   * ⚠⚠️ THE ACKS ARE **DELIBERATELY NOT BOUND**, and this is a decision rather than an
   * omission.
   *
   * `cafe:join-room:response` and `cafe:table:join-room:response` both answer `true` and
   * nothing else (§14.4). Neither is a refusal, neither carries a payload to act on, and
   * this feature asks for no ack callback — so a listener here would read a `true` and
   * throw it away, which is the definition of dead code. The signal that a room join
   * actually FAILED is the absence of any message traffic in it, and the resync
   * (`direction:"new"`) is what proves it: a conversation that produces no catch-up is
   * a room this client is not in, and that shows up as a transcript that never moves.
   */
  function bind(next: CafeSocket | null): void {
    // ⚠ RELEASED FIRST, unconditionally: this is the only path a terminal kick takes
    // (`releaseIfTerminal` calls the handlers with `null`), and it is the path that
    // would otherwise leave a destroyed instance's listeners attached.
    unbind?.();
    unbind = null;

    instance = next;

    if (next === null) return;

    // ⚠ BOUND SYNCHRONOUSLY, BEFORE ANYTHING CAN FIRE. `onCafeSocket` is called the
    // moment the instance is created, and `io()` begins its handshake on the next tick
    // — so a listener attached one `await` later can miss the handshake entirely.
    next.on("connect", onConnect);
    next.on("cafe:table:send-message:recieve", onLiveMessage);
    next.on("cafe:table:edit-message:response", onEditMessage);
    next.on("cafe:table:delete-message:response", onDeleteMessage);
    next.on("cafe:table:delete-message:bulk:response", onDeleteBulk);
    next.on("cafe:table:like-message", onLikeMessage);
    next.on("cafe:table:change-message-status", onChangeMessageStatus);
    next.on("cafe:table:message-sending-status", onSendingStatus);
    next.on("cafe:table:secure-chat-status", onSecureChatStatus);
    next.on("cafe:table:join-new-user", onJoinNewUser);
    next.on("cafe:table:leave-new-user", onLeaveNewUser);
    next.on("cafe:table:receive-new-message", onReceiveNewMessage);
    next.on("app:error", onAppError);

    unbind = () => {
      next.off("connect", onConnect);
      next.off("cafe:table:send-message:recieve", onLiveMessage);
      next.off("cafe:table:edit-message:response", onEditMessage);
      next.off("cafe:table:delete-message:response", onDeleteMessage);
      next.off("cafe:table:delete-message:bulk:response", onDeleteBulk);
      next.off("cafe:table:like-message", onLikeMessage);
      next.off("cafe:table:change-message-status", onChangeMessageStatus);
      next.off("cafe:table:message-sending-status", onSendingStatus);
      next.off("cafe:table:secure-chat-status", onSecureChatStatus);
      next.off("cafe:table:join-new-user", onJoinNewUser);
      next.off("cafe:table:leave-new-user", onLeaveNewUser);
      next.off("cafe:table:receive-new-message", onReceiveNewMessage);
      next.off("app:error", onAppError);
    };

    // ⚠ AND A SOCKET THAT IS ALREADY UP is entered immediately rather than waiting for
    // a `connect` that has already happened: the plugin connects during init, long
    // before any page mounts, so this is the ordinary path and not the rare one.
    if (next.connected) {
      handshake += 1;

      void enter();
    }
  }

  /* ---------------------------------------------------------- lifecycle -- */

  onMounted(() => {
    // ⚠ THE SUBSCRIPTION IS MADE ON THE CLIENT AND ONLY HERE. The transport plugin is
    // `cafe-socket.client.ts`, so `$onCafeSocket` does not exist during a server render
    // and calling it from the setup body would be reading a property off `undefined`.
    //
    // `onCafeSocket` fires IMMEDIATELY with whatever is current (usually the instance
    // the plugin already built) and again for every replacement — which is what makes a
    // terminal kick recoverable rather than the «stays قطع اتصال until a full page
    // reload» the café README records.
    stopWaiting = nuxt.$onCafeSocket(bind);
  });

  /**
   * ⚠ THE PARAMS WATCHER, and the one vue-router behaviour that makes it mandatory:
   * the component instance is **REUSED** when only params change, so `onMounted` and
   * `onBeforeUnmount` do **not** re-run for `/cafe/A/table/X → /cafe/A/table/Y`. Without
   * this the second table would render under a room joined for the first — the same
   * hazard the page's own `cafe|handle` watcher handles for `cafe.table`, and here it is
   * the room that matters.
   *
   * Keyed as one string because the two params travel together.
   */
  watch(
    () => `${cafeId.value}|${tableHandle.value}`,
    () => {
      // ⚠ LEAVE **BEFORE** ENTER, ALWAYS. Two table rooms at once is the one invariant
      // this whole file exists to hold.
      leave();

      // ⚠ AND THE FIRST WINDOW IS OWED AGAIN: a different table has no history loaded,
      // so `needsFirstWindow` is put back rather than left false by the first one.
      needsFirstWindow = true;

      void enter();
    },
  );

  /**
   * ⚠ THE LATE-RESOLUTION WATCHER, and it exists for the deep link.
   *
   * `/cafe/[cafeId]/table/[tableId]` carries the PUBLIC handle, and a reader who
   * arrives at one with an empty store has nothing to resolve it against — so `roomId`
   * is `null` on the first pass and only becomes known once `GET …/single` lands. This
   * is what turns that into an enter, so a screen never polls for it.
   *
   * ⚠ AND IT DOES **NOT** BLINDLY `enter()`, because a move and a resolution both change
   * this computed: entering without leaving first would put the client in TWO table
   * rooms, which is the one thing that must never happen. So the same question the params
   * watcher asks is asked here — «are we in a room that is not this one?» — and the
   * answer is settled before any emit.
   */
  watch(roomId, (id) => {
    if (entered !== null && entered !== id) leave();

    void enter();
  });

  onBeforeUnmount(() => {
    // ⚠ THE ORDER IS THE WHOLE TEARDOWN, and it is the reverse of the order things were
    // built: leave the rooms while the listeners are still attached, THEN release them,
    // THEN drop the registration.
    //
    // Releasing first would still be *safe* here (a `leave-room` emit needs no
    // listener), but `leave()` also clears the store's `activeThreadId`, and that is the
    // state every listener reads — so doing it with the listeners still attached is the
    // version where nothing can arrive into a thread that has already moved on.
    leave();

    unbind?.();
    unbind = null;

    stopWaiting?.();
    stopWaiting = null;

    instance = null;
  });

  return { enter, leave, resync: () => resync(roomId.value ?? "", false) };
}