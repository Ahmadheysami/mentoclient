<script lang="ts" setup>
import { useIntervalFn } from "@vueuse/core";
import { faNumber } from "~/utils/fa";

definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});

const route = useRoute();
const { $toast } = useNuxtApp();
const testStore = useTest();

const examId = (route.query?.examId as string) || "";

/** Ring geometry for the total-exam countdown. */
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const OPTION_LETTERS = ["a", "b", "c", "d", "e", "f"];

const acceptTerms = ref<boolean>(false),
  acceptTermsHandler = () => {
    acceptTerms.value = true;
  },

  terms = [
    "این آزمون صرفاً برای اهداف اطلاع‌رسانی و خودشناسی طراحی شده است و نتایج آن جایگزین تشخیص و درمان تخصصی روانشناسی یا روانپزشکی نمی‌باشد.",
    "شرکت‌کننده با پذیرش شرایط، مسئولیت کامل استفاده از نتایج آزمون را بر عهده می‌گیرد و هرگونه تصمیم‌گیری بر اساس نتایج، تحت مسئولیت شخصی کاربر خواهد بود.",
    "نتایج این آزمون بر اساس پاسخ‌های ارائه‌شده توسط کاربر محاسبه می‌شود و هیچ‌گونه تضمینی درباره صحت مطلق یا جامعیت نتایج وجود ندارد.",
    "برخی سوالات ممکن است شامل محتوای احساسی یا حساس باشند. شرکت‌کننده با پذیرش شرایط، آمادگی خود را برای مواجهه با این گونه سوالات اعلام می‌دارد.",
    "برای دستیابی به نتایج دقیق‌تر، توصیه می‌شود آزمون در محیطی آرام و بدون مزاحمت و با تمرکز کامل انجام شود. مجموعه مسئولیتی در قبال شرایط محیطی کاربر ندارد.",
    "دقت نتایج کاملاً وابسته به صداقت و دقت کاربر در پاسخ‌دهی است. هرگونه پاسخ نادرست یا غیرواقعی می‌تواند نتایج را تحت تأثیر قرار دهد.",
    "نتایج این آزمون صرفاً جنبه راهنمایی دارد و نباید به‌عنوان مبنای تصمیم‌گیری‌های مهم زندگی، شغلی، تحصیلی یا درمانی استفاده شود.",
    "در صورت احساس ناراحتی، استرس یا هرگونه واکنش منفی حین آزمون، شرکت‌کننده موظف است بلافاصله آزمون را متوقف کرده و در صورت نیاز به روانشناس یا مشاور مراجعه نماید.",
    "اطلاعات و پاسخ‌های شما محرمانه باقی می‌ماند و صرفاً برای تحلیل آماری استفاده می‌شود. مجموعه هیچ‌گونه مسئولیتی در قبال افشای اطلاعات توسط کاربر یا اشخاص ثالث ندارد.",
    "استفاده از این آزمون به معنای پذیرش کامل کلیه قوانین و مقررات فوق است. مجموعه حق تغییر یا به‌روزرسانی شرایط را بدون اطلاع قبلی محفوظ می‌دارد.",
  ],

  questions = ref<QuestionsData["questions"]>(),
  questionCount = ref<number>(),
  currentQuestion = ref<number>(0),
  resultModal = ref<boolean>(false),
  isSubmitting = ref<boolean>(false),
  resultData = reactive({
    code: "",
    title: "",
    body: "",
  }),

  /**
   * Total exam time, in minutes, taken from the purchased test asset.
   * NOTE: the API does not document the unit of `TestItem.duration`; it is
   * treated here as minutes. The countdown is a client-side UX affordance —
   * the backend enforces no time limit.
   */
  examMinutes = ref<number>(0),
  totalSeconds = ref<number>(0),
  remainingSeconds = ref<number>(0);

type Answer = { qId: string; oId: string; subOptionId?: string };

/**
 * Answers are stored per question so the user can move back and forth and
 * change an answer without it being submitted twice. A DISC question holds two
 * answers (`most` + `least`); every other type holds a single `oId`.
 */
interface Draft {
  oId?: string;
  most?: { oId: string; subOptionId: string };
  least?: { oId: string; subOptionId: string };
}

const answerMap = reactive<Record<string, Draft>>({});

/** The exact payload shape `sendAnswer` has always expected. */
const answerKeys = computed<Answer[]>(() =>
  Object.entries(answerMap).flatMap(([qId, draft]) => {
    if (draft.most && draft.least) {
      return [
        { qId, oId: draft.most.oId, subOptionId: draft.most.subOptionId },
        { qId, oId: draft.least.oId, subOptionId: draft.least.subOptionId },
      ];
    }
    return draft.oId ? [{ qId, oId: draft.oId }] : [];
  })
);

const isDiscTest = computed(() => testStore.state.questions?.type === "DISC");

const currentOptions = computed(
  () => questions.value?.at(currentQuestion.value)?.options ?? []
);

const currentQuestionId = computed(
  () => questions.value?.at(currentQuestion.value)?.questionId ?? ""
);

/** Single source of truth for what is selected on the current question. */
const currentDraft = computed<Draft>(() => answerMap[currentQuestionId.value] ?? {});

const selectedOptionId = computed(() => currentDraft.value.oId);
const mostOptionId = computed(() => currentDraft.value.most?.oId);
const leastOptionId = computed(() => currentDraft.value.least?.oId);

const totalQuestions = computed(() => Number(questionCount.value) || 0);
const currentNumber = computed(() => currentQuestion.value + 1);

const isFirstQuestion = computed(() => currentQuestion.value <= 0);
const isLastQuestion = computed(
  () => totalQuestions.value > 0 && currentQuestion.value >= totalQuestions.value - 1
);
const hasTotalTime = computed(() => totalSeconds.value > 0);
const isTimeUp = computed(() => hasTotalTime.value && remainingSeconds.value <= 0);

const progressValue = computed(() =>
  totalQuestions.value ? (currentNumber.value / totalQuestions.value) * 100 : 0
);

const ringDashoffset = computed(() =>
  hasTotalTime.value
    ? RING_CIRCUMFERENCE * (1 - remainingSeconds.value / totalSeconds.value)
    : 0
);

const optionLetter = (index: number) => OPTION_LETTERS[index] ?? String(index + 1);

const faDigits = (value: number) =>
  faNumber(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);

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
  () => `${faNumber(remainingSeconds.value)} ثانیه از زمان کل آزمون باقی مانده است`
);

/* ------------------------------ انتخاب پاسخ ------------------------------ */

// انتخاب پاسخ برای آزمون‌های غیر DISC
const selectAnswer = (questionId: string, optionId: string) => {
  answerMap[questionId] = { oId: optionId };
};

// انتخاب پاسخ برای آزمون DISC با جلوگیری از انتخاب یکسان برای Most و Least
const selectDiscAnswer = (
  questionId: string,
  optionId: string,
  subOptionId: string,
  type: "most" | "least"
) => {
  const draft: Draft = { ...(answerMap[questionId] ?? {}) };

  if (type === "most") {
    // اگر همین optionId قبلا به عنوان least انتخاب شده بود، انتخاب least را پاک کن
    if (draft.least?.oId === optionId) delete draft.least;
    draft.most = { oId: optionId, subOptionId };
  } else {
    // اگر همین optionId قبلا به عنوان most انتخاب شده بود، انتخاب most را پاک کن
    if (draft.most?.oId === optionId) delete draft.most;
    draft.least = { oId: optionId, subOptionId };
  }

  answerMap[questionId] = draft;
};

// اعتبارسنجی پاسخ سوال جاری (پاسخ‌ها از قبل در answerMap ذخیره شده‌اند)
const validateCurrentQuestion = (): boolean => {
  const questionId = currentQuestionId.value;
  if (!questionId) return false;

  const draft = answerMap[questionId];

  if (isDiscTest.value) {
    if (!draft?.most || !draft?.least) {
      $toast.info(
        "لطفاً برای این سوال هم «بیشترین» (Most) و هم «کمترین» (Least) را انتخاب کنید"
      );
      return false;
    }

    // چک نهایی برای جلوگیری از یکسان بودن گزینه انتخاب شده
    if (draft.most.oId === draft.least.oId) {
      $toast.error("یک گزینه نمی‌تواند همزمان هم «بیشترین» و هم «کمترین» باشد");
      return false;
    }

    return true;
  }

  if (!draft?.oId) {
    $toast.info("لطفا به سوال آزمون پاسخ مناسب دهید");
    return false;
  }

  return true;
};

/* -------------------------------- جابه‌جایی -------------------------------- */

const goNext = () => {
  if (isLastQuestion.value) return;
  if (!validateCurrentQuestion()) return;
  currentQuestion.value++;
};

const goPrev = () => {
  if (isFirstQuestion.value) return;
  currentQuestion.value--;
};

watch(currentQuestion, () => {
  if (import.meta.client) window.scrollTo({ top: 0 });
});

/* --------------------------------- تایمر --------------------------------- */

/** Reads `duration` off the purchased asset that matches the current exam. */
const resolveDuration = async () => {
  if (!testStore.state.myTests?.length) {
    await testStore.getMyTests("available");
  }

  const asset = testStore.state.myTests?.find((item) => item.id === examId);
  const minutes = Number(asset?.test?.[0]?.duration ?? 0);

  examMinutes.value = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  totalSeconds.value = Math.round(examMinutes.value * 60);
  remainingSeconds.value = totalSeconds.value;
};

const sendAnswers = async () => {
  if (isSubmitting.value) return false;
  isSubmitting.value = true;

  try {
    const res = await testStore.sendAnswer(answerKeys.value, examId);

    if (!res?.success) {
      if (res?.reason === "ERR_VALIDATION") {
        $toast.error(res?.data?.errors[0].message);
      } else {
        $toast.error(res?.message);
      }
      return false;
    }

    resultModal.value = true;
    resultData.code = res?.response?.code;
    resultData.title = res?.response?.title;
    resultData.body = res?.response?.body;
    return true;
  } finally {
    isSubmitting.value = false;
  }
};

const sendResultAndScoring = async () => {
  if (!validateCurrentQuestion()) return;
  await sendAnswers();
};

/** Time is up: submit whatever has been answered, without blocking on validation. */
const finishOnTimeUp = async () => {
  $toast.info("زمان آزمون به پایان رسید. نتایج شما ثبت می‌شود.");
  await sendAnswers();
};

const { pause: pauseTimer, resume: resumeTimer } = useIntervalFn(() => {
  if (remainingSeconds.value <= 0) return;
  remainingSeconds.value -= 1;

  if (remainingSeconds.value === 0) {
    pauseTimer();
    void finishOnTimeUp();
  }
}, 1000, { immediate: false });

watch([acceptTerms, hasTotalTime], ([accepted, hasTime]) => {
  if (accepted && hasTime) resumeTimer();
  else pauseTimer();
});

onBeforeMount(async () => {
  const getQuestions = await testStore.getTestQuestions(examId);
  if (!getQuestions?.success) {
    testStore.state.loading.getQuestions = false;
    $toast.error("خطای اعتبار سنجی", {
      description: getQuestions?.message,
    });
    await navigateTo("/test/active");
    return;
  }
  questions.value = testStore.state.questions?.questions;
  const rawCount = testStore.state.questions?.questionCount;
  questionCount.value = rawCount ? Number(rawCount) : undefined;

  await resolveDuration();
});
</script>

<template>
  <!-- Loading overlay -->
  <div
    v-if="testStore.state.loading.getQuestions"
    class="grid place-items-center absolute inset-0 z-20 bg-x-quiz-surface"
    aria-busy="true"
  >
    <div class="text-center space-y-3">
      <UIcon
        name="line-md:loading-twotone-loop"
        size="50"
        class="text-x-quiz-primary"
      />
      <p class="text-sm text-x-text-subtitle">در حال اعتبار سنجی و ورود به آزمون</p>
    </div>
  </div>

  <!-- Terms gate -->
  <div
    v-if="!acceptTerms"
    class="absolute inset-0 z-10 bg-x-quiz-surface flex flex-col"
  >
    <div class="w-full py-3 sticky top-0 bg-x-quiz-surface z-10">
      <div class="flex items-center justify-between gap-3 p-3">
        <UButton
          icon="solar:arrow-right-linear"
          to="/test/active"
          variant="subtle"
          color="x-quiz-primary"
          aria-label="انصراف از آزمون"
          :ui="{ base: 'size-9 rounded-full' }"
        />
        <p class="text-center font-liana! text-2xl text-x-text-title">شروع آزمون</p>
        <UButton
          size="sm"
          to="/test/active"
          variant="subtle"
          color="x-quiz-primary"
          label="انصراف"
        />
      </div>
      <p class="text-center text-sm px-3 text-x-text-subtitle">
        {{ testStore.state.questions?.title }}
      </p>
    </div>

    <div class="flex-1 relative grid place-items-center">
      <div class="w-10/12 p-5 max-h-[55dvh] overflow-y-auto custom-scroll">
        <strong class="text-sm text-x-text-title">قوانین و مقررات</strong>
        <br />
        <br />
        <p
          v-for="p of terms"
          :key="p"
          class="text-sm font-bold not-last:mb-3 text-x-text-body"
        >
          {{ p }}
        </p>
      </div>
      <div class="w-10/12 pb-7 mt-5">
        <UButton
          block
          color="x-quiz-primary"
          label="پذیرش قوانین و شروع آزمون"
          :ui="{ base: 'rounded-full px-3 h-12' }"
          @click="acceptTermsHandler"
        />
      </div>
    </div>
  </div>

  <!-- Exam -->
  <div
    v-if="acceptTerms && testStore.state.questions !== null"
    class="h-dvh relative bg-x-quiz-surface"
  >
    <!-- decorative glow -->
    <div
      class="w-69 h-69 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-radial from-x-quiz-primary/30 to-x-quiz-primary-soft/10 blur-3xl pointer-events-none"
      aria-hidden="true"
    ></div>

    <div class="relative z-6 min-h-dvh flex flex-col">
      <!-- Header -->
      <div
        class="sticky top-0 z-10 bg-x-quiz-surface/90 backdrop-blur-sm border-b border-x-quiz-question-border/60"
      >
        <div class="flex items-center gap-3 px-4 py-3">
          <UButton
            icon="solar:arrow-right-linear"
            to="/test/active"
            variant="soft"
            color="x-quiz-primary"
            aria-label="بازگشت به فهرست آزمون‌ها"
            :ui="{ base: 'size-10 rounded-full' }"
          />
          <h1 class="font-bold text-sm text-x-text-title truncate">
            {{ testStore.state.questions?.title }}
          </h1>
        </div>
      </div>

      <!-- Counter + total-exam timer -->
      <div class="flex items-center justify-between gap-4 px-4 pt-5">
        <div>
          <p class="text-sm text-x-text-subtitle">سوال</p>
          <p class="ltr flex items-baseline gap-1" dir="ltr">
            <span class="text-4xl font-extrabold text-x-quiz-accent leading-none">
              {{ faNumber(currentNumber) }}
            </span>
            <span class="text-2xl font-bold text-x-text-title">
              /{{ faNumber(totalQuestions) }}
            </span>
          </p>
        </div>

        <div v-if="hasTotalTime" class="flex shrink-0 flex-col items-center gap-1">
          <div class="relative grid place-items-center size-20">
            <svg
              viewBox="0 0 64 64"
              class="size-20 -rotate-90"
              dir="ltr"
              aria-hidden="true"
            >
              <circle
                cx="32"
                cy="32"
                :r="RING_RADIUS"
                fill="none"
                stroke-width="5"
                class="stroke-x-quiz-question"
              />
              <circle
                cx="32"
                cy="32"
                :r="RING_RADIUS"
                fill="none"
                stroke-width="5"
                stroke-linecap="round"
                class="stroke-x-quiz-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="ringDashoffset"
              />
            </svg>
            <span
              class="absolute text-sm font-bold tabular-nums text-x-text-title"
              :class="isTimeUp ? 'text-x-quiz-accent-strong' : ''"
              role="timer"
              :aria-label="timerLabel"
              aria-live="off"
              >{{ timerText }}</span
            >
          </div>
          <p class="text-[10px] text-x-text-muted">
            از {{ faNumber(examMinutes) }} دقیقه
          </p>
        </div>
      </div>

      <!-- Linear progress -->
      <div class="px-4 pt-4">
        <div
          role="progressbar"
          :aria-valuenow="currentNumber"
          :aria-valuemin="1"
          :aria-valuemax="totalQuestions"
          aria-label="پیشرفت آزمون"
          class="h-2 w-full overflow-hidden rounded-full bg-x-quiz-question"
        >
          <div
            class="h-full rounded-full bg-x-quiz-primary transition-[width] duration-300 ease-out"
            :style="{ width: `${progressValue}%` }"
          ></div>
        </div>
      </div>

      <!-- Question -->
      <div class="flex-1 px-4 pt-6 pb-40">
        <div
          class="relative overflow-hidden rounded-3xl border border-x-quiz-question-border bg-x-quiz-question p-5"
        >
          <!-- faint decorative shapes -->
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <div
              class="absolute -top-6 -start-6 size-28 rounded-full border-2 border-x-quiz-accent/20"
            ></div>
            <div
              class="absolute -bottom-8 -end-8 size-32 rounded-full bg-x-quiz-accent/10"
            ></div>
            <div
              class="absolute top-1/2 -end-4 size-20 rotate-12 rounded-2xl border-2 border-x-quiz-accent/15"
            ></div>
          </div>

          <p class="relative text-base leading-8 font-bold text-x-text-body">
            {{ questions?.at(currentQuestion)?.text }}
          </p>
        </div>

        <!-- Options -->
        <div
          class="grid gap-2.5 mt-5"
          :class="currentOptions.length <= 2 ? 'mt-8' : ''"
          role="radiogroup"
          aria-label="گزینه‌های پاسخ"
        >
          <div
            v-for="(op, index) of currentOptions"
            :key="op.optionId"
            class="rounded-2xl border transition-colors duration-150"
            :class="
              !isDiscTest && selectedOptionId === op.optionId
                ? 'bg-x-quiz-selected border-x-quiz-primary'
                : 'bg-x-quiz-option border-transparent'
            "
          >
            <button
              v-if="!isDiscTest"
              type="button"
              role="radio"
              :aria-checked="selectedOptionId === op.optionId"
              class="flex w-full items-center gap-3 px-3 py-3.5 min-h-14 text-start cursor-pointer rounded-2xl"
              @click="selectAnswer(currentQuestionId, op.optionId)"
            >
              <span
                class="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-bold text-x-text-subtitle shadow-sm"
                aria-hidden="true"
                >{{ optionLetter(index) }}</span
              >
              <span class="text-sm text-x-text-body">{{ op.text }}</span>
            </button>

            <div v-else class="flex items-center gap-3 px-3 pt-3.5">
              <span
                class="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-bold text-x-text-subtitle shadow-sm"
                aria-hidden="true"
                >{{ optionLetter(index) }}</span
              >
              <p class="text-sm text-x-text-body">{{ op.text }}</p>
            </div>

            <!-- For DISC Test Options -->
            <div v-if="isDiscTest" class="text-xs grid grid-cols-2 gap-2 p-3 pt-2">
              <!-- دکمه کمترین (Least) -->
              <button
                type="button"
                :aria-pressed="leastOptionId === op.optionId"
                :class="{
                  'bg-red-500! text-white! font-bold shadow-md':
                    leastOptionId === op.optionId,
                  'bg-white hover:bg-white text-x-text-title':
                    leastOptionId !== op.optionId,
                  'opacity-40 pointer-events-none': mostOptionId === op.optionId,
                }"
                class="relative flex items-center transition justify-center h-11 border border-neutral-500/10 rounded-2xl cursor-pointer"
                @click.stop="
                  selectDiscAnswer(
                    currentQuestionId,
                    op.optionId,
                    op?.score?.least?.id,
                    'least'
                  )
                "
              >
                {{ op?.score?.least?.label || "کمترین" }}
              </button>

              <!-- دکمه بیشترین (Most) -->
              <button
                type="button"
                :aria-pressed="mostOptionId === op.optionId"
                :class="{
                  'bg-emerald-600! text-white! font-bold shadow-md':
                    mostOptionId === op.optionId,
                  'bg-white hover:bg-white text-x-text-title':
                    mostOptionId !== op.optionId,
                  'opacity-40 pointer-events-none': leastOptionId === op.optionId,
                }"
                class="relative flex items-center transition justify-center h-11 border border-neutral-500/10 rounded-2xl cursor-pointer"
                @click.stop="
                  selectDiscAnswer(
                    currentQuestionId,
                    op.optionId,
                    op?.score?.most?.id,
                    'most'
                  )
                "
              >
                {{ op?.score?.most?.label || "بیشترین" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div
        class="fixed bottom-0 start-0 end-0 z-20 px-4 pt-3 bg-linear-to-t from-x-quiz-surface via-x-quiz-surface to-transparent"
      >
        <div class="exam__safe-bottom flex items-center gap-3">
          <UButton
            icon="solar:arrow-right-linear"
            label="سوال قبلی"
            variant="soft"
            color="x-quiz-primary"
            class="flex-1"
            :disabled="isFirstQuestion"
            :ui="{ base: 'rounded-full h-14 justify-center' }"
            @click="goPrev"
          />

          <UButton
            v-if="!isLastQuestion"
            icon="solar:arrow-left-linear"
            label="سوال بعدی"
            variant="soft"
            color="x-quiz-primary-soft"
            class="flex-1"
            :ui="{ base: 'rounded-full h-14 justify-center' }"
            @click="goNext"
          />

          <UButton
            v-else
            label="دریافت نتیجه آزمون"
            variant="solid"
            color="x-quiz-primary"
            class="flex-1"
            :disabled="isSubmitting || testStore.state.loading.sendAnswer"
            :loading="isSubmitting || testStore.state.loading.sendAnswer"
            :ui="{ base: 'rounded-full h-14 justify-center' }"
            @click="sendResultAndScoring"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Result modal -->
  <UModal
    v-model:open="resultModal"
    :dismissible="false"
    :ui="{
      content: 'w-85 rounded-3xl shadow-none',
      overlay: 'backdrop-blur-md',
      header: 'hidden',
    }"
  >
    <template #content>
      <div class="grid place-items-center px-3 w-full overflow-y-auto">
        <div class="grid place-items-center w-full pb-7">
          <NuxtImg
            src="/images/icons/check-icon.png"
            class="drop-shadow-2xl relative z-50 drop-shadow-green-400"
            width="160px"
            height="160px"
            quality="60"
          />
          <p
            class="text-center font-bold sticky top-0 w-full start-0 py-3 px-2 bg-white text-x-text-subtitle"
          >
            نتیجه آزمون {{ testStore.state.questions?.title }}
          </p>
          <br />
          <strong class="block text-x-text-title">{{ resultData.title }}</strong>
          <p class="text-sm p-1 pb-10 text-x-text-body" v-html="resultData.body"></p>
          <div class="flex gap-3 mt-3 absolute bottom-0 bg-white p-2 w-full">
            <UButton
              variant="solid"
              color="x-quiz-primary"
              block
              label="دانلود نتیجه کامل"
              class="mt-3"
              icon="solar:cloud-download-linear"
              download="test-result.pdf"
              size="sm"
              :ui="{ base: 'h-10 rounded-full' }"
            />
            <UButton
              variant="solid"
              color="x-secondary"
              size="sm"
              block
              to="/test/done"
              label="بازگشت به صفحه نتایج"
              class="mt-3"
              :ui="{ base: 'h-10 rounded-full' }"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped lang="scss">
.exam__safe-bottom {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
}
</style>
