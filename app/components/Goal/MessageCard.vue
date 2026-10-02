<script setup lang="ts">
import type { GoalMessage, GoalReviewState } from "~/types/goal";
import { faDate, faNumber, faRelative } from "~/utils/fa";

/**
 * One week of the ladder, as a row in the timeline.
 *
 * `now` is a PROP, and that is the point of it: a relative time cannot be
 * produced during SSR without risking a hydration mismatch, so the clock is read
 * once by the page (`onMounted`, the `pages/settings.vue` pattern) and handed
 * down. `undefined` until mount, which is what makes the server render and the
 * client's first paint agree on a `faDate`.
 */
const props = defineProps<{
  message: GoalMessage;
  state: GoalReviewState;
  /**
   * 1-based position in the ladder, OLDEST first — `Timeline` passes the index off
   * `timelineMessages`, which is the reversed (oldest-first) view.
   *
   * ⚠️ **COUNTED FROM THE OLDEST WEEK, NOT THE NEWEST, AND THAT IS THE POINT.**
   * The server sorts `createdAt: -1`, so the newest week is `messages[0]` — and
   * numbering from there would give the week being worked on «۱» while it is the
   * reader's tenth, which is the number «هفتهٔ دهم» means to them. Counting from
   * the oldest makes the badge agree with the calendar: the first week they wrote
   * is week ۱, and the one open now is the highest number.
   *
   * It is a position, not an identity — the API has no week number — so it
   * renumbers when a week is added. Adding a week appends at the END of the ladder
   * in oldest-first order, so no existing row's number moves.
   */
  index: number;
  /**
   * Whether this is the newest week, i.e. the one `state` describes.
   *
   * Passed by `Timeline` rather than derived here, because "newest" is a fact about
   * the LADDER (`index === messages.length - 1`), not about this message alone —
   * and a card that worked it out itself would need the whole list to do it.
   */
  isNewest?: boolean;
  now?: number;
}>();

/** «۱» … «۱۲» — see the note on `index`. */
const ordinal = computed<string>(() => faNumber(props.index + 1));

/**
 * When this week's window closes. `faDate` of an epoch figure, so the reader sees
 * the same date the server stored.
 */
const expiresAt = computed<string>(() =>
  props.message.input.expiredAt ? faDate(props.message.input.expiredAt) : "",
);

/** One badge per ladder case, so a reader can see at a glance which week this is. */
const badge = computed<{ label: string; class: string }>(() => {
  switch (props.state) {
    case "active":
      return {
        label: "هفتهٔ جاری",
        class: "bg-x-primary-100 text-x-primary-900",
      };
    case "review-due":
      return {
        label: "منتظر گزارش شما",
        class: "bg-red-50 text-red-600",
      };
    case "reviewed":
      return {
        label: "گزارش ثبت شد",
        class: "bg-x-secondary-100 text-x-secondary-900",
      };
    case "completed":
      return {
        label: "بسته‌شده",
        class: "bg-x-primary-content-100 text-x-text-subtitle",
      };
    default:
      return {
        label: "شروع‌نشده",
        class: "bg-x-primary-content-100 text-x-text-subtitle",
      };
  }
});
</script>

<template>
  <NuxtLink
    :to="`/panels/big/goal/message/${message.id}`"
    class="block rounded-3xl bg-white p-4 shadow-xs ring-1 transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
    :class="
      state === 'review-due'
        ? 'ring-red-200'
        : isNewest
          ? 'ring-x-primary-200'
          : 'ring-x-primary-100'
    "
  >
    <div class="flex items-center gap-3">
      <!--
        The disc is the week's own marker, and it says which week this is even
        before the words are read: the newest week carries the accent disc, older
        ones are quiet. Decoration only — the badge beside it says the same thing
        in words, which is what a screen reader needs.

        The ordinal is NOT decoration: it is the one thing that tells a reader
        looking at four identical «راهنمای هفتگی» rows which is the latest, and
        `aria-hidden` because it is already in the link's own name below.
      -->
      <span
        class="relative grid size-10 shrink-0 place-items-center rounded-2xl"
        :class="
          isNewest
            ? 'bg-x-primary-100 text-x-primary-800'
            : 'bg-x-primary-content-100 text-x-text-subtitle'
        "
        aria-hidden="true"
      >
        <UIcon name="solar:chat-round-linear" size="20" />

        <!--
          The week number, bottom-start of the disc. Persian digits, `tabular-nums`
          so «۱۰» does not sit wider than «۹», and no box of its own — it sits on
          the disc, which already gives it the contrast it needs.
        -->
        <span
          class="absolute -bottom-1 -start-1 grid size-5 place-items-center rounded-full bg-x-primary-600 text-[10px] font-bold text-white tabular-nums ring-2 ring-white"
        >
          {{ ordinal }}
        </span>
      </span>

      <div class="min-w-0 flex-1">
        <strong class="block truncate text-sm text-x-text-title">
          {{ isNewest ? "راهنمای این هفته" : "راهنمای هفتگی" }}
        </strong>
        <span class="mt-0.5 block text-xs text-x-text-subtitle">
          {{ faRelative(message.createdAt, now) }}
        </span>
      </div>

      <span
        class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
        :class="badge.class"
      >
        {{ badge.label }}
      </span>
    </div>

    <p v-if="expiresAt" class="mt-2 flex items-center gap-1.5 text-xs text-x-text-muted">
      <UIcon name="solar:calendar-linear" size="14" aria-hidden="true" />
      پایان این هفته: {{ expiresAt }}
    </p>
  </NuxtLink>
</template>