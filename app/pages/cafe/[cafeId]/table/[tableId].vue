<script setup lang="ts">
import { useClipboard, useDebounceFn } from "@vueuse/core";

import type {
  ICafeTableParticipant,
  ICafeThreadMessage,
  ICafeWindow,
  ICafeWindowBroadcast,
  CafeReportTarget,
} from "~/types/cafe";

import type { CafeMessageIntent } from "~/components/Cafe/MessageMenu.vue";
import type { CafeTableIntent } from "~/components/Cafe/TableMenu.vue";

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
 * ## WHAT IS WIRED HERE, AND WHAT STILL IS NOT
 *
 * The messaging wave owns the socket, the transcript, sending, the context menu,
 * the inline edit, delete, like, the report, the read receipt, and both
 * membership writes — every one of them through `useCafe()` and
 * `useCafeThreadSocket`, and never through a local array standing in for an
 * endpoint. So the two things Phase 1 deliberately left inert are gone:
 *
 * - the composer is **LIVE** (`@submit` → `cafe.sendMessage`), and the draft is
 *   cleared **only** on `{ ok: true }` — a refused send leaves the reader's words
 *   in the field, because losing them is the one failure a composer cannot
 *   forgive;
 * - «خروج از میز» and «عضویت در میز» are **WIRED**, in that order around the
 *   socket rooms, because a member whose room was never joined reads history and
 *   then hears nothing.
 *
 * ⚠️ TWO CONTROLS REMAIN INERT, AND BOTH SAY SO IN PERSIAN INSTEAD OF PRETENDING:
 * the `+` sheet's `select` and the voice recorder's `send`. `sendMessage` wants
 * `file.mainFile` — the URL an **upload** returns — and `CafeVoiceRecorder` emits
 * `send` with no payload at all; there is no upload endpoint in the documented
 * contract. Inventing a URL (a `data:` one, a placeholder path) would post a
 * document the server cannot serve, and a tile that appears to attach something is
 * worse than one that says the feature is not here yet.
 */

const { $toast } = useNuxtApp();

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

    // ⚠️ AND SO DOES ANY MEMBERSHIP **WRITE** THIS SCREEN MADE. `localMembership` is
    // a statement about the reader and the table they were just in; carrying it to
    // another table would say «شما عضو هستید» about a conversation they have not
    // joined. The composable's own watcher leaves the old table's rooms in the same
    // tick, and this is the state half of that move.
    localMembership.value = null;

    // ⚠️ AND THE MENUS CLOSE WITH IT. An open sheet over a table the reader has
    // navigated away from is an overlay whose subject is no longer on screen, and
    // its pending report / delete subject is the WRONG table's.
    menuOpen.value = false;
    tableMenuOpen.value = false;
    reportOpen.value = false;
    pendingDelete.value = null;
    editingId.value = null;
    replyTarget.value = null;

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

/* ------------------------------------------------------------------ identity -- */

/**
 * The table's **INTERNAL** id, and every thread, message and mutation call below
 * is keyed on it.
 *
 * ⚠️ THIS IS THE ID/HANDLE SPLIT AGAIN, AND IT IS NOW THE SCREEN'S OWN JOB.
 * `/cafe/[cafeId]/table/[tableId]` carries the public `ch_` / `cv_` / `tb_` handle
 * (`fetchTable` resolves it for the single-table read), while the thread, the
 * roster, the read receipt, the send, the edit, the delete, the like and the
 * report all match on `Cafe Table.id`. Sending one in place of the other is the
 * documented way to end up in a conversation that receives nothing at all
 * (§18.13: «join the right rooms or you'll be blind»).
 *
 * `""` is the honest answer while a deep link's handle has not been resolved yet —
 * the single-table read is what resolves it — and every caller below refuses to
 * act on it rather than sending `/api/cafe/table//messages`.
 */
const internalTableId = computed<string>(
  () => cafe.internalTableId(cafeId.value, tableId.value) ?? "",
);

/**
 * ⚠️ REFS OFF THE ROUTE, NOT STRINGS, and this is not a style choice.
 *
 * vue-router REUSES a component instance when only the params change, so
 * `/cafe/A/table/X → /cafe/A/table/Y` never re-runs this setup body. A composable
 * given two plain strings would keep table X's socket room while the address said
 * Y; the composable's own watchers turn that into a leave-then-enter.
 *
 * It is called **ONCE** here and owns everything else: entering and leaving both
 * rooms, every server→client listener, the cold first-window read, the catch-up,
 * the roster, the `/single` refresh and the read receipt. Nothing below calls
 * `fetchMessages` or `fetchUsers` for the initial load and nothing below adds
 * reconnect logic of its own — either would be a second sequence racing the one the
 * composable already runs.
 */
const { enter: enterRoom, leave: leaveRoom } = useCafeThreadSocket(cafeId, tableId);

/**
 * The transcript, from the store's keyed cache. `threadMessages` hands back a
 * **frozen empty array** when there is no thread, so this computed has one stable
 * identity for «nothing to draw» — which matters because the transcript re-renders
 * on every tick of the 15-second clock above.
 */
const messages = computed(() => cafe.threadMessages);

/**
 * The ACTIVE thread, for the paging flags and cursors `CafeMessageList` draws the
 * «پیام‌های قدیمی‌تر» control from.
 *
 * ⚠️ Passed as a prop rather than read from the store inside the list, because
 * `cafe.threadFor()` **creates** an entry and a getter that writes during a render
 * is a getter that must not be called from one.
 */
const thread = computed(() => cafe.thread);

/** `senderId` → member: exactly the shape the list resolves names and avatars from. */
const members = computed(() => cafe.users);

/* ------------------------------------------------------------ window override -- */

/**
 * ⚠️ A LIVE `cafe:table:*-status` OVERRIDE **REPLACES THE `enabled` FLAG** AND
 * NOTHING ELSE.
 *
 * The broadcast is the plain string `"enabled"` / `"disabled"` with **no table id
 * and no bounds** (§18.6), so it can override exactly one thing: whether the window
 * is on. Its start and end still live on the `/single` payload and `windowState`
 * still does the arithmetic — so a window that is «enabled» outside its own hours
 * stays closed, which is the answer the server gives.
 *
 * ⚠️ AND IT IS NEVER WRITTEN ONTO `cafe.table`. The store holds it as a thread
 * override precisely so a later re-read of `/single` can restore the truth; a
 * mutation here would make the live status permanent.
 */
function withWindowOverride(
  window: ICafeWindow | null | undefined,
  override: ICafeWindowBroadcast | null,
): ICafeWindow | null | undefined {
  if (override === null) return window;

  return { ...(window ?? {}), enabled: override === "enabled" };
}

const sendingOverride = computed<ICafeWindowBroadcast | null>(() =>
  internalTableId.value === ""
    ? null
    : cafe.sendingOverride(internalTableId.value),
);

const secureOverride = computed<ICafeWindowBroadcast | null>(() =>
  internalTableId.value === ""
    ? null
    : cafe.secureOverride(internalTableId.value),
);

/** The sending window with the live override layered on top of the payload. */
const sendingWindow = computed(() =>
  withWindowOverride(
    currentTable.value?.messageSendingEnabled,
    sendingOverride.value,
  ),
);

/** The secure-chat window with the live override layered on top of the payload. */
const secureWindow = computed(() =>
  withWindowOverride(currentTable.value?.secureChat, secureOverride.value),
);

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
  windowState(now.value, secureWindow.value),
);

/**
 * Whether this table has a secure-chat window **at all** — the question
 * `WindowState` cannot answer, because it folds «not configured» into `closed`.
 *
 * Every decision that must treat «never configured» and «configured, elapsed»
 * differently asks THIS, and never `secureChat === "closed"`. Both are `true` for
 * an ordinary table today, which is precisely the confusion this separates.
 *
 * ⚠️ IT READS THE OVERRIDDEN WINDOW, so a live `cafe:table:secure-chat-status`
 * can take a table from «never configured» to «configured and elapsed» — which
 * hides the composer — without a re-read of `/single`.
 */
const secureChatConfigured = computed<boolean>(
  () => secureWindow.value?.enabled === true,
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
 *
 * ⚠️ IT READS THE **OVERRIDDEN** WINDOW, so a live
 * `cafe:table:secure-chat-status` of `"enabled"` puts the pin up (or takes it down)
 * without a re-read of `/single`. The band above is gated on `secureChat === "open"`
 * and this supplies its words — so the two can never disagree about whether a
 * secure chat is running.
 */
const secureChatNotice = computed<string>(() => {
  const window = secureWindow.value;
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
 * that lists members, and the store now reads it on every thread (re)sync — it feeds
 * the sender NAMES on the bubbles, not this subtitle. The member count is still gone,
 * because nothing on that roster is documented to be countable. Worse, the one membership field that IS on this answer —
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

/**
 * ⚠️ WHAT THE SERVER JUST TOLD US, AND IT OUTRANKS THE PAYLOAD.
 *
 * `membership` is derived from `/single`'s `subscribe`, which is ONE participant
 * document — `getSingleTable` keeps only the first the pipeline's `$unwind`
 * produced — so after a confirmed `POST /table/subscribe` the band would still
 * draw «برای نوشتن باید عضو باشید» under a table the server has just put the
 * reader in.
 *
 * A confirmed write is a fact about the reader's OWN account and it is fresher
 * than the row that cannot vouch for itself, so it wins — **until the next
 * navigation clears it**, and only while this screen is the one that made it.
 *
 * The direction to fail in is unchanged: with no write of our own the answer stays
 * `none` and nothing is claimed. `null` means «this client has not asked the
 * server anything about the reader's membership», which is a different sentence
 * from `"none"`.
 */
const localMembership = ref<Membership | null>(null);

const membership = computed<Membership>(() => {
  // ⚠️ THE WRITE WINS, AND ONLY A WRITE THIS SCREEN SAW. `banned` is not reachable
  // here: `POST /table/subscribe` refuses with `ERR_TABLE_BANNED`, so a `banned`
  // answer never reaches this assignment and the server's own band is never
  // overridden by it.
  if (localMembership.value !== null) return localMembership.value;

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
  windowState(now.value, sendingWindow.value),
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
 *
 * ⚠️ A LIVE `disabled` OVERRIDE GETS ITS OWN SENTENCE. Printing «فقط از ۱۴:۳۰ تا
 * ۱۶:۰۰ فعال است» under a field the reader may not type into — because a window was
 * switched off outright — describes a span that no longer decides anything.
 */
const sendWindowNotice = computed<string>(() => {
  if (sendingOverride.value === "disabled") {
    return "ارسال پیام در این میز غیرفعال است";
  }

  const win = sendingWindow.value;
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


/* ------------------------------------------------------------- the composer -- */

/**
 * ⚠️ §11's `MESSAGE_TEXT_MAX`, AND IT IS **NOT** THE STORE'S CONSTANT.
 *
 * `stores/cafe.ts` holds this figure as a module-level `const` and enforces it in
 * `sendMessage` and `editMessage` — but it does not export it, so the store's
 * public shape has no `MESSAGE_TEXT_MAX` to read. This is a genuine gap in the
 * state layer (a field's `maxlength` is a UX affordance the store owns the truth
 * of), recorded rather than worked around silently.
 *
 * ⚠️ SO IT IS WRITTEN HERE, AND IT MUST MATCH. Two checks live in the store and a
 * third in `server/api/cafe/table/[resourceId]/messages.post.ts`; if §11 ever changes
 * and this number does not, the composer's field would silently stop accepting the
 * last characters of a long message — the field is a *cap*, so a stale one here is
 * a smaller lie than a stale one in a `refusal`.
 */
const MESSAGE_TEXT_MAX = 2000;

/**
 * ⚠️ THE DRAFT SURVIVES A REFUSAL, and that is the whole of the send contract.
 *
 * The store's `sendMessage` already refuses rather than truncates, and it never
 * rejects — it answers `{ ok: false, failure }`. So this handler has three jobs
 * and one rule: clear the draft **only** on `ok: true`. A reader whose send was
 * refused — throttled, offline, or outside the window the server holds — must find
 * their words still in the field, because losing them is the one failure a
 * messenger cannot forgive.
 */
const draft = ref("");
const attachOpen = ref(false);
const voiceOpen = ref(false);
const sendError = ref<string | null>(null);

/** The message this draft is a reply to. Doc §7's local quote. */
const replyTarget = ref<ICafeThreadMessage | null>(null);

/** The composer's imperative handle — `CafeComposerShell` exposes `focus()`. */
const composer = useTemplateRef<{ focus: () => void }>("composer");

/**
 * ⚠️ `cafe.sendPending` IS A **LATCH**, NOT A SPINNER.
 *
 * The store sets it before the request and clears it in a `finally`, and a call
 * that arrives while it is set returns the held answer with no request — so this
 * guard is what makes a double-tap spend one of §11's 30-per-60s rather than two.
 * The composer's `loading` prop is the same flag, so the field, the `+` and the mic
 * all go quiet together instead of the send button alone.
 */
async function submitDraft(): Promise<void> {
  const id = internalTableId.value;

  if (id === "") return;
  if (!composerEnabled.value || cafe.sendPending) return;

  const text = draft.value.trim();
  if (text === "") return;

  sendError.value = null;

  // ⚠️ THE REPLY ID GOES ON THE WIRE, NOT IN THE DRAFT. `reaplayToMessageId` — with
  // the `lay` — is §11's load-bearing typo, and the response reads it back as
  // `reaplayTo`, which is the field the bubble's blockquote renders.
  const target = replyTarget.value;

  const result = await cafe.sendMessage(
    id,
    target === null ? { text } : { text, reaplayToMessageId: target.id },
  );

  if (!result.ok) {
    sendError.value = result.failure.message;
    return;
  }

  draft.value = "";
  replyTarget.value = null;

  markSeenNow();
}

/**
 * `CafeAttachSheet`'s `select`, bound to the send.
 *
 * ⚠️ **AND IT CANNOT BE.** `sendMessage` wants `file.mainFile` — the URL an
 * upload returned — and there is no upload endpoint in the documented contract,
 * so this selection has no bytes and no URL to name. Inventing one (a `data:` URL,
 * a placeholder path) would post a document the server cannot serve and leave a
 * permanent broken attachment in a conversation other people are reading.
 *
 * So the handler closes the sheet and says plainly, in Persian, what is missing.
 * That is the same trade `MessageBubble`'s inert play button makes, and it is the
 * honest one: a tile that pretended to attach something would be worse than a tile
 * that says the feature is not there yet.
 */
function onAttachSelect(): void {
  attachOpen.value = false;

  $toast.error("هنوز امکان ارسال پیوست در این نسخه فعال نیست.");
}

/** The message this draft replies to, as a name plus its own words. */
const replyQuote = computed<string>(() => replyTarget.value?.text?.trim() ?? "");

function startReply(message: ICafeThreadMessage): void {
  if (!composerEnabled.value) return;

  replyTarget.value = message;

  // ⚠️ `nextTick` because the composer's placeholder and focus state only settle
  // after the reply strip has rendered — a reply the reader has to tap into is a
  // reply they may never write.
  void nextTick(() => composer.value?.focus());
}

function cancelReply(): void {
  replyTarget.value = null;
}

/* -------------------------------------------------------------- read state -- */

/**
 * ⚠️ ONE RECEIPT, DEBOUNCED, AND THE NUMBER IS THE HIGHEST SEQUENCE **RENDERED**.
 *
 * §8's recipe says: post `seen` with the highest sequence you have shown, on open
 * and on a debounced scroll. `cafe.newestRenderedSequence(id)` is exactly that
 * number, and it is `null` while nothing with a sequence is held — the whole
 * window between entering and the first page landing — which `scheduleMarkSeen`
 * ignores.
 *
 * The **throttle** is the store's, and it is a throttle rather than a debounce on
 * purpose: a debounce starves under continuous scrolling, so the receipt would
 * never be posted while a reader is actually reading, and the unread badge they
 * can see growing would be one this client never corrects. The debounce below is a
 * second, coarser gate on the EVENT, which fires far more often than the answer
 * should be posted.
 *
 * ⚠️ **THE TRIGGER IS A POSITION, NOT A SCROLL.** This screen used to post on any
 * `scroll` and on any change to `messages.length`, and both are supersets of what
 * §8 means by «the latest visible sequence»: a reader scrolled to the middle of a
 * long thread marked messages they had not reached as read, and a live broadcast
 * did the same while they were twenty messages up. `CafeMessageList` owns the one
 * predicate that can tell the difference — `atBottom()` — and answers `reach-end`
 * only when the reader was at the end or ARRIVED at it, so the throttle below
 * governs the rate and this governs the truth.
 */
const SEEN_DEBOUNCE_MS = 800;

function markSeenNow(): void {
  const id = internalTableId.value;
  if (id === "") return;

  const newest = cafe.newestRenderedSequence(id);
  if (newest === null) return;

  cafe.scheduleMarkSeen(id, newest);
}

const markSeenSoon = useDebounceFn(markSeenNow, SEEN_DEBOUNCE_MS);

/* ------------------------------------------------------------- the menus -- */

/** The message context menu, and the row that opened it. */
const menuOpen = ref(false);
const menuMessage = ref<ICafeThreadMessage | null>(null);
const menuTrigger = shallowRef<HTMLElement | null>(null);

/**
 * ⚠️ FOCUS GOES BACK TO THE ROW THAT OPENED THE MENU — **UNLESS SOMETHING ELSE
 * TOOK IT.**
 *
 * A sheet that closes and drops the caret on `<body>` strands a keyboard reader at
 * the top of the document with no idea what they were in the middle of. But four of
 * the six intents open or focus something of their own the moment the menu closes:
 *
 * - «پاسخ» puts the caret in the composer;
 * - «ویرایش» puts it in that bubble's editor;
 * - «گزارش» and «حذف» open a sheet or a modal of their own, which takes focus.
 *
 * Restoring the row's focus in those four cases would yank the caret straight back
 * out of whatever the reader just asked for — which is worse than not restoring at
 * all. `«کپی متن»` and «پسندیدن» are the only two that open nothing, so those are
 * the only two that hand focus back.
 *
 * ⚠️ THE FLAG IS READ **INSIDE** THE TICK, not at the moment the menu closes:
 * `CafeMessageMenu` emits `update:open` **before** `select`, so by the time this
 * watcher runs the intent has not been dispatched yet. Reading it in the callback
 * is what makes the ordering irrelevant.
 *
 * The trigger is the **page's** to restore — `CafeMessageList` only emits the
 * element, and only this screen knows a message is on screen.
 */
let restoreMenuFocus = true;

watch(menuOpen, (open) => {
  if (open) return;

  const trigger = menuTrigger.value;

  void nextTick(() => {
    if (!restoreMenuFocus) return;

    trigger?.focus();
  });
});

function openMessageMenu(payload: {
  message: ICafeThreadMessage;
  trigger: HTMLElement;
}): void {
  restoreMenuFocus = true;

  menuMessage.value = payload.message;
  menuTrigger.value = payload.trigger;
  menuOpen.value = true;
}

/** The header's `⋯`, and the sheet it opens. */
const tableMenuOpen = ref(false);
const leavingTable = ref(false);

function onTableIntent(intent: CafeTableIntent): void {
  if (intent === "report") {
    openReport("table");
    return;
  }

  void leaveTableNow();
}

/* ------------------------------------------------------------- the actions -- */

/** §7's intents, performed by the screen — the menu itself performs nothing. */
const editingId = ref<string | null>(null);
const savingEditId = ref<string | null>(null);
const editError = ref<{ messageId: string; text: string } | null>(null);
const pendingDelete = ref<ICafeThreadMessage | null>(null);
const deleting = ref(false);

const { copy } = useClipboard();

/**
 * Clipboard copy, and the reason the text read is `displayText`-equivalent here
 * rather than `message.text`: a soft-moderated message carries the SERVER's
 * censored body, and handing the reader the uncensored words from a field they
 * cannot see would be handing them a copy of text moderation removed.
 */
async function copyMessageText(message: ICafeThreadMessage): Promise<void> {
  const censored = message.report?.censoredText;
  const text = (typeof censored === "string" && censored !== "" ? censored : message.text) ?? "";

  if (text.trim() === "") {
    $toast.error("این پیام متنی برای کپی ندارد.");
    return;
  }

  await copy(text);

  $toast.success("متن پیام کپی شد.");
}

async function toggleLike(message: ICafeThreadMessage): Promise<void> {
  const id = internalTableId.value;
  if (id === "") return;

  // ⚠️ ONE TOGGLE, NO INTENT. §9 has no dislike endpoint — «disliking» IS
  // un-liking — so this passes nothing and reads the answer's `liked` back out of
  // the store. The row's `like` array is flipped optimistically by the store, so
  // the heart on screen moves on the tap rather than on the answer.
  const result = await cafe.toggleLike(id, message.id);

  if (!result.ok) $toast.error(result.failure.message);
}

function startEdit(message: ICafeThreadMessage): void {
  // ⚠️ THE MATRIX ALREADY GATES THIS. `CafeMessageMenu` shows «ویرایش» for a
  // manager on any message and for the author on an `active` one — §7's own rule,
  // and the backend allows exactly that (§12). The one extra check here is
  // `deleted`: there is no body left to edit, and the store would answer
  // `ERR_MESSAGE_NOT_FOUND` for a sentence the reader cannot see.
  if (message.status === "deleted") return;

  editError.value = null;
  editingId.value = message.id;
}

async function saveEdit(payload: {
  message: ICafeThreadMessage;
  text: string;
}): Promise<void> {
  const id = internalTableId.value;
  if (id === "") return;

  savingEditId.value = payload.message.id;
  editError.value = null;

  const result = await cafe.editMessage(id, payload.message.id, payload.text);

  savingEditId.value = null;

  if (!result.ok) {
    // ⚠️ THE EDITOR STAYS OPEN with the draft intact. Closing it would throw away
    // the reader's words over a refusal, which is the one thing a composer must
    // never do — and the bubble draws the sentence beside the save button.
    editError.value = {
      messageId: payload.message.id,
      text: result.failure.message,
    };
    return;
  }

  editingId.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
  editError.value = null;
}

async function confirmDelete(): Promise<void> {
  const message = pendingDelete.value;
  const id = internalTableId.value;

  if (message === null || id === "") return;

  deleting.value = true;

  const result = await cafe.deleteMessage(id, message.id);

  deleting.value = false;

  if (!result.ok) {
    $toast.error(result.failure.message);
    return;
  }

  // ⚠️ THE MODAL STAYS OPEN ON A REFUSAL, and the toast carries the sentence. It
  // closes only on success — where §13's tombstone is already on screen, so there
  // is nothing to confirm.
  pendingDelete.value = null;
}

/* ------------------------------------------------------------- the report -- */

const reportOpen = ref(false);
const reportTarget = ref<CafeReportTarget>("message");
const reportSubject = ref("");
const reportError = ref<string | null>(null);
const submittingReport = ref(false);

/**
 * ⚠️ THE TABLE'S ID IS `internalTableId` AND **NOT** THE `ch_` HANDLE.
 *
 * §7 stores `report-for=table` under `metadata.table` and matches the id against
 * the table document; a report filed under a public handle names nothing the
 * moderation queue can look up and still answers «ثبت شد». This is the one place
 * on the screen where the handle would be silently wrong rather than loudly.
 */
const reportId = computed<string | null>(() => {
  if (reportTarget.value === "table") {
    return internalTableId.value === "" ? null : internalTableId.value;
  }

  return reportSubject.value === "" ? null : reportSubject.value;
});

function openReport(target: CafeReportTarget, subject = ""): void {
  reportTarget.value = target;
  reportSubject.value = subject;
  reportError.value = null;
  reportOpen.value = true;
}

async function submitReport(payload: {
  reason: string;
  note: string;
}): Promise<void> {
  const id = reportId.value;

  // ⚠ AND IT SAYS SO. A report with no subject would otherwise be a silent
  // no-op: the sheet closes, nothing is filed, and a reader who was told
  // «گزارش شما ثبت شد» is told it by nobody. This is reachable — a table whose
  // internal id has not resolved — so it gets a sentence rather than silence.
  if (id === null) {
    $toast.error("این گزارش ثبت نشد. لطفاً دوباره تلاش کنید.");
    return;
  }

  submittingReport.value = true;
  reportError.value = null;

  const result = await cafe.reportTarget({
    target: reportTarget.value,
    id,
    reason: payload.reason,
    note: payload.note,
    // ⚠️ THE SOURCE IS FREE-FORM REPORTER CONTEXT, and it is the only place this
    // screen says where the report came from — the sheet itself carries no
    // context the moderation queue could read on its own.
    source: reportTarget.value === "message" ? "message-menu" : "table-menu",
  });

  submittingReport.value = false;

  if (!result.ok) {
    // ⚠️ THE SHEET STAYS OPEN AND KEEPS THE DRAFT. `CafeReportSheet` draws the
    // sentence inside the scrolling body, right above the pinned submit button
    // that caused it, precisely so a reader who typed an explanation is never
    // asked to type it twice.
    reportError.value = result.failure.message;
    return;
  }

  reportOpen.value = false;

  $toast.success(
    reportTarget.value === "message"
      ? "گزارش شما ثبت شد و به بررسی مدیران می‌رسد."
      : "گزارش این میز ثبت شد و به بررسی مدیران می‌رسد.",
  );
}

/** Every §7 intent, dispatched from one place. */
async function onMessageIntent(
  message: ICafeThreadMessage,
  intent: CafeMessageIntent,
): Promise<void> {
  // ⚠️ SET **FIRST**, and see the note on `restoreMenuFocus`: «کپی متن» and
  // «پسندیدن» are the only two intents that open nothing, so they are the only two
  // that leave the caret where the menu left it — on the message.
  restoreMenuFocus = intent === "copy" || intent === "like";

  switch (intent) {
    case "reply":
      startReply(message);
      break;
    case "copy":
      await copyMessageText(message);
      break;
    case "like":
      await toggleLike(message);
      break;
    case "report":
      openReport("message", message.id);
      break;
    case "edit":
      startEdit(message);
      break;
    case "delete":
      pendingDelete.value = message;
      break;
  }
}

/* ------------------------------------------------------------ membership -- */

/**
 * `localMembership` — the answer a confirmed write outranks — is declared in the
 * membership section above, next to the derived `membership` it overrides, because
 * those two are one decision and splitting them across 800 lines is how one of
 * them ends up forgotten by the next reader.
 */

/** One join at a time, and one leave at a time. */
const joining = ref(false);

/**
 * Join, and **then** enter the rooms.
 *
 * ⚠️ THE ORDER IS THE CONTRACT. `enter()` is what joins
 * `cafe_<cafeId>_room` and `table_<internalId>_room`, which is what makes the
 * socket deliver this table's messages at all — a member whose room was never
 * joined reads history and then hears nothing.
 *
 * ⚠️ `ERR_USER_SUBSCRIBED` COMES BACK AS `ok: true` (the store maps it), because it
 * is the endpoint's answer when the reader is ALREADY active and this client cannot
 * know that in advance (§18.4). So there is no error to swallow here and none is
 * invented.
 */
async function joinTable(): Promise<void> {
  const id = internalTableId.value;
  if (id === "" || joining.value) return;

  joining.value = true;

  try {
    const result = await cafe.joinTable(id);

    if (!result.ok) {
      $toast.error(result.failure.message);
      return;
    }

    localMembership.value = "member";

    await enterRoom();

    // ⚠️ `/single` is invalidated by the write, and it is where `subscribe` and
    // `isManager` live — so the header and the band re-read it rather than
    // guessing at either.
    await cafe.fetchTable(cafeId.value, tableId.value);
  } finally {
    joining.value = false;
  }
}

/**
 * Leave, and **then** drop the rooms.
 *
 * ⚠️ THE ORDER IS MIRRORED AND IT IS FOR THE SAME REASON. An event already in the
 * socket's buffer when we are done must find no room and no active thread, or it
 * is applied to a conversation the reader has just given up.
 *
 * ⚠️ AND ON A REFUSAL THE ROOMS COME BACK. The store keeps the thread's cache, so
 * re-entering re-reads the tail rather than losing the conversation; leaving the
 * client in no room after a failed leave would be a worse state than the one it
 * was in before the press.
 */
async function leaveTableNow(): Promise<void> {
  const id = internalTableId.value;
  if (id === "" || leavingTable.value) return;

  leavingTable.value = true;

  try {
    leaveRoom();

    const result = await cafe.leaveTable(id);

    if (!result.ok) {
      $toast.error(result.failure.message);

      await enterRoom();
      return;
    }

    localMembership.value = "left";

    // ⚠️ `leaveTable` DISCARDS the thread (the one case the store's cache does not
    // survive), so the band and the composer must be re-derived from `/single`.
    await cafe.fetchTable(cafeId.value, tableId.value);
  } finally {
    leavingTable.value = false;
  }
}

/* --------------------------------------------------------------- the older -- */

/**
 * «پیام‌های قدیمی‌تر» — §15's `direction: "old"`, paged by SEQUENCE.
 *
 * ⚠️ THE CURSOR IS EXPLICIT. A `direction: "old"` read with no `cursor` starts
 * from the reader's own `lastReadMessageId` (§15), which is a read-receipt-relative
 * read and not «the page before this one» — so it is the one argument that can
 * never be defaulted.
 *
 * The list owns the scroll compensation (the anchor) and owns `loadingOlder`; this
 * handler owns only the request, and it swallows nothing: **a refused page preserves
 * the transcript.** `fetchMessages` writes `thread.messages` only on a real page, so
 * the window the reader is in survives a refusal untouched and a page that did not
 * arrive costs one press of the button and not the conversation.
 *
 * ⚠️ AND THE REFUSAL ITSELF IS **NOT DRAWN** ON THIS SCREEN — there is no state block
 * below for it. `errors.messages` is never read here (the transcript region is
 * ungated by design; see the template), and a refusal of an *older page* in
 * particular has nothing truthful to say over thirty messages that are all still
 * there. The reader sees the «پیام‌های قدیمی‌تر» button come back with its own spinner
 * gone. That silence is a known absence, not an oversight — say so before adding
 * error UI for it.
 */
async function loadOlder(): Promise<void> {
  const id = internalTableId.value;
  const cursor = thread.value?.olderCursor;

  if (id === "" || cursor === null || cursor === undefined) return;

  await cafe.fetchMessages(id, { direction: "old", cursor });
}

/* ------------------------------------------------------------ socket state -- */

/**
 * `app:error` is the socket's ONE failure channel and it means «an operation was
 * refused» — not «the connection is down». A message may be refused while the
 * transport carries others perfectly well, so it is drawn as a dismissible band
 * and **never** as `errors.messages`: blanking a thirty-message transcript over one
 * refused like is the mistake the store's whole mutation path exists to avoid.
 */
const socketFailure = computed(() => cafe.socketFailure);

function dismissSocketFailure(): void {
  cafe.clearSocketFailure();
}

/* ------------------------------------------------------------- scroll/tick -- */

/**
 * A ref on the **wrapper**, not on `<CafeMessageList>`.
 *
 * `CafeMessageList` owns its scroller and exposes no imperative handle, and
 * reaching through the component instance to read `$el` would be an untyped `any`
 * on a DOM node. The wrapper is the same region seen from outside: it is the flex
 * column the list fills, and `[role="log"]` inside it is the only scrolling box on
 * the screen. Querying for it by its own ARIA role means this code depends on the
 * list's *contract* rather than on its class names.
 *
 * It is read on mount, and still on nothing else, for the reason it was: a watcher
 * on the message list would also fire for a history read, a socket delivery and a
 * reaction, and yanking the reader to the bottom while they are reading something
 * twenty messages up is the single most irritating thing a chat screen can do.
 * `CafeMessageList` owns the stick-to-bottom case itself, and only for a reader
 * who is already there.
 *
 * ⚠️ AND THE JUMP BELOW POSTS **NO** RECEIPT — do not read it as §8's «on open».
 * Its only job is to put the reader on the NEWEST message instead of on the first
 * page's oldest row, which is what a conversation screen is for. The entry
 * receipt is `useCafeThreadSocket`'s: it calls `scheduleMarkSeen` right after the
 * first page lands (`:187-192` there), because §19.1 posts it then. This jump
 * cannot produce one on its own — `reach-end` needs `atBottom()` to BECOME true,
 * and a programmatic jump is not an edge — which is also why it is safe that a
 * warm entry changes no length and fires nothing.
 */
const threadRegion = useTemplateRef<HTMLElement>("thread");

onMounted(async () => {
  await nextTick();

  const log = threadRegion.value?.querySelector<HTMLElement>('[role="log"]');

  // ⚠️ `CafeMessageList` renders `[role="log"]` in EVERY state, so this is
  // unreachable — and it is guarded rather than asserted because the jump below
  // depends on it existing, and an unguarded access would throw on a client render
  // where the list has not mounted.
  if (log === undefined || log === null) return;

  // ⚠️ ONCE, and only into an empty list: `CafeMessageList` owns every later move,
  // and only for a reader who is already at the bottom.
  log.scrollTop = log.scrollHeight;
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
        overflow-label="گزینه‌های گفتگو"
        @overflow="tableMenuOpen = true"
      />

      <!--
        ⚠️ `online` IS GONE. The design wave passed `true` here because the fixture
        had a roster with `isOnline`; this route's payload has none, and a green
        presence dot on a table nobody's presence is known for is the app telling the
        reader where somebody is. Presence arrives with the socket's
        `cafe:table:join-new-user`, which this screen's composable now applies.
      -->

      <!--
        ⚠️ THE SOCKET'S ONE FAILURE CHANNEL, AND IT IS **NOT** THE TRANSCRIPT'S.

        `app:error` means «an operation was refused» — not «the connection is down».
        A message may be refused while the transport carries others perfectly well,
        so this is a dismissible band and **never** `errors.messages`: blanking a
        thirty-message conversation over one refused like is the mistake the store's
        whole mutation path exists to avoid.

        Drawn directly under the header, in the same quiet shape as the two bands
        below it, because it is the same kind of sentence: a standing fact the reader
        can acknowledge and carry on from — not an alert that floats over the thread
        and makes leaving look like an error.
      -->
      <div
        v-if="socketFailure"
        role="status"
        class="flex shrink-0 items-center gap-2 bg-red-50 px-4 py-2"
      >
        <UIcon
          name="solar:danger-triangle-linear"
          size="18"
          class="shrink-0 text-red-600"
          aria-hidden="true"
        />

        <p class="min-w-0 flex-1 text-xs leading-5 text-red-700">
          {{ socketFailure.message }}
        </p>

        <button
          type="button"
          aria-label="بستن این پیام"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-red-600 transition-colors hover:bg-red-100"
          @click="dismissSocketFailure"
        >
          <UIcon name="solar:close-circle-linear" size="18" aria-hidden="true" />
        </button>
      </div>

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
            ⚠️ **WIRED, AND IN THIS ORDER.** `POST /table/:tableId/left` is a SOFT
            membership write (§6 sets `status: "left"`), and it is undone by one tap
            — «عضویت در میز» on the join bar, which `POST /table/subscribe`
            reactivates. So this control has no confirmation modal: a second gate on
            an action with a one-tap inverse is a second dialog for nothing. The
            destructive emphasis — red ink, a leave icon — carries the weight.

            The message **delete** is the opposite case and does get one
            (`CafeConfirmDelete`), because a soft delete replaces the body for
            everyone in the room and re-posting the words is not guaranteed.

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
            :disabled="leavingTable"
            aria-label="خروج از این میز"
            class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            @click="leaveTableNow"
          >
            <UIcon
              :name="leavingTable ? 'solar:restart-linear' : 'solar:logout-2-linear'"
              size="16"
              :class="leavingTable ? 'motion-safe:animate-spin' : ''"
              aria-hidden="true"
            />
            خروج از میز
          </button>

          <!--
            The one control on this band that is still visual-only, and it is visual
            only because it changes nothing the server holds: it hides a band that
            is still true. The reader gets it back on the next visit.
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
            two states that draws it. Two buttons offering the same action — one
            pinned under the header and one at the bottom — is not two chances to
            re-join, it is the same dead end twice. The band keeps the FACT; the bar
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
      <div ref="threadRegion" class="flex min-h-0 flex-1 flex-col">
        <!--
          ⚠️ **UNGATED, IN EVERY STATE OF `secureChat`.** There is no `v-if` here and
          there must not be one. The list is the table's content; a window's state
          changes what the header PINS about that content, never whether it is
          drawn. The wave that gated this on `secureChat !== "closed"` blanked the
          conversation of every table without a secure chat and replaced it with
          «گفتگوی امن به پایان رسید» — a window those tables never had.

          ⚠️ AND A READ THAT FAILED IS NOT AN ERROR BLOCK HERE EITHER. The transcript
          region is drawn whatever `errors.messages` holds, because §15's refusal
          arrives as `success: true` and a reader who is shown «پیام‌ها بارگذاری
          نشد» over a conversation with thirty messages has been told a falsehood.
          `CafeStateBlock`'s own empty state draws when the thread really is empty,
          and that is the only «nothing here» sentence on this screen.

          ⚠️ `tableId` IS THE **INTERNAL** ID and `thread` is the paging state, both
          because the list reads `newMessagesFrom(tableId)` — a **store** getter — and
          because `cafe.threadFor()` creates an entry and must never be called from a
          render.

          ⚠️ `@reach-end` IS THE READ RECEIPT'S ONLY TRIGGER on this screen: the list
          knows `atBottom()` and this page does not, so a live row while the reader is
          twenty messages up and a reader arriving at the bottom are two different
          facts the list can tell apart and only it can see.
        -->
        <CafeMessageList
          :messages="messages"
          :members="members"
          :my-id="myId"
          :now="now"
          :table-id="internalTableId"
          :thread="thread"
          :can-send="composerEnabled"
          :is-manager="currentTable?.isManager === true"
          :editing-id="editingId"
          :saving-edit-id="savingEditId"
          :edit-error="editError"
          @menu="openMessageMenu"
          @load-older="loadOlder"
          @like="toggleLike"
          @reach-end="markSeenSoon"
          @edit="saveEdit"
          @cancel-edit="cancelEdit"
        />
      </div>

      <!--
        THE JOIN BAR, which takes the composer's place when the reader is not in
        this table.

        It is drawn in the composer's position and not as a band above the thread
        for the reason the composer is: it answers the question the reader has at
        THIS moment («why can I not write here?»), so it belongs where the input
        they wanted is missing rather than pinned above a transcript that is not
        theirs.

        `min-h-11` for the same reason as the «خروج از میز» control it mirrors: it is
        the screen's primary action here, and 44px is the floor below which a thumb
        misses. `inline-flex items-center` is what stops a 44px box from pushing its
        own label out of the top of itself — a `<button>` is `inline-block`, and
        `min-height` enlarges the box without re-centring what is inside it.

        ⚠️ AND IT IS **DISABLED** UNTIL THE TABLE'S INTERNAL ID RESOLVES. A deep link
        carries a handle the store cannot turn into an id, and a live button that
        would post `/table//subscribe` is a control that promises something it cannot
        do — which is the trade this screen has refused three times now. In practice
        `/single` is awaited in this setup body, so the id is known by the time this
        bar can draw; the `:disabled` is the guard, not the state.
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
          :disabled="joining || internalTableId === ''"
          :loading="joining"
          aria-label="عضویت در این میز"
          class="shrink-0"
          :ui="{ base: 'min-h-11 rounded-full px-4 text-xs font-bold' }"
          @click="joinTable"
        />
      </div>

      <!--
        ⚠️ A REFUSED SEND, DRAWN **BESIDE** THE COMPOSER AND NOT AS A TOAST.

        The draft is deliberately still in the field — that is the promise this
        wave keeps — so the sentence has to live next to the field the words are
        still in, or the reader is left re-reading a message that left before they
        did. It is `role="alert"`, so it is announced, and it is dismissible, so it
        does not sit under the composer for the rest of the visit.
      -->
      <div
        v-if="sendError"
        role="alert"
        class="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-red-50 px-3 py-2"
      >
        <UIcon
          name="solar:danger-triangle-linear"
          size="18"
          class="shrink-0 text-red-600"
          aria-hidden="true"
        />

        <p class="min-w-0 flex-1 text-xs leading-5 text-red-700">
          {{ sendError }}
        </p>

        <button
          type="button"
          aria-label="بستن این پیام"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-red-600 transition-colors hover:bg-red-100"
          @click="sendError = null"
        >
          <UIcon name="solar:close-circle-linear" size="18" aria-hidden="true" />
        </button>
      </div>

      <!--
        ⚠️ THE REPLY STRIP, DIRECTLY ABOVE THE COMPOSER AND INSIDE ITS OWN REGION.

        Doc §7's «پاسخ» is "quote locally": the quote is a piece of UI, not a field,
        and the only thing that goes on the wire is `reaplayToMessageId` on the send.
        Drawn here rather than inside `CafeComposerShell` because that component
        owns the input row and nothing about a thread — a primitive that grew a
        conversation's state would be the odd component.

        `line-clamp-2` because a quoted message can be a paragraph and the strip is
        32px tall by design: it is a reminder of what is being answered, not a
        second copy of it.
      -->
      <div
        v-if="replyTarget !== null"
        class="flex shrink-0 items-start gap-2 border-t border-slate-200 bg-x-primary-content-50 px-3 pt-2"
      >
        <UIcon
          name="solar:reply-linear"
          size="18"
          class="mt-0.5 shrink-0 text-x-text-subtitle"
          aria-hidden="true"
        />

        <p class="line-clamp-2 min-w-0 flex-1 text-xs leading-5 text-x-text-subtitle">
          {{ replyQuote || "پیام" }}
        </p>

        <button
          type="button"
          aria-label="لغو پاسخ"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-subtitle transition-colors hover:bg-x-primary-content-200"
          @click="cancelReply"
        >
          <UIcon name="solar:close-circle-linear" size="18" aria-hidden="true" />
        </button>
      </div>

      <!--
        The composer, gated on BOTH questions: `showComposer` is the reader being a
        member, `composerEnabled` adds the sending window.

        ⚠️ `maxlength` IS §11's `MESSAGE_TEXT_MAX` (see the note on the constant in
        the script) — handed down to the primitive rather than written there, so the
        one place that knows the number is the one place the store checks it against.

        ⚠️ `loading` IS THE STORE'S `sendPending` LATCH, not a spinner: it is what
        makes the field, the `+` and the mic go quiet together while a send is in
        the air, so a double-tap cannot spend two of §11's 30-per-60s on one intent.
      -->
      <CafeComposerShell
        v-if="showComposer"
        ref="composer"
        v-model="draft"
        :disabled="!composerEnabled"
        :loading="cafe.sendPending"
        :maxlength="MESSAGE_TEXT_MAX"
        :placeholder="composerPlaceholder"
        @attach="attachOpen = true"
        @mic="voiceOpen = true"
        @submit="submitDraft"
      />

      <!--
        ⚠️ `CafeMessageMenu` IS RENDERED **HERE**, NOT INSIDE THE LIST, because the
        list emits an intent and a trigger and cannot own a sheet's open state:
        only this screen knows a message is on screen, so only this screen can give
        focus back to the row that opened the menu when it closes.
      -->
      <CafeMessageMenu
        v-if="menuMessage !== null"
        :open="menuOpen"
        :message="menuMessage"
        :own="menuMessage.senderId === myId"
        :can-send="composerEnabled"
        :is-manager="currentTable?.isManager === true"
        :liked="
          myId !== undefined &&
          Array.isArray(menuMessage.like) &&
          menuMessage.like.includes(myId)
        "
        @update:open="menuOpen = $event"
        @select="onMessageIntent(menuMessage, $event)"
      />

      <!--
        ⚠️ `canLeave` IS THE BAND'S OWN GATE. A reader this screen cannot vouch for
        (`membership === "none"`) is very likely not in the table, and «خروج از میز»
        would be a promise §6's endpoint cannot keep for a row that does not exist
        (it requires an ACTIVE participant row, else 404).
      -->
      <CafeTableMenu
        :open="tableMenuOpen"
        :leaving="leavingTable"
        :can-leave="isJoined"
        :table-name="currentTable?.nikname ?? ''"
        @update:open="tableMenuOpen = $event"
        @select="onTableIntent"
      />

      <!--
        §7's report, at BOTH levels through ONE sheet: the message level from the
        context menu, the table level from the header's `⋯`. `reportId` already holds
        the right id for each — the message's own for one, and `internalTableId` for
        a table, because `report-for=table` matches on `Cafe Table.id` and a report
        filed under the `ch_` handle names nothing the moderation queue can look up.
      -->
      <CafeReportSheet
        :open="reportOpen"
        :target="reportTarget"
        :submitting="submittingReport"
        :error="reportError"
        @update:open="reportOpen = $event"
        @submit="submitReport"
      />

      <CafeConfirmDelete
        :open="pendingDelete !== null"
        :loading="deleting"
        @update:open="pendingDelete = null"
        @confirm="confirmDelete"
      />

      <!--
        The two composer sheets, in the composer's own region rather than in a
        `UModal`, so they sit on the same surface the `+` and the mic are drawn on —
        the bar keeps its place while the sheet covers it.

        ⚠️ `CafeAttachSheet`'s `select` IS BOUND, and it says in Persian that the
        upload endpoint does not exist yet. It is not left unbound because unbound is
        silent: a tile that emits into nothing is a tile that does nothing, and the
        reader is left wondering whether their tap registered. `CafeVoiceRecorder`'s
        `send` stays unbound for the same reason as its `recording` prop — it carries
        **no bytes** (`send: []`), so there is nothing to send and nothing to say
        beyond what its own UI already shows.
      -->
      <CafeAttachSheet v-model:open="attachOpen" @select="onAttachSelect" />

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