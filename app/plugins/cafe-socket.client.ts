import { io, type Socket } from "socket.io-client";
import type {
  ICafeClientToServerEvents,
  ICafeServerToClientEvents,
} from "~/types/cafe";

/**
 * `ListenEvents` is what the **server** sends us, `EmitEvents` is what **we**
 * send — the order is `Socket<ServerToClient, ClientToServer>`, and typing both
 * sides is the point: `socket.on("cafe:table:send-message:recieve")` is
 * checked against `app/types/cafe.ts` (including that misspelling, which is the
 * backend's) and `socket.emit("cafe:typo")` stops compiling. An untyped
 * `Socket` accepts any string as an event name, so every listener in the
 * messaging layer would be a guess the compiler cannot catch.
 *
 * ⚠ EXPORTED, because the messaging composable has to name it. It is a TYPE-only
 * export, so nothing of this file reaches the server bundle and nothing of the
 * socket does either; what the composable gets is a type, and the instance
 * always comes from `getCafeSocket()` / `onCafeSocket()` at call time.
 */
export type CafeSocket = Socket<
  ICafeServerToClientEvents,
  ICafeClientToServerEvents
>;

/**
 * A consumer waiting for the current socket — and for every socket that replaces it.
 *
 * ⚠ The `null` is not an edge case: this handler is called immediately with whatever
 * is current, which on a signed-out reader is nothing at all.
 */
export type CafeSocketListener = (socket: CafeSocket | null) => void;

/**
 * The `/cafe` Socket.IO connection.
 *
 * ## WHAT IS ACTUALLY WRONG WITH A CONNECTION THAT NEVER OPENS
 *
 * Measured against the running backend, with a standalone `socket.io-client`:
 * the `/cafe` namespace, the URL and the `websocket` transport are all correct
 * and the upgrade reaches the namespace's own middleware. The only reason a
 * handshake is refused is the credential:
 *
 * - `auth: { token: "" }` → `connect_error: "Authenticate to log in"`
 * - `auth: { token: "<anything invalid>" }` → `connect_error: "invalid token"`
 *
 * So this file is about **getting a usable token into `auth`** and making the
 * connection's state observable. ⚠️ A plain `transport=polling` HTTP `GET` of
 * `/cafe/?EIO=4` answers 404 and looks like a routing failure; it is not. Do
 * not "fix" the transport.
 *
 * ## WHY THE TOKEN COMES FROM `POST /api/cafe/socket-ticket`
 *
 * A socket needs its credential in JS, and the session cookie is a 30-day
 * `httpOnly` bearer — which is exactly why `POST /api/auth/check-token` is not
 * the source. It used to echo the raw cookie as `{ has, value }`, which shipped
 * the bearer into Nuxt's SSR payload, inlined in the served HTML. That field is
 * gone and stays gone. The café-namespaced ticket route exists for this one
 * caller; its own header explains that the real replacement is a short-lived,
 * single-purpose ticket minted by the backend `Server/` repo, and that when it
 * lands **only that route changes**.
 *
 * ## WHY AN EMPTY TICKET IS NOT AN ERROR, AND WHY `io()` IS NOT CALLED
 *
 * `{ token: "" }` means «this reader has no session». There is nothing to
 * authenticate with, so opening a websocket would only earn an
 * `Authenticate to log in` refusal and — worse — make a signed-out visitor's
 * header say "something failed" instead of the truthful "not connected". The
 * distinction is the reason the ticket route answers 200 rather than 401, and
 * it is honoured here by not connecting at all and by leaving `lastError` alone:
 * having no session is not a failure, it is a state.
 *
 * ## WHY THE SOCKET IS A `shallowRef` AND NOT A `ref`
 *
 * A `Socket` is a third-party object holding live emitters, send/receive buffers
 * and a manager. A deep `ref` would hand Vue a **reactive proxy** of it, and a
 * proxied socket is a socket whose `this` is not the socket — which is how
 * `component-emitter` internals and Socket.IO's own `destroy()`/`onclose()`
 * machinery end up reading a proxy's properties as plain values written by the
 * original. `app/components/Notification/Handler.vue` carries the same note in
 * full; it cost a long debugging session there, and it was invisible for a
 * while *because* the value was always `null`.
 *
 * ## WHY `getCafeSocket` IS A FUNCTION AND NOT THE VALUE
 *
 * It used to be `getCafeSocket: socketInstance` — captured **by value** at
 * plugin-registration time, which is before `io()` has ever run, so every
 * consumer saw `null` forever and no listener could ever be attached. The
 * function-getter shape (the one `plugins/notification-socket.client.ts` uses
 * for `getNotifSocket`) reads the closure at call time, so it answers for the
 * socket as it is now, including "not built yet".
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const status = useCafeSocket();

  const socket = shallowRef<CafeSocket | null>(null);

  /**
   * The handshake currently in flight, so two callers arriving together cannot
   * both pass the "already have one?" guard below and build two sockets that
   * fight over one namespace (rule 13).
   */
  let pending: Promise<CafeSocket | null> | null = null;

  /**
   * Releases the listeners attached by the most recent `bindLifecycle`, or
   * `null` while nothing is bound.
   *
   * `socket.off()` alone cannot release the whole lifecycle: the
   * `reconnect_attempt` listener lives on `instance.io` — the **manager** — and
   * a manager can outlive the socket built on it. `destroy()` removes the
   * socket's own subscriptions but leaves it in the manager's `nsps`, and a
   * manager with another active namespace (the app-wide notification one)
   * stays connected and keeps emitting manager events after the café socket is
   * gone. A stale `reconnect_attempt` is what would flip the café store to
   * `connecting` on the notification namespace's next reconnect — with no café
   * socket left to ever correct it. The handler refuses that stale call on its
   * own now, but the listener still has to come off: `openSocket()` calls this
   * before it builds a replacement, and `releaseIfTerminal()` calls it the
   * moment a terminal instance dies.
   */
  let unbind: (() => void) | null = null;

  /**
   * Everyone waiting for the current socket, and for every socket that replaces it.
   *
   * ⚠ **WHY A REGISTRATION LIST AND NOT «THE COMPOSABLE CALLS
   * `connectCafeSocket()`».** A terminal `io server disconnect` or a refused namespace
   * handshake makes `releaseIfTerminal()` drop the instance, and the next
   * `connectCafeSocket()` builds a **replacement**. Every listener bound to the old one
   * went with it — so a consumer that bound to the instance it was handed goes silently
   * deaf after the first kick, which is exactly the failure
   * `app/pages/cafe/README.md` already records as unbuilt («stays قطع اتصال until a
   * full page reload»). A list turns «every instance, including replacements» into a
   * one-line contract, and it is the reason the messaging composable can rebind instead
   * of assuming one permanent instance.
   *
   * A `Set`, not an array: `onCafeSocket` returns its own unsubscribe, and a handler
   * that unsubscribes itself mid-notification must not be visited twice.
   */
  const listeners = new Set<CafeSocketListener>();

  /**
   * Tell every listener what the current socket is.
   *
   * ⚠ FIRE-AND-FORGET, AND SWALLOWED ON PURPOSE: this runs inside `openSocket()` and
   * inside `releaseIfTerminal()`, so a handler that throws would abort a socket swap
   * halfway and leave the app with no socket AND no idea why. A listener is somebody
   * else's code — the one that matters here is a screen that has already gone away —
   * and it must not be able to take the transport down with it. Each handler is called
   * inside its own `try`, so one bad listener does not silence the rest either.
   */
  function notify(): void {
    // ⚠ COPIED FIRST: a handler may unsubscribe itself while it is being called.
    for (const listener of [...listeners]) {
      try {
        listener(socket.value);
      } catch {
        // Deliberately empty, and the whole point of the `try`. See the header: one
        // consumer's failure is not the transport's failure, and this file must keep
        // handing out sockets either way.
      }
    }
  }

  /**
   * Register for the current socket and for every replacement of it.
   *
   * The handler is called **immediately** as well as on every swap, so a caller that
   * arrives after the socket was built is not deaf until the next one. That immediate
   * call is also what makes a composable's `onMounted` late arrival work: the plugin
   * connects during init, long before any page mounts.
   *
   * Returns the unsubscribe. A component holds it and calls it in `onBeforeUnmount`,
   * which is the only thing keeping a closed screen's handler out of this list.
   */
  function onCafeSocket(listener: CafeSocketListener): () => void {
    listeners.add(listener);

    listener(socket.value);

    return () => {
      listeners.delete(listener);
    };
  }

  /**
   * The ticket, or `""`.
   *
   * ⚠️ The token itself is never logged, stored or re-thrown. This route's
   * answer is a bearer, and the one safe thing to say about a failed read is
   * that there is no token to use.
   *
   * `useRequestFetch()` matches the café store's idiom — `app/stores/cafe.ts`
   * takes one on the first line of every action. This is a `.client.ts` plugin,
   * where it degrades to plain `$fetch`, so the call is harmless here and still
   * correct if this code ever moves server-side, where it *would* forward the
   * incoming request's cookies instead.
   *
   * A thrown read is swallowed into `""` on purpose: a ticket that could not be
   * fetched and a reader with no session produce the same honest outcome —
   * do not connect — and the alternative is a rejection travelling into a
   * component's `onMounted` with nothing to catch it.
   */
  async function readTicket(): Promise<string> {
    try {
      const requestFetch = useRequestFetch();
      const ticket = await requestFetch<{ token?: string }>(
        "/api/cafe/socket-ticket",
        { method: "post" },
      );

      return typeof ticket?.token === "string" ? ticket.token : "";
    } catch {
      return "";
    }
  }

  /**
   * The lifecycle, bound once per socket.
   *
   * The handlers are named and kept in this scope so the `unbind` closure this
   * call stores can remove exactly the functions that were attached — from the
   * namespace and from its manager — before a replacement socket is built. One
   * socket therefore carries one copy of each handler, and a destroyed socket's
   * stale `reconnect_attempt` listener cannot fire on a successor's manager
   * (rule 13).
   *
   * `connect_error` is where `lastError` comes from, and its `message` is safe
   * to keep: the backend answers `"invalid token"` / `"Authenticate to log in"`,
   * which are refusals, not credentials. The credential is never inside it.
   */
  function bindLifecycle(instance: CafeSocket) {
    function onConnect() {
      status.markConnected();

      // ⚠⚠️ `cafe:join-channels-page` — ⚠️ **THE TYPO IS THE SERVER'S** (`chennels`
      // with two `n`s in the LEAVE event; this one is spelled `channels`). It is
      // reproduced verbatim because the room it joins is `channels-page:<userId>` and
      // that is the only event that puts this client in it.
      //
      // Why the PLUGIN and not a screen: the room is what feeds
      // `cafe:table:receive-new-message` (§14.3), which is the unread badge for EVERY
      // café list, so «who asks for it» must not be a question any screen has to
      // answer. It is emitted from a successful handshake and never by a page.
      //
      // ⚠️ ON **EVERY** `connect`, WITH NO LATCH — and §19.6 is what makes that the
      // contract rather than a nicety: the doc lists this emit **together with**
      // `cafe:join-room` and `cafe:table:join-room` as the re-emit an ordinary
      // reconnect performs. Room membership belongs to the SOCKET, and socket.io keeps
      // the client-side instance across a drop while the **server-side** socket is
      // brand new and in no room at all — so an emit guarded per *instance* fires
      // exactly once and this client never re-enters `channels-page:<userId>` again:
      // `cafe:table:receive-new-message` stops arriving for the rest of the session and
      // every unread badge in `/cafe`, `/cafe/joined` and the thread header freezes at
      // whatever it held, while the badge still says «متصل». A replacement instance
      // (§ `onCafeSocket`) was never a substitute for this: it only arrives after a
      // terminal kick, and the ordinary drop — the common case — never builds one.
      //
      // ⚠️ EMITTING PER CONNECTION IS SAFE, which is why no per-connection guard was
      // put here either. §10.3 gives the event **no ack and no side effect beyond the
      // join**, and a room join a socket is already in is a no-op — so `connect` is
      // already the once-per-connection latch, and adding a second one would only
      // restate it and give the next reader a place to reintroduce the bug.
      instance.emit("cafe:join-channels-page");
    }

    function onDisconnect(reason: string) {
      // `lastError` is deliberately NOT cleared here. While the socket is down,
      // an un-superseded refusal is still the CURRENT explanation, and wiping it
      // would leave «قطع اتصال» with nothing to say. The next successful
      // connection clears it, in `markConnected` — a drop is not a fresh state,
      // a reconnect is.
      status.setStatus("disconnected");

      // `io server disconnect` is the ONE reason socket.io destroys the
      // instance before emitting (so `active` is already `false`), which means
      // the server kicked us and this socket will never reconnect on its own.
      // Every other reason keeps the instance active for the manager's loop.
      if (reason === "io server disconnect") releaseIfTerminal(instance);
    }

    function onConnectError(error: Error) {
      status.setStatus("disconnected");
      status.setError(error?.message ?? null);

      // A namespace refusal (`CONNECT_ERROR` packet) also arrives *after*
      // `destroy()`, i.e. terminal; but the same event fires from the manager's
      // `error` on a socket that is still active and still retrying.
      // `releaseIfTerminal` tells the two apart by `instance.active`.
      releaseIfTerminal(instance);
    }

    // The namespace emits only `connect` / `disconnect` / `connect_error`;
    // reconnection is the **manager's** event, so it has to be read from
    // `instance.io`. Without it the badge would sit on «قطع اتصال» through the
    // entire backoff window even though a retry is under way.
    function onReconnectAttempt() {
      // The manager is shared with `/notification`, so it outlives a destroyed
      // café socket and keeps emitting this. Only THIS plugin's current, live
      // socket may read as «در حال اتصال» — a released instance has
      // `socket.value === null`, a destroyed one `active === false`, and
      // neither may pulse the badge forever.
      if (socket.value !== instance || !instance.active) return;

      status.setStatus("connecting");
    }

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    instance.on("connect_error", onConnectError);
    instance.io.on("reconnect_attempt", onReconnectAttempt);

    unbind = () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.off("connect_error", onConnectError);
      instance.io.off("reconnect_attempt", onReconnectAttempt);
    };
  }

  /**
   * The one exit for an instance socket.io has TERMINATED — a refused
   * namespace handshake or an `io server disconnect`. Both run `destroy()`
   * **before** the event reaches us, so by the time a handler runs the
   * instance is already inactive, while `unbind` (and the manager it points
   * at) is still standing.
   *
   * Releasing here detaches those listeners and drops the reference, so the
   * badge stops claiming «در حال اتصال» and `getCafeSocket()` answers `null`
   * instead of a socket that can never send. The `socket.value === instance`
   * guard keeps a newer socket from being clobbered, and the `active` guard
   * keeps an ordinary drop alone — that socket is still in the manager's pool
   * and reconnecting it is exactly what must keep working.
   */
  function releaseIfTerminal(instance: CafeSocket) {
    if (socket.value !== instance || instance.active) return;

    unbind?.();
    unbind = null;
    socket.value = null;

    // ⚠ TOLD ABOUT THE LOSS, NOT ONLY ABOUT THE GAIN. A consumer that bound to this
    // instance has to know it is now deaf — that is what makes it rebind onto the
    // replacement `openSocket()` is about to build.
    notify();
  }

  async function openSocket(): Promise<CafeSocket | null> {
    // Released FIRST, so it happens on *every* path out of this function —
    // including the early return below, which builds no replacement. The
    // previous socket is inactive by now (`connectCafeSocket` found none
    // alive), but its binding may not be gone: the `reconnect_attempt` handler
    // lives on the manager, and another namespace can keep that manager
    // connected after the socket died. A terminal instance already released
    // its own binding when it died (`releaseIfTerminal`); what is left for
    // this path to remove is any binding still standing when no replacement
    // is built.
    unbind?.();
    unbind = null;

    const token = await readTicket();

    // Deliberately *after* the read, never before it. Pinia restores its state
    // from the SSR payload during the synchronous plugin phase; a write made
    // before that would be overwritten by the payload, and a write made from
    // inside an `await` is structurally too late for it.
    if (!token) {
      // Symmetry with the `catch` below and with `releaseIfTerminal`: every
      // path that ends without a socket leaves `socket.value` null, so
      // `getCafeSocket()` never answers with an instance nothing is bound to.
      // In the common signed-out case the value is already `null` — this is a
      // no-op there, and only matters when a previous socket died un-released.
      socket.value = null;
      status.setStatus("disconnected");

      // ⚠ TOLD EVEN THOUGH NOTHING WAS BUILT: a consumer's teardown path is exactly
      // where a stale instance would otherwise be left attached, and this is the one
      // branch where it is reachable without a terminal event having fired first.
      notify();

      return null;
    }

    status.setStatus("connecting");

    try {
      const instance: CafeSocket = io(`${config.public.base}/cafe`, {
        // ⚠️ `websocket` only, and that is correct: the namespace is reached over
        // the upgrade path. Do not add `polling` because a plain HTTP `GET` of
        // `/cafe/?EIO=4` answers 404 — that GET proves nothing about the socket.
        transports: ["websocket"],
        auth: { token },
      });

      bindLifecycle(instance);
      socket.value = instance;

      // ⚠ IMMEDIATELY, NOT ON `connect`. A listener has to be attached to this instance
      // before its handshake resolves, or the first `join-room` emit and the first
      // `join-new-user` broadcast arrive with nobody bound. `onCafeSocket`'s own
      // immediate call covers a consumer that registered before this socket existed.
      notify();

      return instance;
    } catch (error) {
      // `io()` itself throws only on a malformed URI, but a plugin that can
      // throw is a plugin whose `onMounted` rejects, so the answer is still
      // "no socket", not an exception in the caller's face.
      socket.value = null;
      status.setStatus("disconnected");
      status.setError(error instanceof Error ? error.message : null);

      // ⚠ Symmetry with every other path that leaves `socket.value` null. See above.
      notify();

      return null;
    }
  }

  /**
   * Connect once. Calling it again while a socket is alive returns that same
   * socket rather than destroying it and building a second one — the previous
   * version did exactly that, so two callers (two screens, or a screen and a
   * layout) silently tore down each other's connection.
   *
   * It never rejects: `null` is a complete answer, and means «there is no
   * socket right now», which is what a caller has to be able to render.
   */
  function connectCafeSocket(): Promise<CafeSocket | null> {
    const existing = socket.value;

    // ⚠️ `existing.active`, NOT `existing.closed`. In socket.io-client v4.8
    // `closed` is not a property of `Socket` at all — it does not exist on the
    // type and is `undefined` at runtime, so a `!socket.closed` guard compiles
    // to a constant `true` and never guards anything. `active` is the public
    // equivalent (`!!this.subs`): true while the socket is still subscribed to
    // its manager and will (re)connect, false once `disconnect()`/`close()` has
    // taken it out of the pool. That is the test that matters here, because an
    // `io server disconnect` leaves a socket object behind that will never
    // reconnect on its own and must be replaced rather than returned.
    if (existing?.active) return Promise.resolve(existing);

    if (pending) return pending;

    pending = openSocket().finally(() => {
      pending = null;
    });

    return pending;
  }

  /**
   * Connect on init, once, for the whole app.
   *
   * The plugin is app-wide, so this runs on every route — which is the point of
   * a connection layer and the reason the status store exists at all: the
   * badge on `/cafe` has something real to read instead of a per-screen
   * watcher. On a route with no session `openSocket()` returns `null` without
   * opening a socket, so the cost to a signed-out reader is one cheap
   * same-origin `POST`.
   *
   * `void`, and deliberately not `await`: plugin init is synchronous and must
   * stay that way, and `connectCafeSocket()` resolves with `null` rather than
   * rejecting, so there is no rejection to leave unhandled.
   */
  void connectCafeSocket();

  return {
    provide: {
      connectCafeSocket,
      getCafeSocket: () => socket.value,
      /**
       * ⚠ THE REPLACEMENT CONTRACT, and the only addition to this file's surface.
       *
       * A consumer registers once and is handed the current socket immediately and
       * again for every instance that replaces it — which is what makes
       * `useCafeThreadSocket` able to rebind instead of going deaf after the first
       * terminal kick. See `onCafeSocket`'s header for why a hook and not
       * «call `connectCafeSocket()` yourself».
       */
      onCafeSocket,
    },
  };
});