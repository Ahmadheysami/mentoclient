<script setup lang="ts">
import { GOAL_DOMAINS_META, type GoalDocument } from "~/types/goal";
import { faDate, faDuration, faNumber, faRelative } from "~/utils/fa";

/**
 * One goal in a category list, as a whole row: the goal, when it was written, and
 * the one thing asked of it.
 *
 * ⚠️ **The number is a LIST POSITION, not an identity.** `index` is the goal's
 * 0-based offset in the loaded list, which the server returns newest-first
 * (`createdAt: -1`), so «۱» is the most recent goal. It is the only ordinal this
 * API can honestly produce: there is no sequence field, no counter and no
 * `ordinal` on the document, and a fabricated one would be a number that renumbers
 * itself every time a goal is deleted or a further page is loaded. So it is drawn
 * as what it is — a position — and it renumbers accordingly.
 *
 * ⚠️ **AND IT DOES NOT RENUMBER WHEN A PAGE IS APPENDED — that is the property
 * that makes it usable.** `getGoals` appends each page to the one before it
 * (`[...state.goals[domain], ...mine]`), so the bucket is a growing prefix of one
 * `createdAt: -1` ordering and `index` IS the page offset plus the position within
 * the page. Loading «هدف‌های بیشتر» appends rows 21, 22, 23 and leaves 1…20 exactly
 * where they were, so the number the reader is looking at does not move under them
 * and no row swaps places. It is only re-based by a delete or a create, both of
 * which genuinely reorder the list, and both of which are visible acts.
 *
 * A per-page counter (`index % GOAL_PAGE_SIZE + 1`) is the alternative and it is
 * wrong: page 2 would restate 1…20 and the list would appear to repeat itself.
 *
 * **The delete control is a real `<button>`, outside the link.** The whole card is
 * the link (an absolutely positioned overlay under the content), and nesting a
 * button inside a link is invalid HTML no keyboard user can reach. The overlay is
 * the reason a card can be one visual object and still have a separately focusable
 * action, and it is why this component takes an `index` and emits `delete` itself
 * rather than having the page stack a second control under it.
 *
 * Everything on the card is the reader's OWN writing, so nothing here is a
 * judgement: the description is clamped to ONE line — four lines of it made every
 * row a different height and buried the two facts a list is for, which category
 * this is and when it was written — and the score is labelled for what it is, the
 * self-rating written at creation («نقطهٔ شروع»), never progress, because the
 * backend never recomputes it.
 */
const props = defineProps<{
  goal: GoalDocument;
  domain: GoalDocument["input"]["domain"];
  /** 0-based position in the loaded list, newest first. See the note above. */
  index: number;
  /**
   * The reader's clock, or `undefined` before mount.
   *
   * The card says BOTH «۳ روز پیش» and «۱۲ آبان ۱۴۰۴», and only the relative half
   * needs a clock — so it is a prop rather than a `Date.now()` call, for the reason
   * every other relative string in this feature is a prop: a relative time produced
   * during SSR and a different one produced at hydration is a text mismatch, and
   * the absolute date is the half both renders can agree on. The page reads the
   * clock once on mount (`goal/[id].vue`'s pattern).
   */
  now?: number;
}>();

const emit = defineEmits<{ delete: [] }>();

const meta = computed(() => GOAL_DOMAINS_META[props.domain]);

/** «۱» … «۲۰» */
const ordinal = computed<string>(() => faNumber(props.index + 1));

/** When the reader wrote it. `faDate` of the ISO string, Tehran-pinned. */
const createdAt = computed<string>(() => faDate(props.goal.createdAt));

/** «۳ روز پیش» once mounted, and the absolute date until then. */
const createdRelative = computed<string>(() =>
  props.now === undefined
    ? createdAt.value
    : faRelative(props.goal.createdAt, props.now),
);

/**
 * How much of the goal's own window is left, or `null` before the clock exists.
 *
 * ⚠ `goalExpiredAt` is fixed at **CREATION** (`now + targetTimeline * 86400000`),
 * not by `POST /goal/:id/start` — so an unstarted goal has a real window to count
 * down and «۰ روز» here would be a true statement about its own timeline, not a
 * reader being told their goal lapsed before anything was asked of them. `null` is
 * therefore `props.now === undefined`, before the page has mounted. `Math.ceil`
 * because a window with 30 hours left is one whole day remaining.
 */
const daysLeft = computed<number | null>(() => {
  const { goalExpiredAt } = props.goal.input;

  if (!goalExpiredAt || props.now === undefined) return null;

  return Math.max(
    0,
    Math.ceil((goalExpiredAt - props.now) / 86_400_000),
  );
});

/** «۳ روز مانده» — the countdown as a chip, or `null` to render nothing. */
const daysLeftText = computed<string | null>(() =>
  daysLeft.value === null
    ? null
    : `${faNumber(daysLeft.value)} روز مانده`,
);

/** Past the window the chip is a different sentence, not a red zero. */
const isOverdue = computed<boolean>(
  () => daysLeft.value !== null && daysLeft.value === 0,
);

/**
 * A short name for this goal, for the delete button's accessible name.
 *
 * An `aria-label` of «حذف هدف» alone is indistinguishable between twenty rows, and
 * a screen-reader user has no way to tell which one they are about to remove — so
 * the goal itself is named. Clipped to a readable length because the full text can
 * be 600 characters and a label is announced, not read at a glance. The category
 * name is the fallback, and cannot really occur: `createGoalSchema` validates
 * `description` as `min(20)`.
 */
const goalName = computed<string>(() => {
  const text = props.goal.input.description.replace(/\s+/g, " ").trim();

  if (text.length === 0) return meta.value.label;

  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
});

/** Named per goal, and only the target is named — a delete list, not a menu. */
const deleteLabel = computed<string>(() => `حذف هدف: ${goalName.value}`);

/**
 * The whole card is the goal, so the overlay link says so in words.
 *
 * **The SAME clipped text as the delete button above, deliberately.** The
 * visible description is a `line-clamp-1` line and can be ~600 characters, while a
 * label is ANNOUNCED rather than scanned — so a link named with the raw
 * description read the goal out at full length a second time, after the card's
 * own static text had already said it. `goalName` is the clipped form: the number
 * identifies the row, the name is what the reader would recognise, and the full
 * description remains readable as the card's own text (and on the goal's page).
 */
const linkLabel = computed<string>(() => `${ordinal.value}. ${goalName.value}`);
</script>

<template>
  <article
    class="relative rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100 transition-shadow duration-200 ease-out motion-reduce:transition-none"
  >
    <div class="flex items-start gap-3">
      <!--
        The position. `min-w-7` rather than a fixed `size-7` so «۱۰» … «۲۰» grow
        into a pill instead of overflowing a circle, and `aria-hidden` because a
        bare «۳» announced before the goal's own words is noise — the same figure
        is in the link's label, where it belongs.
      -->
      <span
        class="mt-px grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-x-primary-50 px-1.5 text-xs font-bold text-x-primary-700 tabular-nums"
        aria-hidden="true"
      >
        {{ ordinal }}
      </span>

      <div class="min-w-0 flex-1">
        <!--
          The goal, first and in the reader's own size: it is the reason the row
          exists, and everything under it is metadata about it.
        -->
        <p class="line-clamp-1 text-sm leading-6 text-x-text-body">
          {{ goal.input.description }}
        </p>

        <p
          class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-x-text-subtitle"
        >
          <span class="inline-flex min-w-0 items-center gap-1">
            <UIcon :name="meta.icon" size="14" aria-hidden="true" />
            <span class="truncate">{{ meta.label }}</span>
          </span>

          <span class="text-x-text-muted" aria-hidden="true">·</span>

          <span class="inline-flex items-center gap-1 tabular-nums">
            <UIcon name="solar:calendar-linear" size="14" aria-hidden="true" />
            {{ faDuration(goal.input.targetTimeline) }}
          </span>
        </p>
      </div>

      <!--
        `relative z-10` puts it ABOVE the overlay link below, so the corner of the
        card is not a dead zone under the delete target. `size-11` is 44px, the
        smallest comfortable touch target on a phone, and the icon is
        `aria-hidden` so the name spoken is the label, not «trash».
      -->
      <button
        type="button"
        class="relative z-10 grid size-11 shrink-0 place-items-center rounded-2xl text-x-text-muted transition-colors duration-150 ease-out hover:bg-red-50 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        :aria-label="deleteLabel"
        @click="emit('delete')"
      >
        <UIcon name="solar:trash-bin-trash-linear" size="18" aria-hidden="true" />
      </button>
    </div>

    <!--
      The three figures that belong to the row rather than to its text: the score
      the reader gave this goal, how much of its window is left, and when they wrote
      it. The meter is a `div` with an inline width rather than a `progress`
      element, because the reader has to see the FIGURE beside it — a bare bar says
      "some", and the whole point of asking for a 1..10 rating is that the reader
      chose a number.

      `flex-wrap` because «۱۲ آبان ۱۴۰۴» plus «نقطهٔ شروع: ۷ از ۱۰» plus a
      countdown is wider than a 360px phone, and a footer that clipped its own date
      would be worse than one that wraps. `ms-auto` on the date is what pins it to
      the far edge on the first line and lets it fall inline when it has to wrap.
    -->
    <div
      class="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-slate-100 pt-3"
    >
      <div class="flex items-center gap-2">
        <div
          class="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-x-primary-50"
          aria-hidden="true"
        >
          <div
            class="h-full rounded-full bg-x-primary-500"
            :style="{ width: `${(goal.input.currentScore / 10) * 100}%` }"
          />
        </div>

        <span class="text-xs text-x-text-subtitle tabular-nums">
          نقطهٔ شروع: {{ faNumber(goal.input.currentScore) }} از ۱۰
        </span>
      </div>

      <!--
        The remaining window, and the ONE thing on this card that can change on its
        own: `goalExpiredAt` is fixed by the server, so this is the only figure here
        that a reader watching the list will see move. It sits beside the creation
        date rather than in the metadata row because it is a state, not a fact about
        the goal — «۳ روز مانده» is the answer to "is anything expected of me yet?".

        Past the window it reads «بازه تمام شده» in neutral ink rather than a red
        «۰ روز مانده»: a lapsed window is the ordinary end of a plan the reader set
        themselves, and a red zero would read as a failure of theirs. It is not a
        link and not a button — this card does not offer to extend anything.
      -->
      <span
        v-if="daysLeftText"
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
        :class="
          isOverdue
            ? 'bg-x-primary-content-100 text-x-text-subtitle'
            : 'bg-x-secondary-100 text-x-secondary-900'
        "
      >
        <UIcon
          :name="isOverdue ? 'solar:clock-circle-linear' : 'solar:hourglass-linear'"
          size="12"
          aria-hidden="true"
        />
        {{ isOverdue ? "بازه تمام شده" : daysLeftText }}
      </span>

      <span
        v-if="createdAt"
        class="ms-auto inline-flex items-center gap-1 text-xs text-x-text-muted"
      >
        <UIcon name="solar:calendar-date-linear" size="14" aria-hidden="true" />

        <!--
          The relative half on top, the absolute one in the `title`: a screen reader
          gets both, and a sighted reader gets the absolute date from the tooltip
          without the row growing a second line for it.
        -->
        <span :title="createdAt">{{ createdRelative }}</span>
      </span>
    </div>

    <!--
      The overlay. It sits on top of the content (positioned, `z-0`, over static
      text) so the whole row is tappable, and its focus ring traces the card
      because it carries the card's own radius. The content above it is `aria`-wise
      static text plus this one link, which is the standard card-link arrangement:
      a screen reader reads the row's words, then announces one link named after the
      goal. Nothing here is focusable except the link and the delete button.
    -->
    <NuxtLink
      :to="`/panels/big/goal/${goal.id}`"
      class="absolute inset-0 z-0 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700"
    >
      <span class="sr-only">{{ linkLabel }}</span>
    </NuxtLink>
  </article>
</template>
