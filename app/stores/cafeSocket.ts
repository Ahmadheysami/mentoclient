/**
 * The café socket's **transport** state, and nothing else.
 *
 * ## WHY A SEPARATE STORE, AND WHY NOT INSIDE `app/stores/cafe.ts`
 *
 * `app/stores/cafe.ts` is the one place a café *request* is made — eight
 * actions, one `CafeResult` envelope, the whole HTTP contract of the feature.
 * The socket is not an HTTP request: it has no endpoint, no envelope, no
 * `isCafeSuccess()` / `parseCafeFailure()` pair, and its lifecycle
 * (`connecting → connected → disconnected`) is driven by an EventEmitter rather
 * than by an awaited promise. Folding it in would mean a 40KB domain module
 * carrying a second, unrelated state machine, and every café screen that only
 * wants the cafés list would pull the socket's state into its own reactivity
 * graph.
 *
 * This is also **not** a generic store. It is named for the café socket, it
 * lives next to the café feature, and it will grow exactly one thing: whatever
 * the messaging layer needs to render "you are connected / you are not". It
 * holds no messages, no rooms and no participants — those belong to the
 * messaging layer the README's step 2 is building.
 *
 * ## ⚠️ THE INITIAL `status` IS `disconnected` BECAUSE OF HYDRATION, NOT BECAUSE
 * OF THE NETWORK
 *
 * SSR has no socket: this store is created on the server with its initial
 * values, they travel in Nuxt's payload, and the café header renders «قطع
 * اتصال» into the served HTML. On the client the plugin flips to `connecting`
 * during init, i.e. *before* hydration runs. A badge that read `status`
 * directly would therefore render two different words on the same first paint
 * and Vue would report a hydration mismatch.
 *
 * `disconnected` is the only honest initial value that cannot produce one: it is
 * literally true at every point of the server render — no socket exists there —
 * and it is a value the client may legitimately still hold. `CafeSocketStatusBadge`
 * gates its own render on `onMounted` for the rest of the problem, and it uses
 * this same pattern as `now` in `app/pages/cafe/index.vue` and the secure-chat
 * pin documented in the café README.
 *
 * ## ⚠️ `connectedAt` IS WRITTEN BY ONE ACTION AND IS NEVER COMPUTED
 *
 * `Date.now()` is legal in exactly one place in this app: inside an event
 * handler (or behind a `ref<number>()` set in `onMounted`). A clock *computed*
 * during SSR and recomputed at hydration is a text mismatch — this is the rule
 * the café README states for every screen. So `connectedAt` is not a `computed`,
 * not a getter and not derived from anything: it is written once, by
 * `markConnected()`, which the plugin calls from inside the socket's own
 * `connect` handler. Being client-only by construction, it can never enter the
 * SSR payload with a value the server did not produce.
 *
 * `connectedAt` is deliberately **not cleared** when the socket later drops:
 * the useful question after a drop is «since when», and a timestamp that
 * forgets the last good connection cannot answer it. `lastError` behaves the
 * other way round — set only by a failure, cleared by the next successful
 * connection (`markConnected()`) — so it always describes the **current** state
 * rather than a history.
 */
export type CafeSocketStatus = "connecting" | "connected" | "disconnected";

export const useCafeSocket = defineStore("cafeSocket", () => {
  const state = reactive<{
    status: CafeSocketStatus;
    /**
     * The socket's own failure sentence — `"Authenticate to log in"`,
     * `"invalid token"`, a transport error. Never the token itself, and never
     * the cookie: `connect_error` carries a message, and that message is
     * recorded; the credential it describes is not.
     */
    lastError: string | null;
    /** `Date.now()` at the most recent successful handshake. See the header. */
    connectedAt: number | null;
  }>({
    status: "disconnected",
    lastError: null,
    connectedAt: null,
  });

  /**
   * The status half of the lifecycle. It does not touch `lastError`: «the state
   * changed» and «there is a new reason» are different facts, and folding them
   * into one setter is how a refusal ends up displayed next to a healthy
   * connection.
   */
  function setStatus(status: CafeSocketStatus) {
    state.status = status;
  }

  /**
   * The one place the clock is read. Call it from inside a socket event handler
   * and from nowhere else.
   */
  function markConnected() {
    state.status = "connected";
    state.connectedAt = Date.now();
    setError(null);
  }

  /**
   * A refusal. `null` clears it, and `setStatus("disconnected")` is left to the
   * caller: `app:error` (`ICafeSocketError`) arrives on a socket that is still
   * perfectly connected — a table may refuse a message while the transport
   * carries other ones — so this action must not imply a drop.
   */
  function setError(message: string | null) {
    state.lastError = message;
  }

  return {
    state,
    setStatus,
    markConnected,
    setError,
  };
});