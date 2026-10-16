<script setup lang="ts">
import type {
  ICafeTableMessage,
  ICafeTableParticipant,
  ICafeWindow,
} from "~/types/cafe";

import { faDate, faTimeOfDay } from "~/utils/fa";

/**
 * `/cafe/[cafeId]/table/[tableId]` — the conversation itself, Screen B of
 * `docs/design/cafe-ui.webp`.
 *
 * ## WHY `cafeMenu: false` IS THE ONE FLAG THIS PAGE EXISTS TO SET
 *
 * Every other café screen is a list, and a list is happy to have the black
 * pill pushed up by 88px: it is meant to scroll under it. A conversation is
 * not. The composer has to sit on the **bottom edge of the viewport** — the
 * reference draws it there, and a native messenger whose input row floats
 * above a navigation bar is not a messenger. So this page claims the full
 * height from the layout, exactly as `layouts/cafe.vue`'s contract documents,
 * and the pill does not render. It is the absence of that pill, more than
 * anything else, that makes the screen read as Screen B rather than as Screen A
 * with bubbles in it.
 *
 * ## WHERE THE TABLE COMES FROM
 *
 * One read: `useCafe().fetchTable(cafeId, tableId)`, awaited **in the setup
 * body** rather than in `onMounted`, so the server's HTML already carries the
 * conversation and the Pinia payload carries it to the client's first paint. A
 * thread that draws its own header and membership band a frame late has already
 * shown the reader the wrong screen.
 *
 * ⚠️ **THE ROUTE PARAM IS THE PUBLIC HANDLE, AND THAT IS THE STORE'S PROBLEM.**
 * `/cafe/[cafeId]/table/[tableId]` carries the `ch_…` / `cv_…` / `tb_…` handle a
 * café page can print and a reader can type, while `GET /table/:cafeId/:tableId/
 * single` matches the table's INTERNAL uniqid (`app/types/cafe.ts` rule 3).
 * `fetchTable` resolves one to the other itself — by the id a list already holds,
 * and otherwise by one throwaway read of the café's tables — so this page passes
 * `route.params.tableId` through untouched. That resolution deliberately does
 * **not** populate `cafe.tables`, so nothing here reads that list to find the row
 * it is already holding.
 *
 * ## WHAT IS **NOT** WIRED HERE, AND WHY NOTHING ON THIS SCREEN PRETENDS OTHERWISE
 *
 * Message history, sending, the `/cafe` socket, uploads and read receipts are the
 * messaging wave. There is no messages endpoint in `stores/cafe.ts`, and this page
 * does not add one, proxy one or emulate one with a local array. So two things
 * follow, and both are deliberate:
 *
 * - the transcript is **empty** and draws `CafeMessageList`'s own empty state,
 *   which is the truth about a conversation whose history has not been read yet;
 * - the composer is drawn **`disabled`**, with a Persian sentence saying why,
 *   instead of stamping a fake `local-*` message into a list on submit. A bubble
 *   that says «sent» and is not is the worst possible lie in a messenger, and the
 *   local append this file used to do is exactly that.
 */

definePageMeta({
  // See the header: this flag is what removes `CafeBottomMenu` and gives the
  // composer the bottom edge. Absent anywhere else in the feature.
  cafeMenu: false,
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "گفتگو",
});

const route = useRoute();

/**
 * ⚠️ `route.params.x` is `string | string[]` in vue-router's types — an array for
 * a repeatable param. Nothing here repeats, so the first value is the only one
 * that can be right, and joining them would invent a handle matching nothing.
 *
 * `""` rather than `undefined` for the same reason the store guards for it: an
 * absent param would otherwise reach `fetchTable` as the string `"undefined"` and
 * go out on the wire as `/api/cafe/table/undefined/undefined/single`.
 */
function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const cafeId = computed(() => param(route.params.cafeId));
const tableId = computed(() => param(route.params.tableId));

const cafe = useCafe();
const user = useUser();

/**
 * The reader's own `userId` — the auth middleware has already read it, on both
 * sides of the render, so this is populated during SSR too. It is the key every
 * membership question below is asked with: `subscribe` rows are keyed on
 * `userId`, and `CafeMessageList` colours a bubble by comparing `senderId` to it.
 */
const myId = computed(() => user.state.user?.userId);

/** The screen this one was opened from — the café's table list, which exists. */
const backTo = computed(() => `/cafe/${cafeId.value}/table`);

/* --------------------------------------------------------------- the one read -- */

/**
 * The single request this screen makes.
 *
 * Both ids are the PUBLIC ones straight off the route; `fetchTable` turns the
 * table's handle into the internal uniqid itself (see `resolveTableId`), which is
 * why this function never has to know which of the two the URL is holding.
 */
async function loadTable() {
  await cafe.fetchTable(cafeId.value, tableId.value);
}

await loadTable();

/**
 * One watcher over BOTH params, keyed on the pair as a single string.
 *
 * vue-router re-uses the component instance when only the params change, so
 * `setup` does not run again on a client navigation from one table to another —
 * without this, `/cafe/A/table/X` → `/cafe/A/table/Y` would keep showing table X
 * under table Y's address. Scoped as one string because the two params travel
 * together: navigating away and back within the same café changes `tableId`
 * alone, and the store's own scope is the same `cafe|handle` pair, so one watcher
 * and one reset cover every move.
 */
watch(
  () => `${cafeId.value}|${tableId.value}`,
  (scope, previous) => {
    if (scope === previous) return;

    // ⚠️ THE RESET IS THE POINT, NOT A BELT-AND-BRACES ONE.
    //
    // The store scopes `table` by its own ids, so the new fetch is never
    // satisfied by the old table's answer — nothing can be served stale. What
    // scope CANNOT do is clear the old row while the new one is in flight:
    // between this navigation and the answer, `cafe.table` still holds the
    // previous table, so the header would print the previous table's name and
    // its membership band under the new address. Forgetting the resource first
    // is what makes the skeleton the honest picture of that gap.
    cafe.reset("table");

    // The dismissal belongs to the table it was made on.
    stripDismissed.value = false;

    void loadTable();
  },
);

/* ------------------------------------------------------------- three screens -- */

/**
 * Loading, refusal and empty — three different pictures off three different flags,
 * and none of them inferred from whether the row happens to be there. `errors` and
 * not `loaded`, because a refusal sets `loaded` too — it is a known answer — and
 * only the Persian sentence tells the two apart.
 *
 * ⚠️ `cafe.table` IS READ ONCE, HERE, AND THE TEMPLATE USES `currentTable`.
 */
const isLoading = computed(() => cafe.pending.table);
const loadError = computed(() => cafe.errors.table);
const currentTable = computed(() => cafe.table);

/**
 * ⚠️ THE NULL ROW IS NOT A DOUBLE-SPELLING OF THE REFUSAL.
 *
 * An unknown table arrives as HTTP 200 with **no** `table` at all — the store turns
 * that success-with-nothing into `ERR_TABLE_NOT_FOUND` itself — and it turns a
 * successful answer whose `table` was `null` into the same thing. Both must land on
 * the error block: letting the null through renders a header with no name, no
 * membership and a composer under a conversation that does not exist, which is the
 * one thing §3.2's `if (!res.cafe) showNotFound()` exists to prevent on the café
 * screen.
 */
const showError = computed(() => loadError.value !== null || currentTable.value === null);

/**
 * The `#action` of the refusal block: drop the answer and the sentence, then ask
 * again, so the screen leaves the error for the skeleton instead of showing a
 * refusal next to a request that is already on its way.
 */
function retry() {
  cafe.reset("table");

  void loadTable();
}

/* -------------------------------------------------------------------- clock -- */

/**
 * The screen's one clock reading, taken once on mount and refreshed on a tick.
 *
 * `CafeMessageTimestamp` inside the bubbles answers «امروز» and «۳ دقیقه پیش» —
 * both questions about *now*. Rendered from the server's clock and again from the
 * phone's, a transcript is a visible flash of a whole list re-labelling itself on
 * the first paint. Undefined until mount, so the server and the client's first
 * paint agree and only a mounted client may say «همین الان».
 *
 * ⚠️ `Date.now()` IS LEGAL **ONLY** HERE AND IN EVENT HANDLERS. The two window
 * gates below are render concerns, so they read this ref and nothing else — the
 * server cannot know when "now" is on the client's phone, and answering anyway is
 * the hydration mismatch this ref exists to prevent.
 *
 * The tick exists because a window can ELAPSE while the reader is sitting on the
 * screen: a secure-chat band that stays up after its window closed, or a composer
 * that stays up after the sending window shut, is the UI disagreeing with the
 * server. Fifteen seconds is finer than any window this feature schedules
 * (they are minute- and hour-scale) and coarser than a second-by-second re-render
 * of the header, and `onBeforeUnmount` clears it — a 15s interval that outlives
 * the screen is a 15s interval that fires forever on a client that navigated away.
 */
const WINDOW_TICK_MS = 15_000;

const now = ref<number>();

let windowTick: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  now.value = Date.now();

  windowTick = setInterval(() => {
    now.value = Date.now();
  }, WINDOW_TICK_MS);
});

onBeforeUnmount(() => {
  if (windowTick !== undefined) {
    clearInterval(windowTick);
    windowTick = undefined;
  }
});

/* ------------------------------------------------------------------ windows -- */

/**
 * Three answers rather than two, and the third is the whole reason the clock
 * above is a `ref`.
 *
 * - **closed** is a FACT the payload states — no window, or `enabled` absent or
 *   false. Nothing to wait for, so the server may say so.
 * - **unknown** is the state a window with `enabled: true` is in before the
 *   client has a clock. Rendering it as either state is a confident answer the
 *   server cannot have.
 * - **open** and the rest are the only two that need `now`.
 */
type WindowState = "unknown" | "open" | "closed";

/**
 * Is a scheduled window open at `at`?
 *
 * ⚠️ **`startAt` / `endAt` ARE MILLISECOND EPOCH NUMBERS, NOT DATE STRINGS.**
 * `docs/Cafe-Api-Docs.md` §3.2 says so outright (`عدد (ms epoch) هستند، نه رشته‌ی
 * تاریخ`), so they are compared against `Date.now()` and go nowhere else: no
 * `/ 1000` (which would put a window that closes next Tuesday in January 1970), no
 * date-string parsing, and no formatter left to guess their unit.
 *
 * An absent `startAt` means "no lower bound" and an absent `endAt` means "no upper
 * bound": the backend stores `null` for an open-ended window, and treating a
 * missing bound as zero would close a window that is running right now.
 */
function isWindowOpen(at: number, window?: ICafeWindow | null): boolean {
  if (window?.enabled !== true) return false;

  const startAt = window.startAt;
  const endAt = window.endAt;

  if (startAt !== undefined && startAt !== null && at < startAt) return false;
  if (endAt !== undefined && endAt !== null && at > endAt) return false;

  return true;
}

/**
 * The same question this page asks twice — once about `secureChat`, once about
 * `messageSendingEnabled` — so it is asked by ONE helper.
 *
 * The two fields are the same shape with the same two millisecond bounds and the
 * same `enabled` flag, written by the same endpoint
 * (`PUT /table/:tableId/mse-sc?action=secure-chat | mse`), and the backend
 * broadcasts their changes as the same pair of socket events
 * (`cafe:table:secure-chat-status`, `cafe:table:message-sending-status`). Two
 * copies of this predicate is two copies to get out of step, and the one that
 * stays open is the one that leaks a window nobody is inside of.
 *
 * The `at === undefined` branch is the clock guard, not part of the window's own
 * rules: an enabled window is genuinely undecidable until the client has a clock.
 */
function windowState(at: number | undefined, window?: ICafeWindow | null): WindowState {
  if (window?.enabled !== true) return "closed";
  if (at === undefined) return "unknown";

  return isWindowOpen(at, window) ? "open" : "closed";
}

/**
 * The secure-chat window — and ONLY the pinned notice, nothing else.
 *
 * ⚠️ **THE MESSAGES ARE DRAWN IN EVERY CASE.** `secureChat` does not gate
 * `CafeMessageList`, and no state of this window may hide a transcript. An earlier
 * wave read the field as «the room's transcript does not survive, so stop drawing
 * it» and hid the list whenever the window was not open. That was wrong in the
 * ordinary direction: for the overwhelming majority of tables there IS no secure
 * chat at all, and `windowState` answers `closed` for «never configured» exactly
 * as it does for «configured and elapsed». So the rule blanked the conversation
 * of every normal table and labelled it «گفتگوی امن به پایان رسید» — a sentence
 * about a window that table never opened.
 *
 * What this field IS for, per the product rule: when the window is open, the
 * conversation is pinned as temporary, with the span it runs. When it is closed,
 * the table simply shows its content.
 *
 * The backend still soft-deletes the room's messages at the end of a window and
 * broadcasts `cafe:table:delete-message:bulk:response`; until that broadcast
 * lands the messages we were sent are the truth, and the socket wave removes them
 * on the server's word rather than this screen guessing at it.
 */
const secureChat = computed<WindowState>(() =>
  windowState(now.value, currentTable.value?.secureChat),
);

/**
 * Whether this table has a secure-chat window **at all** — the question
 * `WindowState` cannot answer, because it folds «not configured» into `closed`.
 *
 * Every decision that must treat «never configured» and «configured, elapsed»
 * differently asks THIS, and never `secureChat === "closed"`. Both are `true` for
 * an ordinary table today, which is precisely the confusion this separates.
 */
const secureChatConfigured = computed<boolean>(
  () => currentTable.value?.secureChat?.enabled === true,
);

/**
 * The whole pinned SENTENCE, not a fragment of one.
 *
 * A pinned notice that says a conversation is temporary without saying WHEN is
 * only half the fact the reader needs — the window's end is the moment the content
 * goes away, so the end is the half that must never be left out.
 *
 * It is a whole sentence rather than a span spliced into a fixed frame because
 * the frame's grammar depends on the span: «… از ۱۴:۳۰ تا ۱۶:۰۰ حذف می‌شود» and
 * «… در پایان گفتگو حذف می‌شود» are different sentences, and a fragment would
 * force one grammar onto a window it does not fit.
 *
 * - Both bounds on one Tehran day → times alone. Repeating the Jalali date on
 *   both sides of a two-hour gap is noise, and the day is already the one the
 *   reader is in.
 * - Bounds on different days → both dates, a comma between date and time, which
 *   is where Persian puts it. The year is repeated on purpose: a window may span
 *   a year boundary, and «تا ۵ فروردین» beside «۳۱ اسفند» is a year the reader
 *   has to guess.
 * - A bound missing → the backend's `null` for an open-ended window. Said as
 *   «در پایان گفتگو», which is what an unscheduled end actually is, rather than
 *   the false «تا ۱۶:۰۰» a formatter's blank would have produced.
 * - Both missing → an enabled window with no bounds at all, which is a real
 *   answer and gets real words instead of an empty sentence.
 *
 * `""` only when the window is off entirely, and the band is not drawn then — so
 * no reader ever sees a pinned notice with nothing pinned in it.
 */
const secureChatNotice = computed<string>(() => {
  const window = currentTable.value?.secureChat;
  if (window?.enabled !== true) return "";

  const startAt = window.startAt;
  const endAt = window.endAt;

  const from =
    startAt === undefined || startAt === null ? "" : faTimeOfDay(startAt);
  const to = endAt === undefined || endAt === null ? "" : faTimeOfDay(endAt);

  const OPEN_ENDED = "گفتگوی امن فعال است؛ محتوای این میز در پایان گفتگو حذف می‌شود";

  if (from === "") {
    return to === ""
      ? OPEN_ENDED
      : `گفتگوی امن فعال است؛ محتوای این میز تا ${to} حذف می‌شود`;
  }

  if (to === "") {
    return `گفتگوی امن فعال است؛ محتوای این میز از ${from} حذف می‌شود`;
  }

  // `faDate` renders through one formatter in one zone, so an equal answer is a
  // real fact about the calendar day and not two dates that merely look alike.
  const sameDay = faDate(startAt) !== "" && faDate(startAt) === faDate(endAt);

  const span = sameDay
    ? `از ${from} تا ${to}`
    : `از ${faDate(startAt)}، ${from} تا ${faDate(endAt)}، ${to}`;

  return `گفتگوی امن فعال است؛ محتوای این میز ${span} حذف می‌شود`;
});

/* ----------------------------------------------------------------- subtitle -- */

/**
 * ⚠️ **THE MEMBER COUNT IS GONE, AND IT WAS NEVER AVAILABLE ON THIS ROUTE.**
 *
 * The design wave's «۶ عضو • ۳ نفر آنلاین» came from the fixture's roster. The
 * single-table payload has no roster: `GET /table/:tableId/users` is the endpoint
 * that lists members with presence, the store does not read it, and this wave does
 * not add it. Worse, the one membership field that IS on this answer —
 * `ICafeTableView.subscribe` — **cannot be counted**: the backend's pipeline
 * `$unwind`s `subscribe` WITH `preserveNullAndEmptyArrays` (one document per
 * active participant), but `getSingleTable` keeps only the FIRST of those
 * documents and sends that object, so `subscribe` arrives as ONE participant and
 * the store normalizes it to a one-element array (see `ICafeSingleTableResponse`
 * and `normalizeSubscribe` in `stores/cafe.ts`). So `subscribe.length` is `1` for a
 * full room and for an empty one, and a count built on it is either «۱ عضو» on a
 * busy table or «۰ عضو» on a live one.
 *
 * `messageSecunce` — the table's TOTAL message count, misspelled in the backend
 * model and reproduced here verbatim — is the one number this endpoint does
 * state. It is a different fact from what the subtitle used to say, and it is
 * true.
 */
const subtitle = computed<string | undefined>(() => {
  const total = currentTable.value?.messageSecunce;

  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) return undefined;

  return `${faNumber(total)} پیام`;
});

/* -------------------------------------------------------------- membership -- */

/**
 * The reader's own participant record, out of the one membership field on this
 * answer.
 *
 * ⚠️ **AND IT IS ONE ROW, NOT THE ROSTER.** The wire carries a SINGLE participant
 * object in `subscribe` — `getSingleTable` keeps only the first document the
 * pipeline's `$unwind` produced, so it is whichever participant that was — and the
 * store hands it over as a one-element array (`normalizeSubscribe`). So this
 * matches by EQUALITY and nothing more: the reader's record when that row really
 * is theirs, and `null` when it is somebody else's, and `null` must mean «this
 * screen cannot tell» rather than «not a member». The size of the array is not a
 * fact about the room, so no count is derived from it anywhere above.
 *
 * The lookup is by `userId`, and it has to be: `roomId` would not do even where
 * it exists, because it is the table's `id` — the same value on every participant
 * document — and so it cannot tell one reader from another. On THIS endpoint it
 * is not even present: the pipeline `$project`s `roomId` (and `cafeId`) out of
 * every participant document before responding, which is why
 * `ICafeTableParticipant.roomId` is optional and why nothing here reads it.
 */
const myParticipant = computed<ICafeTableParticipant | null>(() => {
  const id = myId.value;
  const rows = currentTable.value?.subscribe;

  if (id === undefined || !Array.isArray(rows)) return null;

  return rows.find((row) => row.userId === id) ?? null;
});

/**
 * Five states, and the fifth is the important one.
 *
 * ⚠️ `muteUntil` / `bannedUntil` ARE `boolean | number` — an epoch or a bare flag,
 * never a date — and this screen deliberately reads NEITHER of them. They carry a
 * *duration*, and printing one needs a clock in a render; the band would then
 * disagree with the server about how long the reader has left. So `status`, which
 * is a state the payload states outright, is the authority here, and the bands
 * below say what is true without saying when it stops being true.
 *
 * ⚠️ **ON THIS ROUTE ONLY `"member"` AND `"none"` ARE OBSERVABLE, AND THE REASON IS
 * IN THE CONTROLLER, NOT IN THIS FILE.** `getSingleTable`'s `$lookup` into the
 * participants carries `{ $match: { status: "active" } }` (controller `:681`) — the
 * service only ever looks up ACTIVE participants. Verified live: setting the
 * reader's own document to `status: "mute"` and re-reading the endpoint answers
 * `200 { success: true }` with **`subscribe` absent**, which this screen maps to
 * `none`.
 *
 * So the three arms below — `"left"`, `"banned"`, `"mute"` — and their bands cannot
 * be reached from this endpoint today, and a reader who has left, been muted or
 * been banned arrives here looking EXACTLY like a reader who never joined. They
 * are kept because they are correct the moment a payload carries such a row, and
 * because `banned` in particular is a fact too important to lose to a refactor.
 * **Do not "fix" a band that never draws by changing the gate** — the gate is
 * right; the endpoint simply withholds the row. The endpoint that carries the real
 * answer for a reader who is not an active member is `GET /table/:tableId/users`
 * plus this one's absence, and neither is in the store yet.
 *
 * `none` covers every case this screen cannot vouch for: no `subscribe` on the
 * answer, the reader's row not being the one the pipeline kept, a `userId` that did
 * not arrive, or a `status` this app does not know. It draws NOTHING, and that is
 * the honest direction to fail in — a reader told «شما در این میز عضو هستید» who is
 * not, or told «خارج شده‌اید» who is not, has been told a falsehood about their own
 * account, and there is no strip at all to recover from.
 */
type Membership = "member" | "left" | "banned" | "mute" | "none";

const membership = computed<Membership>(() => {
  const row = myParticipant.value;
  if (row === null) return "none";

  switch (row.status) {
    case "active":
      return "member";
    case "left":
      return "left";
    case "banned":
      return "banned";
    case "mute":
      return "mute";
    default:
      return "none";
  }
});

/**
 * ⚠️ THE ONE THING ON THIS SCREEN THAT IS STILL PURELY VISUAL.
 *
 * Hiding a standing fact about the reader is not changing it — it is refusing to
 * say it again — so a dismissal is local and legitimate where a leave is not. It
 * is kept apart from the derived membership above (rather than merged into it, as
 * the design wave did with `member | dismissed | left`) because a dismissal can
 * never be mistaken for a membership change: it sets no `status`, sends nothing,
 * and is cleared again on every navigation, so it cannot outlive its table.
 */
const stripDismissed = ref(false);

const showStrip = computed(() => !stripDismissed.value && membership.value !== "none");

/* ------------------------------------------------------------------ writing -- */

/*
 * ⚠️ **THERE IS NO `send()` ON THIS SCREEN ANY MORE, AND ITS ABSENCE IS THE
 * FEATURE.**
 *
 * The design wave had one writer for a locally-sent message — `append()` — which
 * stamped a `local-${sequence}` row, set `status: "active"` and handed it to
 * `CafeMessageList`, so a press of Enter produced a black outgoing bubble that had
 * never reached a server and vanished on the next navigation. That is the worst
 * possible lie in a messenger: a message the reader believes they sent, in a
 * conversation other people are reading. There is no `cafe:table:send-message`
 * without the `/cafe` socket, no history read to reconcile it against, and no
 * upload endpoint for the voice note or the attachment beside it — so all three
 * writers are gone rather than stubbed.
 *
 * What remains is the part that IS real: `isManager`, the sending window and the
 * table's own type decide whether a composer exists at all, and the composer that
 * does exist is drawn disabled.
 */

/**
 * `messageSendingEnabled`, read through the same `windowState` as `secureChat` —
 * one predicate for two fields of the same shape, written by the same endpoint.
 *
 * Both are OPTIONAL, and an absent one is a `closed` window and not an unknown
 * one: a table whose sending was never configured has no window to be inside, and
 * `enabled` absent is `enabled` false. The backend refuses a send outside the
 * window regardless (`docs/Cafe-Api-Docs.md` §11 draws exactly these two rows for
 * the composer lock), so reading it as closed is refusing exactly what it refuses.
 */
const sendWindow = computed<WindowState>(() =>
  windowState(now.value, currentTable.value?.messageSendingEnabled),
);

/**
 * ⚠️ **THE GATE IS TWO QUESTIONS, ASKED IN THIS ORDER — JOIN FIRST.**
 *
 * `messageSendingEnabled` says *when* this table may be written in. It says
 * nothing about *who* may write in it, and reading it alone is how the previous
 * arrangement went wrong: an open window on a table the reader has not joined
 * drew a live composer for a room they are not in.
 *
 * 1. **Is the reader a participant?** `membership` is the authority, and it was
 *    already computed for the band above. `"member"` and `"mute"` both reach the
 *    composer; `"mute"` reaches it DISABLED, which is the whole of what a mute is.
 * 2. **Is sending open?** `isManager || sendWindow === "open"`. The manager
 *    exemption survives, but it survives *behind* the membership gate: a manager
 *    who has not joined is still a visitor.
 *
 * ⚠️ `mute` IS A MEMBER AND MUST NOT BE TREATED AS A VISITOR. The participant
 * document that says `status: "mute"` is a document that exists BECAUSE the reader
 * joined — `membership` maps it to its own state only after `myParticipant`
 * matched their own row. So the two gates agree on who is in the room, and
 * `showJoin` below is written to match them: a muted reader is told they are
 * muted, never that they must join a table they are already in.
 *
 * `banned` is the only member state with neither a composer nor a join button,
 * and that is the backend's answer rather than this screen's: `POST
 * /table/subscribe` refuses with `ERR_TABLE_BANNED`.
 */
const isJoined = computed<boolean>(() => membership.value === "member");

/** Gate 2 on its own, so the template can name which of the two questions failed. */
const sendingOpen = computed<boolean>(
  () => currentTable.value?.isManager === true || sendWindow.value === "open",
);

/**
 * The join button, which REPLACES the composer — a table you are not in has
 * nothing to type into, and an input there is the app offering a conversation
 * the reader has no part in.
 *
 * The two states that draw it are the two states in which the reader is genuinely
 * outside the table — or in which this screen cannot tell. `banned` does not,
 * because `POST /table/subscribe` answers `ERR_TABLE_BANNED` and the button would
 * promise something the server has already refused. **`mute` does not either**,
 * because a muted reader HAS joined: a «برای نوشتن باید عضو باشید» bar under
 * «شما در این میز بی‌صدا هستید» tells a member they are a stranger to a table
 * they are standing in. It draws nothing, because `showComposer` draws the field
 * for `mute` instead — muted, disabled, and saying so in its own placeholder.
 *
 * ⚠️ `none` DRAWS the button, which is a deliberate reading of "cannot tell". The
 * band above refuses to claim the reader is or is not a member — that would be a
 * falsehood about their own account — so this button is an INVITATION rather than
 * a verdict. A reader who is already in presses it and nothing happens, which is
 * the honest failure for an offer nobody has to accept.
 */
const showJoin = computed<boolean>(
  () =>
    currentTable.value !== null &&
    (membership.value === "left" || membership.value === "none"),
);

/**
 * The composer's VISIBILITY: gate 1, plus the secure-chat rule that predates this
 * change — a secure chat CONFIGURED AND THEN ELAPSED draws no input, whatever its
 * sending window says, because the transcript has been withdrawn.
 */
const showComposer = computed<boolean>(() => {
  if (currentTable.value === null) return false;
  if (!isJoined.value && membership.value !== "mute") return false;

  return !(secureChatConfigured.value && secureChat.value === "closed");
});

/**
 * Whether the composer is TYPABLE rather than merely drawn. `mute` holds it
 * disabled however open the window is: the participant document is the authority
 * on whether THIS reader may post, and a window says nothing about them.
 */
const composerEnabled = computed<boolean>(
  () => showComposer.value && sendingOpen.value && membership.value !== "mute",
);

/**
 * The closed sending window's sentence, in the same shape as `secureChatNotice`
 * and for the same reason — when sending reopens is the half of the fact a reader
 * cannot do without, so the placeholder carries the SPAN and not just «closed».
 */
const sendWindowNotice = computed<string>(() => {
  const win = currentTable.value?.messageSendingEnabled;
  const from = faTimeOfDay(win?.startAt);
  const to = faTimeOfDay(win?.endAt);

  if (from !== "" && to !== "" && faDate(win?.startAt) === faDate(win?.endAt))
    return `ارسال پیام در این میز فقط از ${from} تا ${to} فعال است`;

  if (from !== "") return `ارسال پیام در این میز از ${from} فعال است`;
  if (to !== "") return `ارسال پیام در این میز تا ${to} فعال است`;

  return "ارسال پیام در این میز فعال نیست";
});

/**
 * Why the composer is there but cannot be typed into — in the field's own
 * placeholder, which is the only place `ComposerShell` can say anything.
 *
 * The most specific reason wins, so a reader is never told «این میز پیام متنی
 * ندارد» about a table that plainly takes messages and is merely paused:
 *
 * - a table that is not `space`. `space` is the ONLY type that carries a text
 *   chat, and sending to a `bot` or a `club-voice` table is refused with
 *   `ERR_SEND_MESSAGE_TABLE_NOT_FOUND`, so neither is described as if it took
 *   messages.
 * - `mute`, which is about the reader and therefore outranks every window.
 * - the window itself, which `sendWindowNotice` spells out with its times.
 *
 * ⚠️ The last test is `!sendingOpen`, NOT `sendWindow !== "open"`, and that is why
 * it is written this way: `sendingOpen` is exactly what `composerEnabled` reads, so
 * the placeholder and the enabled state can never disagree. A manager whose window
 * is closed is TYPABLE — they set the window, so a closed one is their own decision
 * — and must therefore never be shown a sentence saying sending is paused. An
 * earlier reading compared the raw window and drew a «فقط از … تا … فعال است»
 * sentence on a field the reader could type into.
 *
 * A field that IS enabled says nothing, and `undefined` hands the field back to
 * `ComposerShell`'s own «پیام بنویسید».
 */
const composerPlaceholder = computed<string | undefined>(() => {
  if (currentTable.value?.tableType !== "space") return "این میز پیام متنی ندارد";
  if (membership.value === "mute") return "در این میز بی‌صدا هستید و نمی‌توانید پیام بفرستید";
  if (!sendingOpen.value) return sendWindowNotice.value;

  return undefined;
});

/* --------------------------------------------------------------- composer UI -- */

/*
 * ⚠️ **THIS WAVE IS THE INTERFACE, NOT THE TRANSPORT.**
 *
 * The gate above, the join button, the live field and both sheets are all real
 * and all answered by the API. The three TERMINAL actions are not, and they are
 * deliberately left inert rather than stubbed to pretend:
 *
 * - `submit` would have to append an outgoing bubble, and an appended bubble is a
 *   message the reader believes they sent in a conversation other people are
 *   reading. That lie is what the design wave's `append()` did and what deleting
 *   it cost us a message flow to undo;
 * - `select` has no upload endpoint to hand the bytes to;
 * - the voice recorder needs `MediaRecorder` and an upload this file does not do.
 *
 * So the composer is TYPABLE and the sheets OPEN, because that is the UI/UX under
 * review, and nothing pretends a message was sent. Each of the three is marked
 * where it is wired.
 */
const draft = ref("");
const attachOpen = ref(false);
const voiceOpen = ref(false);

/* ---------------------------------------------------------------- messages -- */

/**
 * The transcript, **empty**, and that is the honest state of it.
 *
 * `GET /table/:tableId/messages` is the endpoint that fills this array and it is
 * not in the store yet — it is also the one endpoint whose success carries no
 * `success` field and whose refusal carries `success: true`
 * (`INFO_TABLE_NOT_FOUND`), which is exactly the kind of contract that belongs in
 * the store rather than in a page. Until it lands, `CafeMessageList` draws its own
 * empty state, and a reader who is told a conversation has no messages has been
 * told something false about a conversation with thirty.
 *
 * A `ref` and not a plain array so the history read has one place to assign into
 * when it arrives; nothing writes it today.
 */
const messages = ref<ICafeTableMessage[]>([]);

/* ---------------------------------------------------------------- scrolling -- */

/**
 * A ref on the **wrapper**, not on `<CafeMessageList>`.
 *
 * `CafeMessageList` owns its scroller and exposes no imperative handle, and
 * reaching through the component instance to read `$el` would be an untyped
 * `any` on a DOM node. The wrapper is the same region seen from outside: it is
 * the flex column the list fills, and `[role="log"]` inside it is the only
 * scrolling box on the screen. Querying for it by its own ARIA role means this
 * code depends on the list's *contract* rather than on its class names.
 *
 * It is still called on mount, and still on nothing else, for the reason it was:
 * a watcher on the message list would also fire for a history read, a socket
 * delivery and a reaction, and yanking the reader to the bottom while they are
 * reading something twenty messages up is the single most irritating thing a chat
 * screen can do. Against an empty list it is a no-op; it is here for the read that
 * fills it.
 */
const thread = useTemplateRef<HTMLElement>("thread");

function scrollToBottom() {
  const log = thread.value?.querySelector<HTMLElement>('[role="log"]');

  if (!log) return;

  log.scrollTop = log.scrollHeight;
}

onMounted(async () => {
  await nextTick();
  scrollToBottom();
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!--
      Three answers in the order they can be true. A table handle the server has
      never heard of, one belonging to a different café than the URL says, a stale
      notification link, a hand-typed address — all of them are the same screen, and
      the one action on it is the way back to a screen that exists.
    -->
    <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

    <CafeStateBlock
      v-else-if="showError"
      state="error"
      title="این میز پیدا نشد"
      :description="loadError ?? 'ممکن است نشانی میز تغییر کرده باشد یا این میز دیگر در دسترس نباشد.'"
    >
      <template #action>
        <!--
          Retry first, then the way back: the refusal this screen shows has two
          very different causes — «اتصال اینترنت را بررسی کنید» is worth one press,
          «این میز پیدا نشد» is not — and only the store's own sentence tells them
          apart, which is why it is the description and the fallback is not.
        -->
        <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
          <UButton
            type="button"
            variant="soft"
            color="x-primary"
            label="تلاش دوباره"
            :ui="{ base: 'rounded-full' }"
            :loading="isLoading"
            @click="retry"
          />

          <UButton
            :to="backTo"
            variant="soft"
            color="x-primary"
            label="بازگشت به میزها"
            :ui="{ base: 'rounded-full' }"
          />
        </div>
      </template>
    </CafeStateBlock>

    <template v-else>
      <CafeChatHeader
        :to="backTo"
        :nikname="currentTable?.nikname"
        :profile-image="currentTable?.profileImage"
        :subtitle="subtitle"
        video
        call
      />

      <!--
        ⚠️ `online` IS GONE. The design wave passed `true` here because the fixture
        had a roster with `isOnline`; this route's payload has none, and a green
        presence dot on a table nobody's presence is known for is the app telling the
        reader where somebody is. Presence arrives with the socket's
        `cafe:table:join-new-user`, which is the messaging wave.
      -->

      <!--
        The secure-chat PIN. The same shape as the membership band below it — same
        `bg-x-primary-content-200` ground, same icon-and-sentence row — because it
        says the same kind of thing: a standing fact about this conversation, pinned
        directly under the bar, not an alert that floats over the thread and makes
        leaving look like an error.

        Drawn ONLY while the window is open, and it pins the SPAN: the moment the
        content disappears is the half of the fact a reader cannot do without, so
        `secureChatNotice` carries the SPAN, not just the fact that a window
        exists. No window, no pin — the table simply shows its content.

        ⚠️ `ChatHeader` and `MessageList` carry NO pinned-message affordance (they
        own identity and the transcript respectively), so this is the thread's own
        band rather than a prop added to a primitive — a header that grew a second
        line of its own for one table's flag would be the odd component.
      -->
      <div
        v-if="secureChat === 'open'"
        class="flex shrink-0 items-center gap-2 bg-x-primary-content-200 px-4 py-2"
      >
        <UIcon name="solar:shield-check-linear" size="18" class="shrink-0 text-x-text-subtitle" aria-hidden="true" />

        <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
          {{ secureChatNotice }}
        </p>
      </div>

      <!--
        The membership / mute band. `shrink-0` with the header so it is pinned
        directly under the bar and the thread takes the rest, which is the Telegram
        arrangement and the reason this is not a `UAlert` floating over the thread:
        being muted or banned is a *standing fact* about the reader, not an error
        that just happened.

        ⚠️ IT DRAWS NOTHING WHEN THE ANSWER IS NOT IN THE PAYLOAD (`membership ===
        "none"`), which is the direction to fail in — see `myParticipant`.
      -->
      <template v-if="showStrip">
        <div
          v-if="membership === 'member'"
          class="flex shrink-0 items-center gap-2 bg-x-primary-content-200 px-4 py-2"
        >
          <UIcon name="solar:users-group-rounded-linear" size="18" class="shrink-0 text-x-text-subtitle" aria-hidden="true" />

          <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
            شما در این میز عضو هستید
          </p>

          <!--
            ⚠️ **DISABLED, NOT WIRED.** `POST /table/:tableId/left` and
            `POST /table/subscribe` are out of this wave, so the confirm modal and
            the handler behind it are gone rather than left pressing a local `ref`.
            Flipping a local `membership` to `"left"` on confirm would draw
            «شما از این میز خارج شده‌اید» while the server still had the reader in
            `subscribe` — a sentence about their own account that is simply false.
            So the control says what it will do and does not pretend to do it yet,
            which is the same trade `ChatHeader`'s call buttons and `AttachSheet`
            already make in this feature.

            `min-h-11` rather than a tight text-sized pill: this is the only control
            on the screen that *removes* something, and 44px is the floor below which
            a destructive target is easy to miss with a thumb.

            `inline-flex items-center` is what keeps that 44px box from pushing the
            label out of the middle of it. A `<button>` is `inline-block`, and an
            inline-block lays its line boxes out from the **top** of the content box:
            `min-height` enlarges the box and never re-centres what is inside.
          -->
          <button
            type="button"
            disabled
            aria-label="خروج از میز — این امکان هنوز فعال نیست"
            class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            خروج از میز
          </button>

          <!--
            The one control on this band that is still live, and it is live because
            it is only visual: it hides a band that is still true, and it changes
            nothing the server holds. The reader gets it back on the next visit.
          -->
          <button
            type="button"
            aria-label="بستن این نوار"
            class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-subtitle transition-colors hover:bg-x-primary-content-300"
            @click="stripDismissed = true"
          >
            <UIcon name="solar:close-circle-linear" size="18" aria-hidden="true" />
          </button>
        </div>

        <div
          v-else-if="membership === 'left'"
          class="flex shrink-0 items-center gap-2 bg-x-primary-content-200 px-4 py-2"
        >
          <UIcon name="solar:exit-linear" size="18" class="shrink-0 text-x-text-subtitle" aria-hidden="true" />

          <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
            شما از این میز خارج شده‌اید
          </p>

          <!--
            ⚠️ NO «دوباره عضو شوید» HERE, AND THE DESIGN WAVE HAD ONE.
            `showJoin` already draws exactly that action in the composer's position
            at the bottom of the screen, and `membership === "left"` is one of the
            two states that draws it. Two disabled buttons offering the same
            unavailable action — one pinned under the header and one at the bottom —
            is not two chances to re-join, it is the same dead end twice and a
            reader wondering which one is real. The band keeps the FACT; the bar
            keeps the action.
          -->
        </div>

        <!--
          ⚠️ THE TWO RESTRICTIONS, DRAWN AS A BAND RATHER THAN AS AN ERROR.
          `status: "banned"` and `status: "mute"` are the participant document
          saying the reader may not post here; they are a standing fact about the
          reader, not a failed request, so they get the same quiet band as
          membership rather than `CafeStateBlock state="error"` — which would also
          put them in the wrong branch, since nothing has been refused.
        -->
        <div
          v-else-if="membership === 'banned'"
          class="flex shrink-0 items-center gap-2 bg-x-primary-content-200 px-4 py-2"
        >
          <UIcon name="solar:user-block-linear" size="18" class="shrink-0 text-x-text-subtitle" aria-hidden="true" />

          <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
            شما از این گفتگو محروم شده‌اید
          </p>
        </div>

        <div
          v-else-if="membership === 'mute'"
          class="flex shrink-0 items-center gap-2 bg-x-primary-content-200 px-4 py-2"
        >
          <UIcon name="solar:muted-linear" size="18" class="shrink-0 text-x-text-subtitle" aria-hidden="true" />

          <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
            شما در این میز بی‌صدا هستید
          </p>
        </div>
      </template>

      <!--
        The only `flex-1 min-h-0` region on the screen. The header and the bands
        above are `shrink-0` and the composer below is in the flow, so this column
        is exactly the space between them and nothing can push the transcript off
        the viewport.
      -->
      <div ref="thread" class="flex min-h-0 flex-1 flex-col">
        <!--
          ⚠️ **UNGATED, IN EVERY STATE OF `secureChat`.** There is no `v-if` here and
          there must not be one. The list is the table's content; a window's state
          changes what the header PINS about that content, never whether it is
          drawn. The wave that gated this on `secureChat !== "closed"` blanked the
          conversation of every table without a secure chat and replaced it with
          «گفتگوی امن به پایان رسید» — a window those tables never had.

          An empty `messages` array renders `CafeMessageList`'s own empty state,
          which is the honest one: nothing has arrived yet, or there is nothing to
          show. That is a different sentence from «a window ended», and only this
          component knows which is true.
        -->
        <CafeMessageList
          :messages="messages"
          :my-id="myId"
          :now="now"
        />
      </div>

      <!--
        THE JOIN BAR, which takes the composer's place when the reader is not in
        this table.

        ⚠️ **DISABLED, NOT WIRED.** `POST /table/subscribe` is the next wave, and a
        live «عضویت در میز» that joined nobody would leave the reader believing they
        had joined. It is drawn in the composer's position and not as a band above
        the thread for the reason the composer was: it answers the question the
        reader has at THIS moment («why can I not write here?»), so it belongs where
        the input they wanted is missing rather than pinned above a transcript that
        is not theirs.

        `min-h-11` for the same reason as the «خروج از میز» control it mirrors: it is
        the screen's primary action here, and 44px is the floor below which a thumb
        misses. `inline-flex items-center` is what stops a 44px box from pushing its
        own label out of the top of itself — a `<button>` is `inline-block`, and
        `min-height` enlarges the box without re-centring what is inside it.
      -->
      <div
        v-if="showJoin"
        class="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-x-primary-content-50 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <p class="min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
          برای دیدن و نوشتن در این میز باید عضو آن باشید.
        </p>

        <UButton
          type="button"
          variant="solid"
          color="x-primary"
          label="عضویت در میز"
          disabled
          aria-label="عضویت در میز — این امکان هنوز فعال نیست"
          class="shrink-0"
          :ui="{ base: 'min-h-11 rounded-full px-4 text-xs font-bold' }"
        />
      </div>

      <!--
        The composer, now gated on BOTH questions: `showComposer` is the reader
        being a member, `composerEnabled` adds the sending window.

        ⚠️ `v-model="draft"` is back because the field is TYPABLE this wave, and a
        ref nothing writes to would be a second piece of state lying about the
        first. It stays local to the component and is never sent.

        The `+` and the mic are enabled for the same reason and are NOT stubbed:
        both open real UI below. What neither can do is DELIVER — see the note on
        `draft` in the script, and the three handlers marked inert.
      -->
      <CafeComposerShell
        v-if="showComposer"
        v-model="draft"
        :disabled="!composerEnabled"
        :placeholder="composerPlaceholder"
        @attach="attachOpen = true"
        @mic="voiceOpen = true"
      />

      <!--
        The two sheets, in the composer's own region rather than in a `UModal`, so
        they sit on the same surface the `+` and the mic are drawn on — the bar
        keeps its place while the sheet covers it.

        ⚠️ Both are UI ONLY. `select` has no upload endpoint to hand the bytes to
        and the recorder has no `MediaRecorder` behind it, so neither closes into a
        message. `@select` and `@send` are intentionally unbound: binding them to
        something that pretends to have sent is the lie this feature has refused
        twice already.
      -->
      <CafeAttachSheet v-model:open="attachOpen" />

      <CafeVoiceRecorder
        v-if="voiceOpen"
        :recording="false"
        :seconds="0"
        :amplitude="0"
        @cancel="voiceOpen = false"
      />
    </template>
  </div>
</template>