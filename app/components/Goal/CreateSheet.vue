<script setup lang="ts">
import { GOAL_DOMAINS_META, type CreateGoalInput, type GoalDomain } from "~/types/goal";
import { faNumber } from "~/utils/fa";

/**
 * The form that creates a goal, as a fullscreen sheet.
 *
 * It owns NOTHING about the request: `submitting` and `error` come in as props
 * and the finished `CreateGoalInput` goes out as an event. A form that also
 * called the store would have to be re-mounted to forget a failed attempt, and
 * the parent that owns the list is the only thing that knows when it is stale.
 *
 * ⚠️ **`targetTimeline` is DAYS upstream, whatever the name reads like.** The
 * server computes `goalExpiredAt = now + targetTimeline * 86400000`, so the field
 * is labelled «روز» and the presets are day counts. A "6 months" answer typed
 * into a field the server reads as days would expire the goal six days later.
 */
const props = withDefaults(
  defineProps<{
    domain: GoalDomain;
    open: boolean;
    submitting?: boolean;
    error?: string | null;
  }>(),
  { submitting: false, error: null },
);

const emit = defineEmits<{
  "update:open": [boolean];
  submit: [CreateGoalInput];
}>();

/** `createGoalSchema` upstream: `description` is `min(20)`. */
const DESCRIPTION_MIN = 20;

/** `targetTimeline` is `min(1)` and `currentScore` is 1..10, both required. */
const SCORE_MIN = 1;
const SCORE_MAX = 10;

/**
 * Day presets, chosen as the spans people actually plan in. They are a shortcut,
 * not a constraint: the field beside them takes any whole number of days, because
 * "9 weeks" is a real answer and a preset list of four would forbid it.
 */
const DAY_PRESETS = [30, 90, 180, 365];

const description = ref("");
const successMetric = ref("");
const obstacles = ref("");
const targetTimeline = ref(90);
const currentScore = ref(5);

/**
 * The day field's value, coerced to something the server accepts.
 *
 * `UInputNumber` reports `null` when its field is emptied, and `null` is not a
 * number — the schema wants `targetTimeline` ≥ 1. Rather than let a half-typed
 * field send `NaN`, an unusable value collapses to `1`: the field then simply
 * refuses to be blank, which is also the smallest duration the API permits.
 */
const days = computed<number>({
  get: () => targetTimeline.value,
  set: (value) => {
    targetTimeline.value = Number.isFinite(value) && value >= 1 ? value : 1;
  },
});

const descriptionLength = computed<number>(() => description.value.trim().length);

/** `description` is the only field with a real bound, so it gates the button. */
const canSubmit = computed<boolean>(
  () => descriptionLength.value >= DESCRIPTION_MIN && !props.submitting,
);

/** Reset every time the sheet opens, so a failed attempt does not linger. */
watch(
  () => props.open,
  (open) => {
    if (!open) return;

    description.value = "";
    successMetric.value = "";
    obstacles.value = "";
    targetTimeline.value = 90;
    currentScore.value = 5;
  },
);

function setDays(value: number) {
  days.value = value;
}

function submit() {
  if (!canSubmit.value) return;

  emit("submit", {
    domain: props.domain,
    targetTimeline: days.value,
    currentScore: currentScore.value,
    description: description.value.trim(),
    // Both optional upstream (they `.default("")`), and sent explicitly so the
    // stored `input` is complete on the first read.
    successMetric: successMetric.value.trim(),
    obstacles: obstacles.value.trim(),
  });
}
</script>

<template>
  <UModal
    :open="open"
    fullscreen
    :title="`ثبت هدف در ${GOAL_DOMAINS_META[domain].label}`"
    description="هر چه روشن‌تر بنویسید، راهنمای هفتگی دقیق‌تر می‌شود."
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5 pb-4">
        <UFormField
          label="هدف شما چیست؟"
          :hint="`دست‌کم ${faNumber(DESCRIPTION_MIN)} نویسه`"
          :error="
            descriptionLength > 0 && descriptionLength < DESCRIPTION_MIN
              ? `${faNumber(DESCRIPTION_MIN - descriptionLength)} نویسهٔ دیگر بنویسید`
              : undefined
          "
          required
        >
          <UTextarea
            v-model="description"
            :rows="4"
            autoresize
            :maxlength="600"
            color="x-primary"
            variant="soft"
            placeholder="مثلاً: می‌خواهم تا پایان سال برنامهٔ منظمی برای تمرین‌های هفتگی‌ام داشته باشم."
            :ui="{ base: 'rounded-2xl bg-white text-sm leading-7' }"
            class="w-full"
          />
        </UFormField>

        <UFormField label="موفقیت را چگونه می‌سنجید؟">
          <UTextarea
            v-model="successMetric"
            :rows="2"
            autoresize
            :maxlength="300"
            color="x-primary"
            variant="soft"
            placeholder="مثلاً: هر هفته دست‌کم سه جلسهٔ ۴۵ دقیقه‌ای تمرین کرده‌ام."
            :ui="{ base: 'rounded-2xl bg-white text-sm leading-7' }"
            class="w-full"
          />
        </UFormField>

        <UFormField label="چه چیزی می‌تواند مانع شما شود؟">
          <UTextarea
            v-model="obstacles"
            :rows="2"
            autoresize
            :maxlength="300"
            color="x-primary"
            variant="soft"
            placeholder="مثلاً: فشار کاری و خستگی در پایان هفته."
            :ui="{ base: 'rounded-2xl bg-white text-sm leading-7' }"
            class="w-full"
          />
        </UFormField>

        <!--
          `targetTimeline` upstream is DAYS, so the label says «روز» and not
          «مدت». The presets are the same four numbers in Persian digits; the
          field itself takes any whole number, so a 9-week plan is typeable.
        -->
        <UFormField label="در چند روز؟" hint="بازهٔ رسیدن به هدف، بر حسب روز">
          <UInputNumber
            v-model="days"
            :min="1"
            :max="3650"
            :step="1"
            size="xl"
            color="x-primary"
            variant="soft"
            locale="fa-IR"
            :ui="{
              base: 'h-12 w-full rounded-2xl border border-slate-200 bg-white hover:bg-slate-50',
            }"
          />

          <div class="mt-2 flex flex-wrap gap-2">
            <UButton
              v-for="preset in DAY_PRESETS"
              :key="preset"
              :label="faNumber(preset)"
              :variant="days === preset ? 'solid' : 'soft'"
              color="x-primary"
              size="xs"
              class="min-h-9"
              :aria-pressed="days === preset"
              :ui="{
                base:
                  'min-h-9 rounded-full px-3 text-xs font-bold transition-transform duration-150 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100',
              }"
              @click="setDays(preset)"
            />
          </div>
        </UFormField>

        <!--
          The 1..10 self-rating. The readout is large and Persian because this is
          the number the chart is built from: it is the reader's own baseline, and
          a slider whose value is only visible as a moving thumb gives them no way
          to tell 6 from 7.

          The `UFormField` wrapper is what NAMES the control: `USlider` reads
          `useFormField` and spreads its `aria-labelledby` onto the root, so the
          Persian label reaches a screen reader through the field and not through
          an `aria-label` written twice.
        -->
        <UFormField label="نقطهٔ شروع شما در این دسته چقدر است؟">
          <div class="rounded-3xl bg-x-primary-50 px-4 py-3">
            <div class="flex items-baseline justify-between">
              <span class="text-xs text-x-text-subtitle">از ۱۰</span>
              <strong class="text-2xl text-x-primary-700 tabular-nums">
                {{ faNumber(currentScore) }}
              </strong>
            </div>

            <USlider
              v-model="currentScore"
              :min="SCORE_MIN"
              :max="SCORE_MAX"
              :step="1"
              size="md"
              color="x-primary"
              class="mt-2 w-full"
            />

            <div
              class="mt-1 flex justify-between text-[10px] text-x-text-muted"
              aria-hidden="true"
            >
              <span>{{ faNumber(SCORE_MIN) }}</span>
              <span>{{ faNumber(SCORE_MAX) }}</span>
            </div>
          </div>
        </UFormField>

        <!--
          The server's own refusal, never a guess. It carries a Persian `path`
          per field upstream, and a reader who typed 18 characters is told that,
          not «something went wrong».
        -->
        <p
          v-if="error"
          role="alert"
          class="rounded-2xl bg-red-50 px-4 py-3 text-xs leading-6 text-red-600"
        >
          {{ error }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-2 pb-2">
        <UButton
          label="انصراف"
          variant="soft"
          color="neutral"
          class="flex-1"
          :ui="{ base: 'h-12 rounded-2xl' }"
          :disabled="submitting"
          @click="emit('update:open', false)"
        />
        <UButton
          label="ثبت هدف"
          variant="solid"
          color="x-primary"
          class="flex-[2]"
          :loading="submitting"
          :disabled="!canSubmit"
          :ui="{ base: 'h-12 rounded-2xl bg-x-primary-600! hover:bg-x-primary-700!' }"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>