<script lang="ts" setup>
import { useIntervalFn } from "@vueuse/core";
import { faNumber } from "~/utils/fa";

definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "آزمون" });

const route = useRoute();
const { $toast } = useNuxtApp();
const testStore = useTest();
const childPanel = useChildPanel();

const examId = computed(() =>
  typeof route.query.examId === "string" ? route.query.examId : "",
);

const isChild = computed(() => childPanel.variant === "child");
const radius = computed(() => (isChild.value ? "rounded-3xl" : "rounded-xl"));
const surfaceRadius = computed(() => (isChild.value ? "rounded-2xl" : "rounded-xl"));

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];

const questions = ref<QuestionsData["questions"]>([]);
const questionCount = ref<number | undefined>(undefined);
const currentQuestion = ref<number>(0);
const resultModal = ref<boolean>(false);
const isSubmitting = ref<boolean>(false);
const resultTitle = ref<string>("");
/** The scoring endpoint answers `{ code, title, body }` — it has no numeric
 *  score and no fixed total, so the modal shows the real code rather than an
 *  invented "۲۰ از ۲۰". `body` is the child/teen's own interpretation, which is
 *  exactly the version this panel must show (the parent's is `for`, which only
 *  the parent panel renders). */
const resultCode = ref<string>("");
const resultBody = ref<string>("");
const loadError = ref<string | null>(null);

const examMinutes = ref<number>(0);
const totalSeconds = ref<number>(0);
const remainingSeconds = ref<number>(0);

type Answer = { qId: string; oId: string; subOptionId?: string };

interface Draft {
  oId?: string;
  most?: { oId: string; subOptionId: string };
  least?: { oId: string; subOptionId: string };
}

const answerMap = reactive<Record<string, Draft>>({});

const answerKeys = computed<Answer[]>(() =>
  Object.entries(answerMap).flatMap(([qId, draft]) => {
    if (draft.most && draft.least) {
      return [
        { qId, oId: draft.most.oId, subOptionId: draft.most.subOptionId },
        { qId, oId: draft.least.oId, subOptionId: draft.least.subOptionId },
      ];
    }
    return draft.oId ? [{ qId, oId: draft.oId }] : [];
  }),
);

const isDiscTest = computed(() => testStore.state.questions?.type === "DISC");

const currentOptions = computed(
  () => questions.value?.at(currentQuestion.value)?.options ?? [],
);

/** Four- and five-option tests get tighter rows so every option stays visible. */
const compactOptions = computed(() => currentOptions.value.length >= 4);

const currentQuestionId = computed(
  () => questions.value?.at(currentQuestion.value)?.questionId ?? "",
);

const currentDraft = computed<Draft>(() => answerMap[currentQuestionId.value] ?? {});
const selectedOptionId = computed(() => currentDraft.value.oId);
const mostOptionId = computed(() => currentDraft.value.most?.oId);
const leastOptionId = computed(() => currentDraft.value.least?.oId);

const totalQuestions = computed(() => Number(questionCount.value) || 0);
const currentNumber = computed(() => currentQuestion.value + 1);
const isFirstQuestion = computed(() => currentQuestion.value <= 0);
const isLastQuestion = computed(
  () => totalQuestions.value > 0 && currentQuestion.value >= totalQuestions.value - 1,
);
const hasTotalTime = computed(() => totalSeconds.value > 0);
const isTimeUp = computed(() => hasTotalTime.value && remainingSeconds.value <= 0);

const progressValue = computed(() =>
  totalQuestions.value ? (currentNumber.value / totalQuestions.value) * 100 : 0,
);

const ringDashoffset = computed(() =>
  hasTotalTime.value
    ? RING_CIRCUMFERENCE * (1 - remainingSeconds.value / totalSeconds.value)
    : 0,
);

const optionLetter = (index: number) => OPTION_LETTERS[index] ?? String(index + 1);

const faDigits = (value: number) =>
  faNumber(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".charAt(Number(digit)));

const faTwoDigits = (value: number) => faDigits(value).padStart(2, "۰");

const timerText = computed(() => {
  const hours = Math.floor(remainingSeconds.value / 3600);
  const minutes = Math.floor((remainingSeconds.value % 3600) / 60);
  const seconds = remainingSeconds.value % 60;
  return hours > 0
    ? `${faTwoDigits(hours)}:${faTwoDigits(minutes)}:${faTwoDigits(seconds)}`
    : `${faTwoDigits(minutes)}:${faTwoDigits(seconds)}`;
});

const timerLabel = computed(
  () => `${faNumber(remainingSeconds.value)} ثانیه از زمان کل آزمون باقی مانده است`,
);

const primaryBg = computed(() =>
  isChild.value ? "bg-x-kid-sun-500 text-x-kid-900" : "bg-x-teen-violet-600 text-white",
);

const selectedClass = computed(() =>
  isChild.value
    ? "bg-x-kid-sun-100 border-x-kid-sun-500"
    : "bg-x-teen-violet-300/25 border-x-teen-violet-500",
);

function selectAnswer(questionId: string, optionId: string) {
  answerMap[questionId] = { oId: optionId };
}

function selectDiscAnswer(
  questionId: string,
  optionId: string,
  subOptionId: string,
  type: "most" | "least",
) {
  const draft: Draft = { ...(answerMap[questionId] ?? {}) };

  if (type === "most") {
    if (draft.least?.oId === optionId) delete draft.least;
    draft.most = { oId: optionId, subOptionId };
  } else {
    if (draft.most?.oId === optionId) delete draft.most;
    draft.least = { oId: optionId, subOptionId };
  }

  answerMap[questionId] = draft;
}

function validateCurrentQuestion(): boolean {
  const questionId = currentQuestionId.value;
  if (!questionId) return false;

  const draft = answerMap[questionId];

  if (isDiscTest.value) {
    if (!draft?.most || !draft?.least) {
      $toast.info("لطفاً برای این سوال هم «بیشترین» و هم «کمترین» را انتخاب کنید");
      return false;
    }

    if (draft.most.oId === draft.least.oId) {
      $toast.error("یک گزینه نمی‌تواند همزمان هم «بیشترین» و هم «کمترین» باشد");
      return false;
    }

    return true;
  }

  if (!draft?.oId) {
    $toast.info("لطفاً به سوال آزمون پاسخ مناسب دهید");
    return false;
  }

  return true;
}

function goNext() {
  if (isLastQuestion.value) return;
  if (!validateCurrentQuestion()) return;
  currentQuestion.value++;
}

function goPrev() {
  if (isFirstQuestion.value) return;
  currentQuestion.value--;
}

watch(currentQuestion, () => {
  if (import.meta.client) window.scrollTo({ top: 0 });
});

async function resolveDuration() {
  if (childPanel.state.available.length === 0 && childPanel.state.consumed.length === 0) {
    await childPanel.loadTests();
  }

  const asset =
    childPanel.state.available.find((entry) => entry.id === examId.value) ??
    childPanel.state.consumed.find((entry) => entry.id === examId.value);

  const body = asset?.test?.[0] as { duration?: number } | undefined;
  const minutes = Number(body?.duration ?? 0);

  examMinutes.value = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  totalSeconds.value = Math.round(examMinutes.value * 60);
  remainingSeconds.value = totalSeconds.value;
}

async function sendAnswers() {
  if (isSubmitting.value) return false;
  isSubmitting.value = true;

  try {
    const res = await testStore.sendAnswer(answerKeys.value, examId.value, "child");

    if (!res?.success) {
      if (res?.reason === "ERR_VALIDATION") {
        $toast.error(res?.data?.errors?.[0]?.message ?? "خطا در ارسال پاسخ‌ها");
      } else {
        $toast.error(res?.message ?? "خطا در ارسال پاسخ‌ها");
      }
      return false;
    }

    resultModal.value = true;
    resultTitle.value = res?.response?.title ?? "";
    resultCode.value = String(res?.response?.code ?? "");
    resultBody.value =
      typeof res?.response?.body === "string" ? res.response.body : "";
    return true;
  } finally {
    isSubmitting.value = false;
  }
}

async function sendResultAndScoring() {
  if (!validateCurrentQuestion()) return;
  await sendAnswers();
}

async function finishOnTimeUp() {
  $toast.info("زمان آزمون به پایان رسید. نتایج شما ثبت می‌شود.");
  await sendAnswers();
}

const { pause: pauseTimer, resume: resumeTimer } = useIntervalFn(
  () => {
    if (remainingSeconds.value <= 0) return;
    remainingSeconds.value -= 1;

    if (remainingSeconds.value === 0) {
      pauseTimer();
      void finishOnTimeUp();
    }
  },
  1000,
  { immediate: false },
);

watch(
  () => [hasTotalTime.value, totalSeconds.value],
  ([hasTime]) => {
    if (hasTime) resumeTimer();
    else pauseTimer();
  },
);

async function loadExam() {
  loadError.value = null;

  if (!examId.value) {
    loadError.value = "آزمون مشخص نشده است.";
    return;
  }

  let getQuestions: Awaited<ReturnType<typeof testStore.getTestQuestions>>;

  try {
    getQuestions = await testStore.getTestQuestions(examId.value, "child");
  } catch {
    // A transport failure throws out of `$fetch`. Without this the page falls
    // through to an exam shell with ZERO questions — "سوال ۱ از ۰" and a next
    // button that only toasts — which reads as a broken test, not a dead
    // connection, and leaves the child with no way forward.
    loadError.value =
      "در حال حاضر ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
    return;
  }

  if (!getQuestions?.success) {
    testStore.state.loading.getQuestions = false;
    const reason = getQuestions?.message ?? "خطا در اعتبارسنجی آزمون";
    loadError.value = reason;
    $toast.error("خطای اعتبار سنجی", { description: reason });
    return;
  }

  questions.value = testStore.state.questions?.questions ?? [];
  const rawCount = testStore.state.questions?.questionCount;
  questionCount.value = rawCount ? Number(rawCount) : undefined;

  await resolveDuration();
}

onMounted(async () => {
  await loadExam();
});
</script>

<template>
  <div class="mx-auto flex min-h-full w-11/12 flex-col pb-8 pt-4">
    <div
      v-if="testStore.state.loading.getQuestions"
      class="grid min-h-[60dvh] place-items-center"
      aria-busy="true"
    >
      <div class="space-y-3 text-center">
        <UIcon name="line-md:loading-twotone-loop" size="50" :class="isChild ? 'text-x-kid-sun-500' : 'text-x-teen-violet-500'" />
        <p class="text-sm text-x-text-subtitle">در حال ورود به آزمون</p>
      </div>
    </div>

    <UiStateMessage
      v-else-if="loadError"
      icon="solar:danger-triangle-linear"
      :title="loadError"
      action-label="بازگشت به آزمون‌ها"
      action-to="/panels/child/tests"
    />

    <template v-else>
      <header class="sticky top-0 z-10 -mt-4 mb-4 border-b border-x-kid-300/40 bg-x-kid-50/90 px-1 py-3 backdrop-blur-sm" :class="!isChild ? 'border-x-teen-200 bg-x-teen-50/90' : ''">
        <div class="flex items-center gap-3">
          <UButton
            icon="solar:arrow-right-linear"
            to="/panels/child/tests"
            variant="soft"
            :color="isChild ? 'neutral' : 'neutral'"
            aria-label="بازگشت به فهرست آزمون‌ها"
            :ui="{ base: 'size-10 rounded-full' }"
          />
          <h1 class="min-w-0 truncate font-yekan-bold text-sm text-x-text-title">
            {{ testStore.state.questions?.title ?? "آزمون" }}
          </h1>
        </div>
      </header>

      <section class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-x-text-subtitle">سوال</p>
          <p class="ltr flex items-baseline gap-1" dir="ltr">
            <span class="text-4xl font-extrabold leading-none" :class="isChild ? 'text-x-kid-sun-500' : 'text-x-teen-violet-500'">
              {{ faNumber(currentNumber) }}
            </span>
            <span class="text-2xl font-bold text-x-text-title">/{{ faNumber(totalQuestions) }}</span>
          </p>
        </div>

        <div v-if="hasTotalTime" class="flex shrink-0 flex-col items-center gap-1">
          <div class="relative grid size-20 place-items-center">
            <svg viewBox="0 0 64 64" class="size-20 -rotate-90" dir="ltr" aria-hidden="true">
              <circle cx="32" cy="32" :r="RING_RADIUS" fill="none" stroke-width="5" :class="isChild ? 'stroke-x-kid-100' : 'stroke-x-teen-100'" />
              <circle
                cx="32"
                cy="32"
                :r="RING_RADIUS"
                fill="none"
                stroke-width="5"
                stroke-linecap="round"
                :class="isChild ? 'stroke-x-kid-sun-500' : 'stroke-x-teen-violet-500'"
                class="transition-[stroke-dashoffset] duration-1000 ease-linear"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="ringDashoffset"
              />
            </svg>
            <span
              class="absolute text-sm font-bold tabular-nums text-x-text-title"
              :class="isTimeUp ? 'text-red-500' : ''"
              role="timer"
              :aria-label="timerLabel"
              aria-live="off"
            >{{ timerText }}</span>
          </div>
          <p class="text-[10px] text-x-text-muted">از {{ faNumber(examMinutes) }} دقیقه</p>
        </div>
      </section>

      <div class="pt-4">
        <div
          role="progressbar"
          :aria-valuenow="currentNumber"
          :aria-valuemin="1"
          :aria-valuemax="totalQuestions"
          aria-label="پیشرفت آزمون"
          class="h-2 w-full overflow-hidden rounded-full"
          :class="isChild ? 'bg-x-kid-100' : 'bg-x-teen-100'"
        >
          <div class="h-full rounded-full transition-[width] duration-300 ease-out" :class="isChild ? 'bg-x-kid-sun-500' : 'bg-x-teen-violet-500'" :style="{ width: `${progressValue}%` }" />
        </div>
      </div>

      <div class="flex-1 pt-6 pb-40">
        <div class="neu-raised relative overflow-hidden bg-white p-5" :class="radius">
          <p
            class="relative break-words text-base font-bold leading-8 text-x-text-body"
          >
            {{ questions?.at(currentQuestion)?.text }}
          </p>
        </div>

        <div
          class="mt-5 grid"
          :class="compactOptions ? 'gap-2' : 'gap-2.5'"
          role="radiogroup"
          aria-label="گزینه‌های پاسخ"
        >
          <div
            v-for="(op, index) of currentOptions"
            :key="op.optionId"
            class="border transition-colors duration-150"
            :class="[
              isDiscTest ? 'border-transparent bg-white' : selectedOptionId === op.optionId ? selectedClass : 'border-transparent bg-white',
              radius,
            ]"
          >
            <button
              v-if="!isDiscTest"
              type="button"
              role="radio"
              :aria-checked="selectedOptionId === op.optionId"
              class="flex w-full cursor-pointer items-center gap-3 px-3 text-start"
              :class="compactOptions ? 'min-h-11 py-2.5' : 'min-h-14 py-3.5'"
              @click="selectAnswer(currentQuestionId, op.optionId)"
            >
              <span
                class="grid shrink-0 place-items-center bg-white font-bold text-x-text-subtitle shadow-sm"
                :class="[
                  surfaceRadius,
                  compactOptions ? 'size-7 text-xs' : 'size-8 text-sm',
                ]"
                aria-hidden="true"
              >
                {{ optionLetter(index) }}
              </span>
              <span
                class="text-x-text-body"
                :class="compactOptions ? 'text-[13px] leading-6' : 'text-sm'"
                >{{ op.text }}</span
              >
            </button>

            <div
              v-else
              class="flex items-center gap-3 px-3"
              :class="compactOptions ? 'pt-2.5' : 'pt-3.5'"
            >
              <span
                class="grid shrink-0 place-items-center bg-white font-bold text-x-text-subtitle shadow-sm"
                :class="[
                  surfaceRadius,
                  compactOptions ? 'size-7 text-xs' : 'size-8 text-sm',
                ]"
                aria-hidden="true"
              >
                {{ optionLetter(index) }}
              </span>
              <p
                class="text-x-text-body"
                :class="compactOptions ? 'text-[13px] leading-6' : 'text-sm'"
              >
                {{ op.text }}
              </p>
            </div>

            <div
              v-if="isDiscTest"
              class="grid grid-cols-2 text-xs"
              :class="compactOptions ? 'gap-1.5 p-2 pt-1.5' : 'gap-2 p-3 pt-2'"
            >
              <button
                type="button"
                :aria-pressed="leastOptionId === op.optionId"
                class="relative flex items-center justify-center rounded-2xl border border-neutral-500/10 transition"
                :class="[
                  leastOptionId === op.optionId
                    ? 'bg-red-500! font-bold text-white! shadow-md'
                    : 'bg-white text-x-text-title',
                  compactOptions ? 'h-9 text-[11px]' : 'h-11',
                ]"
                @click.stop="selectDiscAnswer(currentQuestionId, op.optionId, op?.score?.least?.id, 'least')"
              >
                {{ op?.score?.least?.label || "کمترین" }}
              </button>

              <button
                type="button"
                :aria-pressed="mostOptionId === op.optionId"
                class="relative flex items-center justify-center rounded-2xl border border-neutral-500/10 transition"
                :class="[
                  mostOptionId === op.optionId
                    ? 'bg-emerald-600! font-bold text-white! shadow-md'
                    : 'bg-white text-x-text-title',
                  compactOptions ? 'h-9 text-[11px]' : 'h-11',
                ]"
                @click.stop="selectDiscAnswer(currentQuestionId, op.optionId, op?.score?.most?.id, 'most')"
              >
                {{ op?.score?.most?.label || "بیشترین" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-sm" :class="isChild ? 'border-x-kid-300/40 bg-x-kid-50/95' : 'border-x-teen-200 bg-x-teen-50/95'">
        <div class="exam__safe-bottom mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-3">
          <UButton
            icon="solar:arrow-right-linear"
            label="سوال قبلی"
            variant="soft"
            color="neutral"
            class="flex-1"
            :disabled="isFirstQuestion"
            :ui="{ base: 'h-14 justify-center rounded-2xl' }"
            @click="goPrev"
          />

          <UButton
            v-if="!isLastQuestion"
            icon="solar:arrow-left-linear"
            label="سوال بعدی"
            variant="solid"
            class="flex-1"
            :ui="{ base: `h-14 justify-center rounded-2xl ${isChild ? 'bg-x-kid-sun-500 text-x-kid-900' : 'bg-x-teen-violet-600 text-white'}` }"
            @click="goNext"
          />

          <UButton
            v-else
            label="دریافت نتیجه آزمون"
            variant="solid"
            class="flex-1"
            :disabled="isSubmitting || testStore.state.loading.sendAnswer"
            :loading="isSubmitting || testStore.state.loading.sendAnswer"
            :ui="{ base: `h-14 justify-center rounded-2xl ${isChild ? 'bg-x-kid-sun-500 text-x-kid-900' : 'bg-x-teen-violet-600 text-white'}` }"
            @click="sendResultAndScoring"
          />
        </div>
      </div>
    </template>

    <UModal
      v-model:open="resultModal"
      :dismissible="false"
      :ui="{ content: 'w-85 rounded-3xl shadow-none', overlay: 'backdrop-blur-md', header: 'hidden' }"
    >
      <template #content>
        <div
          class="relative grid max-h-[85dvh] w-full place-items-center overflow-y-auto px-5 pb-6 pt-9 text-center"
        >
          <span
            class="grid size-28 place-items-center rounded-full ring-8"
            :class="isChild ? 'bg-x-kid-sun-100 ring-x-kid-sun-500/30' : 'bg-x-teen-violet-300/30 ring-x-teen-violet-500/20'"
            aria-hidden="true"
          >
            <UIcon name="solar:cup-star-bold" size="56" :class="isChild ? 'text-x-kid-sun-700' : 'text-x-teen-violet-600'" />
          </span>

          <p class="mt-5 font-yekan-extra text-2xl text-x-text-title">
            آفرین{{ childPanel.state.profile?.fullName?.first ? ` ${childPanel.state.profile.fullName.first}` : "" }}!
          </p>
          <p class="mt-1 text-sm leading-7 text-x-text-subtitle">
            تو موفق شدی آزمون «{{ testStore.state.questions?.title }}» را تمام کنی
          </p>

          <!-- The result itself: a card that leans toward the pointer on
               hover-capable devices, flat on touch — and the interpretation
               text the scoring endpoint returns for this reader. -->
          <ChildTiltCard :max="7" class="mt-5 w-full">
            <div
              class="grid place-items-center gap-2 rounded-3xl p-5 text-center"
              :class="
                isChild
                  ? 'bg-linear-to-b from-x-kid-sun-50 to-white ring-1 ring-x-kid-sun-500/30'
                  : 'bg-linear-to-b from-x-teen-50 to-white ring-1 ring-x-teen-violet-500/20'
              "
            >
              <span
                class="grid size-20 place-items-center rounded-full ring-8"
                :class="isChild ? 'bg-x-kid-sun-100 ring-x-kid-sun-500/30' : 'bg-x-teen-violet-300/30 ring-x-teen-violet-500/20'"
                aria-hidden="true"
              >
                <UIcon name="solar:cup-star-bold" size="40" :class="isChild ? 'text-x-kid-sun-700' : 'text-x-teen-violet-600'" />
              </span>

              <h2
                class="mt-2 break-words font-yekan-extra text-lg leading-8"
                :class="isChild ? 'text-x-kid-900' : 'text-x-text-title'"
              >
                {{ resultTitle || "نتیجه آزمون" }}
              </h2>

              <p
                v-if="resultCode"
                class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-yekan-bold"
                :class="isChild ? 'bg-x-kid-mint-100 text-x-kid-mint-700' : 'bg-x-teen-100 text-x-teen-700'"
              >
                کد نتیجه:
                <span dir="ltr" class="font-yekan-extra">{{ resultCode }}</span>
              </p>
            </div>
          </ChildTiltCard>

          <div
            v-if="resultBody"
            class="content mt-3 w-full rounded-3xl px-4 py-4 text-start text-sm leading-7 text-x-text-body"
            :class="isChild ? 'bg-x-kid-sun-100/70' : 'bg-x-teen-violet-300/15'"
            v-html="resultBody"
          />
          <p v-else class="mt-3 text-xs leading-6 text-x-text-muted">
            متن نتیجه ثبت نشده است.
          </p>

          <NuxtLink
            to="/panels/child/results"
            class="mt-6 inline-flex h-12 w-full shrink-0 items-center justify-center rounded-full font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="isChild ? 'bg-x-kid-sun-500 text-x-kid-900' : 'bg-x-teen-violet-600 text-white'"
          >
            بازگشت
          </NuxtLink>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped lang="scss">
.exam__safe-bottom {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
</style>
