<script setup lang="ts">
import { useEventListener, useTimeoutFn } from "@vueuse/core";

import type { ICafeThread, ICafeThreadMessage, ITableUserView } from "~/types/cafe";

/**
 * The conversation transcript — Screen B's scroll area.
 *
 * ## WHY THIS COMPONENT OWNS GROUPING, AVATARS AND DAY CHIPS, AND OWNS NOTHING
 * ELSE
 *
 * Those three decisions are *about the thread*: who is speaking, when they
 * started, and which day a message falls on. They need the whole list to answer
 * — the run of a sender, the previous message's instant, the previous day — and
 * none of them can be answered by a bubble looking at itself. So they live here,
 * once, where the list is available.
 *
 * What a bubble *looks* like stays in `CafeMessageBubble`. In particular, `own`
 * is resolved here and passed as a plain boolean rather than letting each bubble
 * compare ids itself: a component that guesses identity produces a
 * wrong-coloured bubble when the auth store and the socket disagree, which reads
 * as a rendering bug rather than as an obvious failure. One decision, one place.
 *
 * ## WHY THE AUTHOR OF A **QUOTED** MESSAGE IS RESOLVED HERE AS WELL
 *
 * The same argument covers the roster. A reply's blockquote is headed by whoever
 * wrote the message being replied to, and the only field that says so is
 * `reaplayTo.userId` — a `members` lookup, not a property of the bubble. Resolved
 * here, next to `props.members[message.senderId]`, and handed over as a plain
 * string like every other resolved name on this row.
 *
 * ## WHY `role="log"` AND **NOT** `aria-live`
 *
 * `role="log"` is the ARIA role for a chat transcript: it is a region of
 * important, changing content, and it is **not** a live region. That is the
 * correct semantics here because this thread is also the app's scroll
 * container: an `aria-live="polite"` wrapper would announce every message that
 * arrives, on top of every message already on screen when the screen reader
 * decides to re-read the region after the list re-renders, which on a 30-message
 * history is thirty announcements nobody asked for.
 *
 * What *does* announce is the screen: `CafeChatHeader` carries the table's name,
 * so a reader arriving at the conversation is told where they are.
 *
 * ## WHY THE DAY SEPARATOR COMPARES CALENDARS INSTEAD OF NAMING ONE
 *
 * `CafeMessageTimestamp` already owns every date in this feature: «امروز»,
 * «دیروز», the weekday, the absolute Jalali date. This file names nothing.
 *
 * It does need one thing the component does not expose: a way to ask "is this
 * message on a different day than the previous one?", which is a *comparison*,
 * not a label. That comparison is done the same way `CafeMessageTimestamp` does
 * its own day arithmetic — the Tehran y/m/d triple read through `en-US` numeric
 * parts, folded into a continuous integer day number by `Date.UTC`. Two things
 * make that safe to write a second time:
 *
 * - it is calendar-agnostic arithmetic (counting whole days), not a conversion,
 *   so there is no Jalali code here that could disagree with `faDate`;
 * - the zone is pinned to the same `Asia/Tehran` that `MessageTimestamp` pins,
 *   so a chip cannot say «امروز» for a day the chip below it calls yesterday.
 *
 * If that helper ever moves, it moves in `app/utils/fa.ts` and both files are
 * updated together — the reference is written into both.
 *
 * ## ⚠️ THREE DOORS INTO ONE MENU, AND WHY ALL THREE EXIST
 *
 * A phone has no right-click, so a menu that only listened for `contextmenu`
 * would be unreachable on the device this app is built for. So every input gets a
 * door, and all three lead to the same `menu` event:
 *
 * - **`pointerdown` → 500 ms → the menu.** The gesture every messenger on a phone
 *   uses. It needs a tolerance: 12px of travel cancels it, because a press that
 *   has turned into a scroll is a scroll and must not also open a menu over the
 *   message the reader was trying to move away from.
 * - **`contextmenu`** — a mouse, or a trackpad's two-finger click, with the
 *   browser's own menu suppressed: two menus for one gesture is worse than either.
 * - **`Enter` / `Space` on the focused row** — because the row is `tabindex="0"`,
 *   so the menu is reachable from a keyboard rather than only from a pointer. The
 *   handler **bails when the event did not originate on the row itself**, so a
 *   keystroke inside the bubble's own edit textarea is never stolen. ⚠️ There
 *   is deliberately NO retry control on a failed row — `sendMessage` always builds a
 *   fresh `local:` row, so a retry would leave the red row PLUS a duplicate.
 *
 * All three land on `messageAt`, and ⚠️ **all three are silent on a row that is still
 * sending or that failed** — one guard (`canOpenMenu`), because a menu whose every
 * command is refused by the proxy is a dead end with a sheet on top of it. See that
 * predicate for the mechanism; the row keeps its own «در حال ارسال» / «ارسال نشد»
 * chip, so nothing the reader needs is lost with the commands.
 *
 * ## ⚠️ WHY THE STATE (`isRead`, `newMessagesFrom`) IS READ FROM THE STORE HERE
 *
 * Both are **pure getters about this device**, and neither belongs on a prop a
 * screen has to keep in step with a thread it does not own. `isRead(sequence)`
 * answers «has THIS client posted a receipt covering this one», and
 * `newMessagesFrom(tableId)` answers «where is the boundary between what I have
 * read and what I have not». Passing them down would mean two numbers threaded
 * through the page for no reader but this one.
 *
 * ⚠️ AND THE CONSEQUENCE IS WRITTEN DOWN BECAUSE IT IS A TRAP: **A ROW WITH NO
 * `sequence` IS NEVER GIVEN A POSITION.** `isRead(null)` answers `false` in the
 * store, and the divider below only compares rows whose `sequence` is a number —
 * so a broadcast row nobody has reconciled yet renders in place, with no tick and
 * no divider, instead of being silently pushed onto the read frontier.
 */

/** The same constant `CafeMessageTimestamp` and `app/utils/fa.ts` pin. */
const TIME_ZONE = "Asia/Tehran";

const DAY_MS = 86_400_000;

/**
 * How long two consecutive messages from one sender still count as a single
 * run. Five minutes is the gap a reader does not perceive as a pause: below it,
 * consecutive bubbles merge into one block (as the reference draws them); above
 * it, there was clearly something else in between and the avatar comes back.
 */
const GROUP_WINDOW_MS = 5 * 60_000;

/** How long a finger has to rest before it meant «open the menu» rather than «scroll». */
const LONG_PRESS_MS = 500;

/**
 * How far the pointer may travel inside that window and still be a long press.
 *
 * ⚠️ 12px is below the threshold at which a thumb's own tremor reads as movement,
 * and well below the ~24px a scroll needs before the browser commits to it — so a
 * rest becomes a menu and a deliberate swipe never does.
 */
const LONG_PRESS_SLOP_PX = 12;

/**
 * How long after a long press a click is still swallowed.
 *
 * ⚠️ A WINDOW, NOT A FLAG, and the reason is a lift-off: the finger comes up over
 * the sheet, and where the browser decides that `click` belongs is not something
 * this component controls — it may land on the row, on the overlay, or nowhere.
 * A boolean left set until the next click would swallow an unrelated tap; a
 * timestamp forgets on its own.
 */
const CLICK_SWALLOW_MS = 700;

/** See the file header — numeric fields only, assembled by hand, never parsed. */
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

const props = withDefaults(
  defineProps<{
    /** The history, oldest first — the order `GET /table/:tableId/messages` returns. */
    messages: ICafeThreadMessage[];
    /** `senderId` → sender. Optional: a thread of two does not need a roster. */
    members?: Record<string, ITableUserView>;
    /** The reader's own `userId`. Decides which side every message is on. */
    myId?: string;
    /** Epoch ms of "now", forwarded to the timestamps. Omit for absolute labels. */
    now?: number;
    /**
     * The table's **INTERNAL** id — the key `threads` is written under, and the
     * argument `newMessagesFrom` takes. ⚠️ Never the `ch_` handle a URL carries.
     */
    tableId?: string;
    /**
     * The thread's paging state. Passed rather than read from the store because
     * `threadFor()` **creates** an entry, and a getter that writes during a render
     * is a getter that must not be called from one.
     */
    thread?: ICafeThread | null;
    /** The reader may post here: membership AND the sending window. Gates «پاسخ». */
    canSend?: boolean;
    /** `GET …/single`'s `isManager`. §7's manager arm on edit and delete. */
    isManager?: boolean;
    /** The `id` of the row the parent has switched into its editor, or `null`. */
    editingId?: string | null;
    /** The `id` of the row whose edit is in the air, or `null`. */
    savingEditId?: string | null;
    /** The refusal from the last edit, addressed to the row that caused it. */
    editError?: { messageId: string; text: string } | null;
  }>(),
  {
    members: () => ({}),
    tableId: "",
    thread: null,
    canSend: false,
    isManager: false,
    editingId: null,
    savingEditId: null,
    editError: null,
  },
);

const emit = defineEmits<{
  /**
   * A message's menu was asked for. `trigger` is the row that was pressed, and
   * the **parent** owns giving focus back to it when the sheet closes — this
   * component cannot, because only the page knows a message is on screen.
   */
  menu: [payload: { message: ICafeThreadMessage; trigger: HTMLElement }];
  /** «پیام‌های قدیمی‌تر» was pressed. The page owns `fetchMessages`. */
  loadOlder: [];
  /**
   * The bubble's heart was pressed. The page owns `toggleLike`; the bubble knows
   * nothing about the request, exactly as it knows nothing about the menu.
   */
  like: [message: ICafeThreadMessage];
  /**
   * ⚠️ **THE END OF THE TRANSCRIPT WAS REACHED**, and this is a POSITION, not a
   * scroll event.
   *
   * The read receipt belongs to the newest thing on screen, so it is posted from
   * the two moments this component can actually tell apart — the reader was
   * already at the end when a row landed, and the reader ARRIVED at the end. It
   * is emitted on the false→true edge of `atBottom()` only, so scrolling through
   * the middle of a long thread never fires it; the page's
   * `scheduleMarkSeen` throttle is the rate limiter, and this is what decides
   * whether a receipt is warranted at all.
   */
  reachEnd: [];
  /** The bubble's editor saved. */
  edit: [payload: { message: ICafeThreadMessage; text: string }];
  /** The bubble's editor was cancelled — Escape, or «انصراف». */
  cancelEdit: [];
}>();

const cafe = useCafe();

function toTime(value: string | undefined): number | null {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

/**
 * The Tehran day number of a moment. Mirrors `dayIndex` in
 * `CafeMessageTimestamp` exactly; see the file header for why it is written
 * twice and why that is not a second calendar.
 */
function dayIndex(value: string | undefined): number | null {
  const time = toTime(value);
  if (time === null) return null;

  const parts = dayFormatter.formatToParts(new Date(time));
  const read = (type: "year" | "month" | "day"): number => {
    const raw = parts.find((part) => part.type === type)?.value ?? "";
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Two messages are one run when they are close enough to read as one thought. */
function withinRun(
  previous: ICafeThreadMessage,
  message: ICafeThreadMessage,
): boolean {
  const from = toTime(previous.createdAt);
  const to = toTime(message.createdAt);
  if (from === null || to === null) return false;

  return Math.abs(to - from) <= GROUP_WINDOW_MS;
}

/**
 * One row of the scroller: a day chip, the unread divider, or a bubble.
 *
 * A flat discriminated union rather than "the bubbles, plus the chips spliced
 * in during render" because the chip has to sit *between* two messages in DOM
 * order — a `v-if` on the message and a separate loop for the chips can produce
 * that, but it needs the two lists index-matched by hand, and the first list's
 * indices stop matching the moment one message is filtered out.
 */
type ThreadRow =
  | { kind: "chip"; key: string; value: string }
  | { kind: "divider"; key: string }
  | {
      kind: "message";
      key: string;
      message: ICafeThreadMessage;
      own: boolean;
      showAvatar: boolean;
      grouped: boolean;
      senderName: string;
      senderImage: string;
      repliedName: string;
      /** This reader's like, resolved once here — see the file header. */
      liked: boolean;
      likeCount: number;
      read: boolean;
      editing: boolean;
      savingEdit: boolean;
      editError: string | null;
    };

/** The one variant that is a message, so `message` is not a union to narrow. */
type ResolvedRow = Extract<ThreadRow, { kind: "message" }>;

const resolvedRows = computed<ResolvedRow[]>(() => {
  const myId = props.myId;
  const editingId = props.editingId;
  const savingEditId = props.savingEditId;
  const editError = props.editError;

  return props.messages.map((message, index) => {
    const previous = index > 0 ? props.messages[index - 1] : undefined;

    const own = message.senderId === myId;

    // ⚠️ `senderId` IS NULLABLE on a row this client is holding, so it is
    // narrowed here with `?? ""` rather than indexed: `members[message.senderId]`
    // does not compile, and the `?? ""` answers `undefined` and draws no name —
    // the correct picture for a broadcast nobody has reconciled yet.
    const sender = props.members[message.senderId ?? ""];

    /*
     * ## THE AUTHOR OF THE **QUOTED** MESSAGE, WHICH IS NOT THE SENDER
     *
     * A reply's blockquote is labelled with whoever wrote the message being
     * replied to, so «آرش» above نگار's words is a lie about the thread: it names
     * the replier, and every reply on screen would carry it. The only field that
     * holds the answer is `reaplayTo.userId`, and resolving it is a roster lookup
     * exactly like the `sender` one just above — which is the whole reason this
     * list owns sender resolution instead of leaving it to a bubble looking at
     * itself.
     *
     * Empty when the backend sent no `userId` on the reply (it does not always),
     * and the bubble's own fallback prints «پیام» then. An unlabelled quote is a
     * small absence; a quote attributed to the wrong person is a false one.
     */
    const repliedUserId = message.reaplayTo?.userId;
    const repliedName = repliedUserId
      ? (props.members[repliedUserId]?.fullName ?? "")
      : "";

    /*
     * `grouped` means "this continues the previous sender's run", so the FIRST
     * message of a run is never grouped — which is exactly what gives that one
     * the larger outer corner while the rest of the run gets the tighter one,
     * the shape the reference draws.
     *
     * A day boundary also breaks the run even if two messages land on either
     * side of midnight within five minutes: the chip between them says the day
     * changed, and a bubble merged across that chip would read as one
     * uninterrupted thought.
     *
     * ⚠️ **BOTH SIDES MUST CARRY A REAL `senderId`.** §14.1 lets a broadcast
     * arrive with a `createdAt` but no `senderId`; two such rows in a row would
     * compare `null === null` and group, hiding the second one's avatar and
     * implying a speaker the transcript does not know. §14.1 also lets a broadcast
     * arrive with NEITHER field, which is why this cannot lean on "a sequence-less
     * row has no `createdAt`" any more — that barrier is gone by design.
     */
    const grouped =
      previous !== undefined &&
      previous.senderId != null &&
      message.senderId != null &&
      previous.senderId === message.senderId &&
      dayIndex(message.createdAt) === dayIndex(previous.createdAt) &&
      withinRun(previous, message);

    /*
     * §9's `like` is a flat list of user ids: `includes(myId)` IS the state and
     * `length` IS the count. An unresolved session answers `false` rather than
     * guessing, so it draws an empty heart and never a filled one it cannot
     * justify.
     */
    const likes = Array.isArray(message.like) ? message.like : [];

    return {
      kind: "message",
      key: message.id,
      message,
      own,
      // The avatar marks the START of a run, and only on the far side: the
      // reader already knows which messages are theirs.
      showAvatar: !grouped,
      grouped,
      senderName: sender?.fullName ?? "",
      senderImage: sender?.avatar ?? "",
      repliedName,
      liked: myId !== undefined && myId !== null && likes.includes(myId),
      likeCount: likes.length,
      // ⚠️ A SEQUENCE-LESS ROW ANSWERS `false` IN THE STORE AND IS NEVER ASKED TO
      // SIT ON THE READ FRONTIER. See the file header.
      read: cafe.isRead(message.sequence),
      editing: editingId !== null && editingId === message.id,
      savingEdit: savingEditId !== null && savingEditId === message.id,
      editError: editError !== null && editError.messageId === message.id
        ? editError.text
        : null,
    };
  });
});

/**
 * ⚠️ THE UNREAD BOUNDARY, AND WHY IT IS A SEQUENCE AND NOT A COUNT.
 *
 * `newMessagesFrom(tableId)` returns the **`sequence`** the divider belongs at —
 * `lastSeenSent + 1`, the first thing this device has NOT reported as read — and
 * `null` when this visit has posted no receipt yet. `null` draws nothing, and
 * that is the honest answer: a conversation opened fresh has no «since you were
 * here» to divide.
 *
 * It is compared against `sequence` and never against an index, because a row
 * with no `sequence` has no position in the order the divider is talking about.
 * Such a row renders by its arrival order and is counted into neither side.
 */
const dividerFrom = computed<number | null>(() =>
  props.tableId === "" ? null : cafe.newMessagesFrom(props.tableId),
);

const rows = computed<ThreadRow[]>(() => {
  const resolved = resolvedRows.value;
  const divider = dividerFrom.value;

  const withChips: ThreadRow[] = [];
  let drawn = false;

  resolved.forEach((row, index) => {
    const day = dayIndex(row.message.createdAt);
    const previousDay =
      index > 0 ? dayIndex(resolved[index - 1]!.message.createdAt) : null;

    // A message with no usable date cannot open a day, so it never grows a chip.
    if (day !== null && previousDay !== day) {
      withChips.push({
        kind: "chip",
        // Keyed on the message that opens the day, not on the day number: a
        // message whose `createdAt` never arrived sits between two same-day
        // messages and would make the day number repeat, which is a duplicate
        // key and a Vue warning. The message id is unique by construction.
        key: `chip-${row.key}`,
        value: row.message.createdAt ?? "",
      });
    }

    // ⚠️ ONCE, before the first row at or after the boundary — so a transcript
    // with nothing new grows no divider at all rather than one at the top.
    if (
      !drawn &&
      divider !== null &&
      typeof row.message.sequence === "number" &&
      row.message.sequence >= divider
    ) {
      withChips.push({ kind: "divider", key: `divider-${row.key}` });
      drawn = true;
    }

    withChips.push(row);
  });

  return withChips;
});

/* ----------------------------------------------------------------- paging -- */

/**
 * ⚠️ `olderCursor` IS REQUIRED BEFORE THE CONTROL APPEARS, and this is the one
 * place naive paging goes wrong.
 *
 * A `direction: "old"` read with **no** `cursor` is not «the oldest page» — §15
 * says an absent cursor starts the walk from the reader's own
 * `lastReadMessageId`, i.e. it is a read-receipt-relative read that would answer
 * the very window the screen already holds. So the button is drawn only when the
 * server has said there is more AND has given the cursor to walk it with.
 */
const canLoadOlder = computed(
  () => props.thread?.hasOlder === true && props.thread.olderCursor !== null,
);

const loadingOlder = computed(() => props.thread?.loadingOlder === true);

/* --------------------------------------------------------------- scrolling -- */

const log = useTemplateRef<HTMLElement>("log");

/** How close to the bottom still counts as «reading the newest thing». */
const BOTTOM_SLOP_PX = 80;

function atBottom(): boolean {
  const box = log.value;
  if (box === null) return true;

  return box.scrollHeight - box.scrollTop - box.clientHeight <= BOTTOM_SLOP_PX;
}

function toBottom(): void {
  const box = log.value;
  if (box === null) return;

  box.scrollTop = box.scrollHeight;
}

/**
 * ⚠️ THE SCROLL ANCHOR, and it exists for exactly one moment: **an older page
 * arriving**.
 *
 * Naive appending is correct in every other case and catastrophic in this one.
 * Prepending fifteen messages pushes everything down by their height; a browser
 * with no compensation keeps `scrollTop` at the same number and throws the reader
 * fifteen rows *into the past* — the exact opposite of what «پیام‌های قدیمی‌تر»
 * promised, and the one thing that makes older-history loading unusable.
 *
 * So the height is sampled **before** the request leaves, and the difference is
 * added back to `scrollTop` once the new rows are in the DOM.
 */
let anchorHeight = 0;
let anchorTop = 0;

/**
 * ⚠️ A BOOLEAN, NOT A COUNTER, and it is cleared **ONE TICK LATE** on purpose.
 *
 * Three watchers fire in the same flush when an older page lands: the head's id
 * changed, `loadingOlder` fell back to `false`, and the length grew. Clearing the
 * flag synchronously in the second of those would clear it before the third runs,
 * and the third is what would then scroll a reader who was reading the top of the
 * transcript straight to the bottom of it. So the clear is deferred a tick — by
 * which time every watcher of this flush has already had its say, and the anchor
 * restore is on its own frame.
 */
let restoring = false;

function loadOlder(): void {
  if (loadingOlder.value || !canLoadOlder.value) return;

  const box = log.value;

  anchorHeight = box?.scrollHeight ?? 0;
  anchorTop = box?.scrollTop ?? 0;
  restoring = true;

  emit("loadOlder");
}

/**
 * ⚠️ MEASURED ON THE FRAME **AFTER** THE DOM IS WRITTEN.
 *
 * `nextTick` resolves once Vue has patched the DOM, but the browser has not laid
 * the new rows out — and `scrollHeight` reads the layout box. One
 * `requestAnimationFrame` puts this after that layout without waiting for a
 * paint, and nothing else writes to this scroller in between.
 */
function restoreAnchor(): void {
  const box = log.value;

  if (box === null) return;

  const delta = box.scrollHeight - anchorHeight;
  if (delta <= 0) return;

  box.scrollTop = anchorTop + delta;
}

/**
 * A page of OLDER history is the only thing that changes this list's HEAD. Live
 * broadcasts append (a row with no `sequence` sorts last, by the store's own
 * rule) and a catch-up only walks `direction: "new"`, so `messages[0].id` moving
 * is this wave and nothing else.
 */
watch(
  () => props.messages[0]?.id,
  () => {
    if (!restoring) return;

    void nextTick(() => {
      if (import.meta.client && typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreAnchor);
        return;
      }

      restoreAnchor();
    });
  },
);

/**
 * ⚠️ THE FLAG'S ONLY OTHER EXIT, and it is the "nothing arrived" case: a refused
 * read leaves the head exactly where it was.
 *
 * `nextTick` here is load-bearing and is explained above — see `restoring`.
 */
watch(loadingOlder, (loading) => {
  if (loading || !restoring) return;

  void nextTick(() => {
    restoring = false;
  });
});

/**
 * ⚠️ STICK TO THE BOTTOM **ONLY IF THE READER IS ALREADY THERE**.
 *
 * A watcher that always scrolls is the single most irritating thing a chat screen
 * can do: a reader twenty messages up is yanked to the bottom every time anybody
 * speaks. So the position is sampled **before** this component re-renders — the
 * default `flush: "pre"` is what puts this callback ahead of the patch — and the
 * jump happens only when that position was the newest thing on screen.
 *
 * ⚠️ AND IT IS ALSO THE `reachEnd` TRIGGER, in the same breath: the reader WAS at
 * the end a moment before the new row was drawn, so this is exactly the live-row
 * case the read receipt is scoped to — and a reader twenty messages up never
 * reaches it.
 */
watch(
  () => props.messages.length,
  (length, previous) => {
    if (restoring) return;
    if (previous !== undefined && length <= previous) return;
    if (!atBottom()) return;

    emit("reachEnd");

    void nextTick(toBottom);
  },
);

/**
 * ⚠️ THE **OTHER** `reachEnd` TRIGGER, AND IT FIRES ON THE EDGE ONLY.
 *
 * The reader scrolling back down to the newest message is the one moment no
 * watcher on `messages.length` can see, and it is the one the API doc's recipe
 * means by «while scrolling, send the latest visible sequence».
 *
 * ⚠️ **A FLAG, NOT A FLAGLESS SCROLL LISTENER.** A listener that emitted on every
 * frame would post a receipt from the middle of a long thread, marking messages
 * the reader has not reached as read — the badge clearing for messages nobody
 * looked at. `atEnd` is the previous answer, so the emit happens on the
 * false→true edge and nowhere else.
 *
 * ⚠️ IT STARTS `true`, because an empty scroller IS at its end: a reader who never
 * scrolls has not arrived anywhere, and their first page landing is already
 * covered by the stick-to-bottom watcher above.
 */
let atEnd = true;

function onReachEndScroll(): void {
  const reached = atBottom();

  if (reached === atEnd) return;

  atEnd = reached;
  if (!reached) return;

  emit("reachEnd");
}

useEventListener(log, "scroll", onReachEndScroll, { passive: true });

/* -------------------------------------------------------------- long press -- */

/** The row a pointer is currently resting on, if any. */
const pressed = ref<{
  message: ICafeThreadMessage;
  trigger: HTMLElement;
  x: number;
  y: number;
} | null>(null);

/** When the last long press fired, so the click it causes can be swallowed. */
let lastPressAt = 0;

/**
 * `useTimeoutFn` rather than a bare `setTimeout`, because it disposes with the
 * component's scope: a long-press timer that outlived its screen would open a menu
 * over a page the reader has already left.
 */
const { start: armPress, stop: disarmPress } = useTimeoutFn(
  () => {
    const held = pressed.value;
    if (held === null) return;

    pressed.value = null;

    // ⚠️ STAMPED **BEFORE** THE MENU OPENS, because opening it re-renders this
    // tree and the lift-off that follows is a click this gesture caused.
    lastPressAt = Date.now();

    emit("menu", { message: held.message, trigger: held.trigger });
  },
  LONG_PRESS_MS,
  { immediate: false },
);

/**
 * ⚠️ A ROW THAT IS STILL IN FLIGHT OR THAT FAILED HAS **NO MENU**, and this is the
 * one predicate the whole feature answers it with.
 *
 * An optimistic row's id is `local:<n>` (`LOCAL_ID_PREFIX` in `app/stores/cafe.ts`),
 * and `:` is outside the charset `isResourceId` allowlists, so **every** proxy this
 * menu's intents travel through refuses the id at its own boundary before a request
 * exists: «ویرایش» (own + `status: "active"`, which the optimistic row sets), «حذف»
 * (own) and «پسندیدن» all come back `ERR_NET_CONNECTION`/500 for an id that never
 * had a chance to be sent. The reader is told «اتصال اینترنت را بررسی کنید» about a
 * purely client-side string, the row stays (the store's own rule), nothing can clear
 * `failed`, and because the draft is deliberately kept a resend puts a **second**
 * identical bubble beside the permanent red one. Offering a command that cannot
 * succeed is worse than offering none, so every door below goes quiet for these two
 * states and the bubble's own meta row — which already prints «در حال ارسال» and
 * «ارسال نشد» — carries what is true.
 *
 * ⚠️ ONLY PROPS, AND NOTHING FROM THE STORE: `sending` and `failed` are fields the
 * row already carries (`ICafeThreadMessage`'s client-only half), so this needed no
 * store support. It is a **menu** rule and not a rendering rule: the row is still
 * drawn, still focusable and still readable — only its commands are withheld.
 */
function canOpenMenu(message: ICafeThreadMessage): boolean {
  return message.sending !== true && message.failed !== true;
}

/**
 * The row a gesture landed on, found through the one attribute every row carries.
 *
 * ⚠️ **IT MUST BE ASKED `event.currentTarget`, NEVER `event.target`.** Every one of
 * these three handlers is bound ON the row, so `currentTarget` is the row itself —
 * the element carrying `data-message-id`. `target` is whatever the tap actually
 * landed inside, and a tap on a bubble's text, its timestamp or its heart is a
 * DESCENDANT with no such attribute, so the lookup answered `undefined` and the
 * menu never opened. The bubble is a picture of a message and holds nothing that
 * could carry the id, which is precisely why the wrapper owns it.
 *
 * `null` for a row whose message has already left the list — a press that started
 * on a row the reader then scrolled away from — and `null` for a row `canOpenMenu`
 * refuses. Every caller treats `null` as «nothing to open», which is the only safe
 * reading, so one guard here closes all three doors: the long press, the native
 * `contextmenu` and the keyboard.
 */
function messageAt(target: EventTarget | null): {
  message: ICafeThreadMessage;
  trigger: HTMLElement;
} | null {
  if (!(target instanceof HTMLElement)) return null;

  const id = target.dataset.messageId ?? "";

  const message = props.messages.find((row) => row.id === id);
  if (message === undefined) return null;
  if (!canOpenMenu(message)) return null;

  return { message, trigger: target };
}

function onPointerDown(event: PointerEvent): void {
  // ⚠️ A SECOND FINGER IS A GESTURE, NOT A PRESS. Two pointers down is a pinch or
  // a two-finger scroll, and opening a menu in the middle of one is the worst
  // possible timing for a sheet.
  if (pressed.value !== null) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  // ⚠️ `currentTarget`, not `target` — see the note on `messageAt`.
  const hit = messageAt(event.currentTarget);
  if (hit === null) return;

  pressed.value = { ...hit, x: event.clientX, y: event.clientY };

  armPress();
}

function onPointerMove(event: PointerEvent): void {
  const held = pressed.value;
  if (held === null) return;

  const moved =
    Math.abs(event.clientX - held.x) > LONG_PRESS_SLOP_PX ||
    Math.abs(event.clientY - held.y) > LONG_PRESS_SLOP_PX;

  if (!moved) return;

  disarmPress();
  pressed.value = null;
}

function onPointerUp(): void {
  disarmPress();
  pressed.value = null;
}

/**
 * ⚠️ THE WINDOW LISTENERS EXIST ONLY WHILE A PRESS IS LIVE, and they are guarded
 * by `import.meta.client` because `window` does not exist during a server render.
 *
 * `pointerup` is on `window` rather than on the row because a finger that slides
 * off the bubble and lifts outside it would otherwise leave the timer armed and
 * open the menu 500ms after the reader let go. `useEventListener` disposes them
 * with the scope, so there is no `onMounted` / `onBeforeUnmount` pair to keep in
 * step and no window listener surviving a navigation mid-press.
 */
if (import.meta.client) {
  useEventListener(window, "pointermove", onPointerMove, { passive: true });
  useEventListener(window, "pointerup", onPointerUp, { passive: true });
  useEventListener(window, "pointercancel", onPointerUp, { passive: true });
}

/* ------------------------------------------------------------- the three doors -- */

/** The native menu, on a mouse and on a trackpad. Suppressed either way. */
function onContextMenu(event: MouseEvent): void {
  event.preventDefault();

  // ⚠️ `currentTarget`, not `target` — see the note on `messageAt`.
  const hit = messageAt(event.currentTarget);
  if (hit === null) return;

  disarmPress();
  pressed.value = null;

  emit("menu", hit);
}

/**
 * `Enter` / `Space` on a FOCUSED ROW — the keyboard door, and the reason the row
 * is `tabindex="0"`.
 *
 * ⚠️ THE `event.target !== event.currentTarget` GUARD IS THE WHOLE POINT: the row
 * contains the bubble's inline editor (`<textarea>`) and its own buttons, and a
 * keystroke aimed at either of those — Enter to save an edit, Space to press a
 * button — must never be stolen into opening a menu over it.
 */
function onRowKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();

  // ⚠️ `currentTarget`, not `target` — see the note on `messageAt`.
  const hit = messageAt(event.currentTarget);
  if (hit === null) return;

  emit("menu", hit);
}

/**
 * ⚠️ A `click` immediately after a long press is NOT a second intent — the finger
 * comes up on top of the sheet, and without this it picks a row nobody aimed at.
 * See `CLICK_SWALLOW_MS` for why this is a window and not a flag.
 */
function onRowClick(event: MouseEvent): void {
  // ⚠️ `Date.now()` IS LEGAL IN AN EVENT HANDLER — the same rule the thread
  // screen's clock ref follows.
  if (Date.now() - lastPressAt > CLICK_SWALLOW_MS) return;

  lastPressAt = 0;

  event.preventDefault();
  event.stopPropagation();
}

/**
 * What a screen reader is told when it lands on a row.
 *
 * ⚠️ AND ON A ROW WITH NO MENU IT NAMES THE STATE INSTEAD OF THE MENU. The row is
 * still focusable — it holds a real message the reader may be navigating past — but
 * `aria-haspopup` is gone and Enter does nothing, so promising «باز کردن گزینه‌های
 * پیام» would be an announced control that cannot be operated, and the bubble's
 * visual chip is not something a screen reader reads as this element's name.
 */
function describe(row: ResolvedRow): string {
  const who = row.own ? "پیام شما" : row.senderName || "پیام";

  if (!canOpenMenu(row.message)) {
    return `${who} — ${row.message.failed === true ? "ارسال نشد" : "در حال ارسال"}`;
  }

  return `${who} — باز کردن گزینه‌های پیام`;
}
</script>

<template>
  <!--
    The scroller itself. `overscroll-contain` stops a swipe that reaches the end
    of the transcript from chaining to a parent, which on a touch phone reads as
    the whole page lurching.

    `pb-2` is inside the scroller rather than on it, so the last bubble keeps a
    little air above the composer instead of resting flush against it. `pt-4`
    does the same at the top under the header hairline.

    No `pb-24`-style clearance for the bottom pill lives here: this list only ever
    sits above the **composer** (`CafeComposerShell`), which is in the layout's
    flow and not floating, and the only cafe screen that draws a floating pill is
    a list screen, not a thread.
  -->
  <div
    ref="log"
    role="log"
    aria-label="پیام‌های گفتگو"
    class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain bg-x-primary-content-200 px-3 pt-4 pb-2"
  >
    <!--
      ⚠️ THE «پیام‌های قدیمی‌تر» CONTROL SITS **ABOVE** THE TRANSCRIPT, not inside
      the empty state.

      A reader whose window starts at the top has nothing to read and somewhere to
      go, and «این گفتگو پیامی ندارد» beside a «load more history» button is a
      sentence about the wrong thing. When the held window really is empty there
      is nothing older to load either — the server says `hasMore: false` — so the
      two can never contradict each other.
    -->
    <div v-if="canLoadOlder" class="flex shrink-0 justify-center py-1">
      <button
        type="button"
        class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-x-primary-content-50 px-4 text-xs font-bold text-x-text-title transition-colors hover:bg-x-primary-content-100 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="loadingOlder"
        @click="loadOlder"
      >
        <UIcon
          :name="loadingOlder ? 'solar:restart-linear' : 'solar:arrow-up-linear'"
          size="16"
          :class="loadingOlder ? 'motion-safe:animate-spin' : ''"
          aria-hidden="true"
        />
        {{ loadingOlder ? "در حال دریافت" : "پیام‌های قدیمی‌تر" }}
      </button>
    </div>

    <CafeStateBlock
      v-if="messages.length === 0"
      state="empty"
      title="هنوز پیامی در این گفتگو نیست"
      description="اولین پیام را شما بفرستید تا گفتگو از اینجا شروع شود"
    />

    <template v-for="row in rows" :key="row.key">
      <CafeMessageTimestamp
        v-if="row.kind === 'chip'"
        variant="chip"
        :value="row.value"
        :now="now"
        class="my-2"
      />

      <!--
        The unread divider, drawn ONCE — before the first row whose `sequence` is
        at or after `newMessagesFrom(tableId)`. `role="separator"` is what tells an
        assistive technology this is a boundary between two sets of messages rather
        than another message.
      -->
      <div
        v-else-if="row.kind === 'divider'"
        role="separator"
        aria-label="پیام‌های تازه"
        class="my-2 flex items-center gap-2"
      >
        <span class="h-px flex-1 bg-x-primary-content-300" aria-hidden="true" />

        <span class="rounded-full bg-x-primary-100 px-3 py-1 text-xs font-bold text-x-primary-800">
          پیام‌های تازه
        </span>

        <span class="h-px flex-1 bg-x-primary-content-300" aria-hidden="true" />
      </div>

      <!--
        ⚠️ THE ROW WRAPPER OWNS THE GESTURES, AND IT IS A FOCUSABLE `group` RATHER
        THAN A BUTTON.

        The wrapper carries the message's `data-message-id` and all four handlers
        in ONE place, so `CafeMessageBubble` stays a picture of a message and knows
        nothing about pointers. Making it `role="button"` would be a lie — pressing
        the message does not activate it, it only opens a menu over it — and
        `tabindex="0"` + `role="group"` + `aria-haspopup` is the honest form: a
        keyboard reader can reach every message and open its menu, and nothing is
        announced as a button that behaves like one.

        `touch-pan-y` tells the browser this element may be SCROLLED but not
        pinched, so a long press never turns into a pinch and the vertical scroll
        is never delayed waiting to find out whether this is a press.

        ⚠️ `select-none` IS LOAD-BEARING HERE, and not as decoration: the global
        `user-select: none` rule in `main.css` covers `button`, `a` and
        `[role="button"]` — and this row is `role="group"`, so a finger resting on a
        bubble raised iOS's text-selection callout and the gesture ended in a
        `pointercancel` instead of in the menu.

        `@contextmenu.prevent` is the suppression of the OS menu — it has to be on
        an element, or the browser's own menu appears over the bubble and the
        reader gets two menus for one gesture.

        ⚠️ `aria-haspopup` IS BOUND, NOT STATIC, because it is a promise about what
        the row can do: `canOpenMenu` withholds it on a row that is in flight or
        refused, and `describe` names that state instead. Announcing a menu the
        three doors will not open is a lie no visual chip can correct.
      -->
      <div
        v-else
        role="group"
        tabindex="0"
        :data-message-id="row.message.id"
        :aria-label="describe(row)"
        :aria-haspopup="canOpenMenu(row.message) ? 'menu' : undefined"
        class="touch-pan-y rounded-2xl select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500"
        @pointerdown="onPointerDown"
        @click="onRowClick"
        @keydown="onRowKeydown"
        @contextmenu="onContextMenu"
      >
        <CafeMessageBubble
          :message="row.message"
          :own="row.own"
          :show-avatar="row.showAvatar"
          :grouped="row.grouped"
          :sender-name="row.senderName"
          :sender-image="row.senderImage"
          :replied-name="row.repliedName"
          :now="now"
          :liked="row.liked"
          :like-count="row.likeCount"
          :read="row.read"
          :editing="row.editing"
          :saving-edit="row.savingEdit"
          :edit-error="row.editError"
          @edit="emit('edit', { message: row.message, text: $event })"
          @cancel-edit="emit('cancelEdit')"
          @like="emit('like', row.message)"
        />
      </div>
    </template>
  </div>
</template>
