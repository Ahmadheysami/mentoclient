<script setup lang="ts">
import { GOAL_DOMAINS_META } from "~/types/goal";
import { faDate, faDuration, faNumber } from "~/utils/fa";

/**
 * One goal, and the weekly ladder that follows it.
 *
 * `{id}` is the goal's **uniqid** (`goal.id`) — never `_id`, and never a message
 * id. The ladder underneath is a list of MESSAGE ids, and the two are easy to
 * confuse because both travel through `/goal/…` paths.
 *
 * There is **no single-goal endpoint** in this API, so the goal document is looked
 * up in the store's own buckets (`selectGoal`) — the page a reader came from has
 * already loaded the list. On a deep link the buckets are empty, and the header
 * then falls back to the newest message's `input`, which carries the same
 * description, score and timeline the goal was created with. That fallback is why
 * a started goal's page is complete even when the list behind it never loaded, and
 * why an unstarted goal on a cold deep link shows only the start prompt.
 *
 * `now` is read once on mount and handed down: a relative time produced during SSR
 * and a different one produced at hydration is a text mismatch Vue reports. The
 * server renders the deterministic `faDate`, and only a mounted client says
 * «۳ روز پیش».
 *
 * ⚠️ **`key` ON THE ROUTE, FOR THE SAME REASON ITS SIBLING HAS ONE.** Vue Router
 * reuses a component instance when only the PARAMETERS of a route change, so
 * `/goal/A` → `/goal/B` would be patched in place: goal A's `activeGoal` and
 * ladder would sit under goal B's heading for the length of the request, and
 * `onMounted` below — which reads the clock, resets the reading state and asks
 * for the ladder — would not run a second time. `fullPath` rather than the bare
 * param so a query change is a new page too, which is the rule stated at its
 * widest.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "هدف",
  key: (route) => route.fullPath,
});

useSeoMeta({ title: "هدف" });

const route = useRoute();
const goalStore = useGoal();
const { $toast } = useNuxtApp();

const goalId = computed<string>(() => String(route.params.id ?? ""));

const now = ref<number>();

onMounted(async () => {
  now.value = Date.now();

  /**
   * ⚠️ **THE READING STATE IS DROPPED HERE, ON THE WAY IN, AND NOT ON AN
   * `onBeforeUnmount`.** Both halves of that are load-bearing.
   *
   * It has to be dropped at all: goal A's ladder must not be on screen for one
   * frame while goal B's loads, and `reviewState` is derived from the newest
   * message — so a stale `messages` array would also hand goal B a composer
   * asking for a review goal A still owes.
   *
   * It has to be dropped HERE rather than on the way out: the ladder is the only
   * place `message/[id].vue` can find this goal's `moduleId` (for «بازگشت به هدف»)
   * and this week's `input` (for the week header), because the single-message
   * route names no parent goal of its own. Unmounting wiped both, so tapping a
   * week in this ladder — the only in-app way to reach that report — arrived at a
   * headerless page whose only way out was the panel's own back button.
   *
   * The order is what makes it invisible: the reset, `selectGoal` and the
   * `loading.messages` that `getMessages` raises are one synchronous block, so
   * this page is painted once, with its header and a ladder skeleton — never with
   * goal A's ladder, and never with an empty one it has not asked about yet.
   */
  goalStore.resetGoal();

  // The goal document itself comes from a bucket (`selectGoal`), which `resetGoal`
  // did not touch: this goal's own row is re-adopted synchronously, so the header
  // above is there on the first paint and only the ladder waits.
  goalStore.selectGoal(goalId.value);

  // The ladder is the page's real content, so it is fetched even when the goal
  // document itself was not found — the messages are what the reader came for.
  await goalStore.getMessages(goalId.value);
});

const isLoading = computed<boolean>(() => goalStore.state.loading.messages);

/** The goal's own document, or `null` on a cold deep link. */
const goal = computed(() => goalStore.state.activeGoal);

/**
 * The newest message, which is the one the ladder state describes and the one
 * whose `input` describes the goal when the document itself is missing.
 *
 * ⚠️ `state.messages` is NEWEST-FIRST; `timelineMessages` is the oldest-first view.
 */
const newestMessage = computed(() => goalStore.state.messages[0] ?? null);

/** One source for the header, whichever of the two the page can actually reach. */
const header = computed(() => {
  if (goal.value) {
    return {
      domain: goal.value.input.domain,
      description: goal.value.input.description,
      targetTimeline: goal.value.input.targetTimeline,
      currentScore: goal.value.input.currentScore,
      goalExpiredAt: goal.value.input.goalExpiredAt,
      successMetric: goal.value.input.successMetric ?? "",
      obstacles: goal.value.input.obstacles ?? "",
    };
  }

  const input = newestMessage.value?.input;

  return input
    ? {
        domain: input.domain,
        description: input.description,
        targetTimeline: input.targetTimeline,
        currentScore: input.currentScore,
        goalExpiredAt: input.goalExpiredAt ?? input.expiredAt,
        successMetric: input.successMetric,
        obstacles: input.obstacles,
      }
    : null;
});

/**
 * «تا ۱۲ اسفند» — or `""` when this goal carries no usable closing date.
 *
 * `faDate` answers an unusable figure with `""`, and a chip that reads only «تا » is
 * a broken chip rather than a missing one. It is reachable because
 * `goalExpiredAt` is OPTIONAL on a message's inherited input — it exists only on a
 * window opened by a review — so the header's fallback branch (used on a cold deep
 * link, where the goal document was never found) can carry `undefined` even though
 * `GoalInput` types it as required. The whole chip is dropped in that case, which
 * is what the same header already does for a missing week on
 * `panels/big/goal/message/[id].vue`.
 */
const expiresLabel = computed<string>(() => {
  const value = header.value?.goalExpiredAt;

  return value ? `تا ${faDate(value)}` : "";
});

/** A refused ladder request whose own `message` would be an English TypeError. */
const messagesError = computed<string | null>(() => {
  if (isLoading.value) return null;
  if (!goalStore.state.error.messages) return null;
  if (goalStore.state.reason === "ERR_GOAL_NOT_FOUND") {
    return "این هدف پیدا نشد؛ ممکن است حذف شده باشد.";
  }

  return goalStore.state.error.messages;
});

function retry() {
  goalStore.getMessages(goalId.value);
}

async function onStart(id: string) {
  const started = await goalStore.startGoal(id);

  if (!started) {
    $toast.error(goalStore.state.error.start ?? "شروع هدف انجام نشد");
    return;
  }

  // The first message only exists after a re-read, and the composer must not sit
  // open over a ladder that has not moved yet.
  await goalStore.getMessages(id);
}

async function onSubmitReview(review: string) {
  const score = await goalStore.submitReview(goalId.value, review);

  // `null` means the server refused; the reason is already rendered beside the
  // composer, so a toast here would say the same thing twice.
  if (score === null) return;

  $toast.success(`گزارش شما ثبت شد. امتیاز پیگیری: ${faNumber(score)}`);
}
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!-- The header. Every field is the reader's own writing, so nothing here is
         rendered as progress: `currentScore` is labelled «نقطهٔ شروع» for the same
         reason the chart is. -->
    <section
      v-if="header"
      class="reveal rounded-3xl bg-white p-4 shadow-xs ring-1 ring-x-primary-100"
    >
      <UBadge
        variant="soft"
        :icon="GOAL_DOMAINS_META[header.domain].icon"
        :label="GOAL_DOMAINS_META[header.domain].label"
        :ui="{
          base:
            'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-500 to-x-primary-200 text-white ring-x-primary-300/60',
        }"
      />

      <p class="mt-2 text-sm leading-7 text-x-text-body">
        {{ header.description }}
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        <UBadge
          variant="soft"
          icon="solar:calendar-linear"
          :label="faDuration(header.targetTimeline)"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-secondary-500 to-x-secondary-200 text-white ring-x-secondary-300/60',
          }"
        />

        <UBadge
          v-if="expiresLabel"
          variant="soft"
          icon="solar:hourglass-linear"
          :label="expiresLabel"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-content-600 to-x-primary-content-400 text-white ring-x-primary-content-400/60',
          }"
        />

        <UBadge
          variant="soft"
          icon="solar:chart-2-linear"
          :label="`نقطهٔ شروع: ${faNumber(header.currentScore)} از ۱۰`"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-500 to-x-primary-200 text-white ring-x-primary-300/60',
          }"
        />
      </div>

      <!-- The reader's own two extra fields, collapsed: they informed the weekly
           guidance and are worth re-reading, but they are not the reason to open
           this page. -->
      <div
        v-if="header.successMetric || header.obstacles"
        class="mt-3 space-y-1.5 border-t border-slate-100 pt-3"
      >
        <p v-if="header.successMetric" class="text-xs leading-6 text-x-text-subtitle">
          <strong class="text-x-text-body">معیار موفقیت:</strong>
          {{ header.successMetric }}
        </p>
        <p v-if="header.obstacles" class="text-xs leading-6 text-x-text-subtitle">
          <strong class="text-x-text-body">مانع‌ها:</strong>
          {{ header.obstacles }}
        </p>
      </div>
    </section>

    <section aria-labelledby="panel-goal-followup" class="mt-6">
      <h2
        id="panel-goal-followup"
        class="text-sm font-yekan-bold text-x-text-title"
      >
        پیگیری هفتگی
      </h2>

      <div class="mt-3">
        <!-- SKELETON FIRST: `loading.messages` starts `true`, so the server render
             and the client's first paint agree the ladder has not arrived. -->
        <div v-if="isLoading" aria-busy="true">
          <TestListSkeleton shape="row" :rows="2" label="در حال دریافت پیگیری هفتگی" />
        </div>

        <!--
          ERROR, inline rather than through `UiStateMessage`.

          That component is a FULL-SCREEN state — its root is `h-[55dvh]` — and this
          is a section under a heading and under the goal's own header card: the
          sentence and the button that retries it would land half a viewport below
          where the reader is looking, on the one screen this app is drawn for. It
          is the same reason `panels/big/goals` and `panels/big/tests` each write
          their own: half the viewport, twice, on a page that already has content
          above it.

          `ERR_GOAL_NOT_FOUND` is worded here rather than by the server, because the
          server's own refusal for it arrives with a `message` this page must not
          guess at. The retry is the reason this state is not terminal at all: a
          failed request CAN succeed the second time, so it carries the one button
          that asks again — and pressing it flips `loading.messages`, which swaps
          this state for the skeleton above rather than for itself.
        -->
        <div
          v-else-if="messagesError"
          class="flex flex-col items-center gap-2.5 px-2 py-6 text-center"
        >
          <span
            class="grid size-14 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:link-broken-linear" size="28" />
          </span>

          <p role="alert" class="text-sm font-yekan-bold text-x-text-title">
            {{ messagesError }}
          </p>

          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            variant="soft"
            color="x-primary"
            class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-11 rounded-full' }"
            @click="retry"
          />
        </div>

        <!-- The five ladder states, in one place. -->
        <GoalTimeline
          v-else
          :goal-id="goalId"
          :messages="goalStore.timelineMessages"
          :state="goalStore.reviewState"
          :loading="isLoading"
          :starting="goalStore.state.loading.start"
          :submitting="goalStore.state.loading.review"
          :error="goalStore.state.error.review"
          :now="now"
          @start="onStart"
          @submit-review="onSubmitReview"
        />
      </div>
    </section>
  </div>
</template>