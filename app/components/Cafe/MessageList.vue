<script setup lang="ts">
import type { ICafeTableMessage, ITableUserView } from "~/types/cafe";

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
 * so a reader arriving at the conversation is told where they are. The new
 * message itself is the socket's job to surface, in Phase 2.
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
    messages: ICafeTableMessage[];
    /** `senderId` → sender. Optional: a thread of two does not need a roster. */
    members?: Record<string, ITableUserView>;
    /** The reader's own `userId`. Decides which side every message is on. */
    myId?: string;
    /** Epoch ms of "now", forwarded to the timestamps. Omit for absolute labels. */
    now?: number;
  }>(),
  { members: () => ({}) },
);

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
  previous: ICafeTableMessage,
  message: ICafeTableMessage,
): boolean {
  const from = toTime(previous.createdAt);
  const to = toTime(message.createdAt);
  if (from === null || to === null) return false;

  return Math.abs(to - from) <= GROUP_WINDOW_MS;
}

/**
 * One row of the scroller: either a day chip or a bubble.
 *
 * A flat discriminated union rather than "the bubbles, plus the chips spliced
 * in during render" because the chip has to sit *between* two messages in DOM
 * order — a `v-if` on the message and a separate loop for the chips can produce
 * that, but it needs the two lists index-matched by hand, and the first list's
 * indices stop matching the moment one message is filtered out.
 */
type ThreadRow =
  | { kind: "chip"; key: string; value: string }
  | {
      kind: "message";
      key: string;
      message: ICafeTableMessage;
      own: boolean;
      showAvatar: boolean;
      grouped: boolean;
      senderName: string;
      senderImage: string;
      repliedName: string;
    };

/** A message resolved against the list around it. */
interface ResolvedMessage {
  key: string;
  message: ICafeTableMessage;
  own: boolean;
  showAvatar: boolean;
  grouped: boolean;
  senderName: string;
  senderImage: string;
  repliedName: string;
}

const rows = computed<ThreadRow[]>(() => {
  const list = props.messages;

  const resolved: ResolvedMessage[] = list.map((message, index) => {
    const previous = index > 0 ? list[index - 1] : undefined;

    const own = message.senderId === props.myId;
    const sender = props.members[message.senderId];

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
     */
    const grouped =
      previous !== undefined &&
      previous.senderId === message.senderId &&
      dayIndex(message.createdAt) === dayIndex(previous.createdAt) &&
      withinRun(previous, message);

    return {
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
    };
  });

  const withChips: ThreadRow[] = [];

  resolved.forEach((row, index) => {
    const day = dayIndex(row.message.createdAt);
    const previousDay = index > 0 ? dayIndex(resolved[index - 1]!.message.createdAt) : null;

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

    withChips.push({ kind: "message", ...row });
  });

  return withChips;
});
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
    role="log"
    aria-label="پیام‌های گفتگو"
    class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain bg-x-primary-content-200 px-3 pt-4 pb-2"
  >
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

      <CafeMessageBubble
        v-else
        :message="row.message"
        :own="row.own"
        :show-avatar="row.showAvatar"
        :grouped="row.grouped"
        :sender-name="row.senderName"
        :sender-image="row.senderImage"
        :replied-name="row.repliedName"
        :now="now"
      />
    </template>
  </div>
</template>