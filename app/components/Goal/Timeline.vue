<script setup lang="ts">
import type { GoalMessage, GoalReviewState } from "~/types/goal";
import { faDate, faNumber } from "~/utils/fa";

/**
 * The weekly ladder of one goal: every week so far, oldest first, and the ONE
 * thing the reader is asked to do about the current week.
 *
 * ⚠️ **FIVE STATES, NOT ONE.** `state` is `goalReviewState` of the newest
 * message — the single place the backend's four ladder signals are interpreted —
 * and each case is rendered differently, because they mean genuinely different
 * things: nothing to do yet, a week in progress, a report owed, a report already
 * written, or a week closed. Collapsing them would invite a reader to write a
 * review for a week the server has already closed.
 *
 * `messages` arrives OLDEST-FIRST (`timelineMessages` reverses it) so it reads
 * downward like a timeline; `state` still describes the newest message, which is
 * the last one in this array.
 *
 * `now` is a prop so it stays `undefined` until the page has mounted — the
 * `pages/settings.vue` pattern. Every figure below that needs the clock is
 * therefore `null` during SSR and the client's first paint, and the template
 * renders a deterministic `faDate` in its place rather than a relative string
 * that could disagree between the two renders.
 */
const props = defineProps<{
  goalId: string;
  messages: GoalMessage[];
  state: GoalReviewState;
  loading?: boolean;
  /**
   * `POST /goal/{id}/start` is in flight — `loading.messages` is NOT this.
   *
   * A prop rather than a guard inside this component, for the same reason
   * `stores/astrology.ts` holds its activation behind `inFlight`: the request
   * must be unrepresentable in the UI, not merely unlikely. The page passes
   * `state.loading.start`, which nothing else read, so a double tap — or a
   * keyboard repeat on a focused button — used to put two `start` calls on the
   * wire from one press.
   */
  starting?: boolean;
  submitting?: boolean;
  error?: string | null;
  now?: number;
}>();

const emit = defineEmits<{
  "submit-review": [review: string];
  start: [goalId: string];
}>();

/** `startAndReviewGoalSchema` upstream: `review` is `min(20)` and required. */
const REVIEW_MIN = 20;

const review = ref("");
const reviewLength = computed<number>(() => review.value.trim().length);
const canSubmitReview = computed<boolean>(
  () => reviewLength.value >= REVIEW_MIN && !props.submitting,
);

/** The newest message — the one `state` describes. `[]` when nothing started. */
const current = computed<GoalMessage | null>(
  () => props.messages[props.messages.length - 1] ?? null,
);

/**
 * Days left in this week's window, or `null` before the clock exists.
 *
 * `null` is NOT "zero days left": without a `now` there is no remaining time to
 * state, and rendering «۰ روز» there would tell a reader their week is over on
 * the server-rendered first frame. `Math.ceil`, because a window with 30 hours
 * left is one whole day remaining, not zero — the same reasoning as the plan's
 * `remainingDays`, floored there for the opposite reason (that figure gates a
 * redirect, and this one does not).
 */
const remainingDays = computed<number | null>(() => {
  const expiresAt = current.value?.input.expiredAt;

  if (!expiresAt || props.now === undefined) return null;

  const left = expiresAt - props.now;

  return Math.max(0, Math.ceil(left / 86_400_000));
});

/** «۳ روز دیگر» — the remaining time as a sentence, or `null` before mount. */
const remainingText = computed<string | null>(() =>
  remainingDays.value === null
    ? null
    : `${faNumber(remainingDays.value)} روز دیگر تا پایان این هفته`,
);

/**
 * The reader's own weekly report, read-only. Written as plain text and never as
 * HTML: it is the reader's input, so there is nothing here that should be
 * interpreted, and `marked` output would be an injection surface on their own
 * words. `.ai-markdown` supplies the typography without the parsing.
 */
const submittedReview = computed<string>(() => {
  const input = current.value?.input;

  return input && "review" in input ? input.review.trim() : "";
});

function submitReview() {
  if (!canSubmitReview.value) return;

  emit("submit-review", review.value.trim());
}

/** Clear the composer only once the server has accepted it. */
watch(
  () => props.state,
  (next) => {
    if (next !== "review-due") review.value = "";
  },
);
</script>

<template>
  <div>
    <!--
      The history. Oldest first, so the newest week sits at the bottom of the list
      and directly above whatever the composer is asking for — which is also why
      `index` is the week number the reader would say out loud.

      The stagger runs TOP-DOWN over an OLDEST-FIRST list, so the oldest week
      arrives first and the week being acted on arrives last. That is the opposite
      of the goal list (newest first, and staggered the same way), and it is
      deliberate in both: motion should follow the reading order, not the array
      order. `Math.min(index, 5)` caps the delay so a twenty-week ladder does not
      make its last row wait two seconds.

      `:key` is the message uniqid, not the index, so a new week is appended
      without re-creating the nineteen rows above it — otherwise every existing
      row would re-run its entrance and the ladder would visibly rebuild itself
      each time the reader finished a week.
    -->
    <ul v-if="messages.length > 0" class="space-y-3">
      <li
        v-for="(message, index) in messages"
        :key="message.id"
        class="reveal"
        :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
      >
        <GoalMessageCard
          :message="message"
          :state="index === messages.length - 1 ? state : 'completed'"
          :index="index"
          :is-newest="index === messages.length - 1"
          :now="now"
        />
      </li>
    </ul>

    <!--
      The block is PINNED to the bottom of the panel layout's scroller, which is
      exactly what `layouts/panel.vue` splits the scroll for: the transcript
      scrolls behind it while the one thing being asked stays reachable. It takes
      that space only while something is asked, so the states that ask nothing
      leave the whole bottom edge to the reader's transcript — and so does the
      loading state, whose bar would otherwise be a solid strip of panel colour
      covering the bottom of the screen while saying nothing at all.
    -->
    <div
      v-if="!loading"
      class="sticky bottom-0 z-10 mt-4 bg-x-primary-content-100 pt-3 pb-2"
    >
      <!-- NOT STARTED -->
      <div
        v-if="state === 'not-started'"
        class="rounded-3xl bg-white p-4 shadow-xs ring-1 ring-x-primary-100"
      >
        <div class="flex items-start gap-3">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:play-circle-linear" size="24" />
          </span>
          <div class="min-w-0 flex-1">
            <strong class="block text-sm text-x-text-title">
              هدف را شروع کنید
            </strong>
            <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
              با شروع هدف، اولین راهنمای هفتگی ساخته می‌شود و از همان هفته
              پیگیری شروع می‌شود.
            </p>
          </div>
        </div>

        <UButton
          label="شروع هدف"
          icon="solar:play-linear"
          variant="solid"
          color="x-primary"
          block
          class="mt-3"
          :loading="starting"
          :disabled="starting"
          :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
          @click="emit('start', goalId)"
        />
      </div>

      <!-- ACTIVE: nothing is asked of the reader this week. -->
      <div
        v-else-if="state === 'active'"
        class="rounded-3xl bg-x-primary-50 p-4"
      >
        <p class="text-sm leading-7 text-x-text-body">
          این هفته را روی هدف خود تمرکز کنید؛ در پایان هفته از شما گزارش آن هفته
          پرسیده می‌شود.
        </p>
        <p
          v-if="remainingText"
          class="mt-1 flex items-center gap-1.5 text-xs text-x-primary-800"
        >
          <UIcon name="solar:clock-circle-linear" size="14" aria-hidden="true" />
          {{ remainingText }}
        </p>
        <!--
          The deterministic alternative to the relative countdown above: the
          server's own closing date, which both renders can agree on.
        -->
        <p
          v-else-if="current?.input.expiredAt"
          class="mt-1 flex items-center gap-1.5 text-xs text-x-primary-800"
        >
          <UIcon name="solar:calendar-linear" size="14" aria-hidden="true" />
          پایان این هفته: {{ faDate(current.input.expiredAt) }}
        </p>
      </div>

      <!-- REVIEW DUE: the one pinned composer of the ladder. -->
      <form
        v-else-if="state === 'review-due'"
        class="rounded-3xl bg-white p-4 shadow-xs ring-1 ring-red-200"
        @submit.prevent="submitReview"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="solar:clipboard-text-linear"
            size="18"
            class="text-red-500"
            aria-hidden="true"
          />
          <strong class="text-sm text-x-text-title">گزارش هفتگی شما</strong>
        </div>

        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          در این هفته چه کردید، چه چیزی سخت بود و هفتهٔ بعد چه می‌کنید؟
        </p>

        <UTextarea
          v-model="review"
          :rows="4"
          autoresize
          :maxlength="1200"
          color="x-primary"
          variant="soft"
          placeholder="مثلاً: سه جلسه تمرین کردم، اما دو شب به خاطر خستگی عقب افتادم."
          :ui="{ base: 'mt-3 rounded-2xl bg-white text-sm leading-7' }"
          class="w-full"
        />

        <div class="mt-2 flex items-center gap-2">
          <!--
            The counter is NOT a live region, on purpose. Every character typed
            would re-announce two numbers at a reader who is mid-sentence, and the
            minimum they need is already IN this element as `n / ۲۰` — so it is
            readable whenever they look for it rather than shouted at them as they
            type. `text-red-600` on white, not `text-red-500`: at `text-xs` the
            lighter red is ≈3.9:1 and fails AA, and the error line below this row
            already uses `text-red-600` on `bg-red-50`. Red appears only below
            the bound — a red «۴۰/۲۰» while somebody is still writing a sentence
            would be noise.
          -->
          <span
            class="text-xs tabular-nums"
            :class="
              reviewLength >= REVIEW_MIN
                ? 'text-x-text-muted'
                : 'text-red-600'
            "
          >
            {{ faNumber(reviewLength) }} / {{ faNumber(REVIEW_MIN) }}
          </span>

          <UButton
            type="submit"
            label="ثبت گزارش"
            :loading="submitting"
            :disabled="!canSubmitReview"
            variant="solid"
            color="x-primary"
            class="ms-auto"
            :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
          />
        </div>
      </form>

      <!-- REVIEWED: what they wrote, read-only. -->
      <div
        v-else-if="state === 'reviewed'"
        class="rounded-3xl bg-white p-4 shadow-xs ring-1 ring-x-secondary-200"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="solar:check-circle-linear"
            size="18"
            class="text-x-secondary-600"
            aria-hidden="true"
          />
          <strong class="text-sm text-x-text-title">گزارش این هفته ثبت شد</strong>
        </div>

        <p
          v-if="submittedReview"
          class="ai-markdown mt-2 rounded-2xl bg-x-secondary-50 px-3 py-2 text-sm"
        >
          {{ submittedReview }}
        </p>

        <p class="mt-2 text-xs leading-6 text-x-text-subtitle">
          راهنمای هفتهٔ بعد به‌زودی آماده می‌شود.
        </p>
      </div>

      <!-- COMPLETED: terminal, whatever `input` says. -->
      <div
        v-else-if="state === 'completed'"
        class="rounded-3xl bg-x-primary-content-100 p-4"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="solar:archive-minimalistic-linear"
            size="18"
            class="text-x-text-subtitle"
            aria-hidden="true"
          />
          <strong class="text-sm text-x-text-title">این هفته بسته شد</strong>
        </div>
        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          گزارش این هفته ثبت شده است و پیگیری آن با هفتهٔ بعد ادامه دارد.
        </p>
      </div>

      <!--
        The ladder's own refusal, placed under the composer rather than over it:
        `ERR_GOAL_NOT_COMPLETED` means the week has not elapsed yet and the reader
        can carry on writing, so a full-screen error would hide the thing they
        still have to do.
      -->
      <p
        v-if="error"
        role="alert"
        class="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs leading-6 text-red-600"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>