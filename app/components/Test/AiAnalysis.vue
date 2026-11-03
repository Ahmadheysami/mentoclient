<script setup lang="ts">
import comma from "comma-number";
import { renderAiMarkdown } from "~/utils/markdown";

/**
 * The only two facts this surface needs from a result.
 *
 * Deliberately narrower than `TestResult`: the parent panel's result rows are a
 * different shape and have no business inventing the rest of a `TestResult` to
 * borrow this component. Any object carrying an id and an analysis qualifies.
 */
interface AiAnalysisTarget {
  id: string;
  aiAnalysis?: string | null;
}

/**
 * The one AI-analysis surface, shared by every single-result screen.
 *
 * The result object is the source of truth for whether an analysis already
 * exists (`result.aiAnalysis`). The test configuration — fetched by the page
 * with the existing `test.getSingleTest` action — decides whether the feature
 * is available at all (`analysisAiEnabled`) and what one analysis costs
 * (`analysisAiPrice`). When the backend says the feature is off, this component
 * renders nothing: no heading, no button, no price.
 *
 * The analysis itself is Markdown written by a model, so it is rendered through
 * `renderAiMarkdown` (`~/utils/markdown`) and never inserted raw.
 */
const props = withDefaults(
  defineProps<{
    result: AiAnalysisTarget;
    /** `analysisAiEnabled` from the test configuration. */
    enabled: boolean;
    /** `analysisAiPrice` fallback, when the response has not supplied one yet. */
    price?: number;
    /** Child sessions read the child cookie; adults omit it. */
    scope?: string;
    /** Match the surrounding screen's corner radius. */
    radius?: "3xl" | "xl";
  }>(),
  { price: 0, radius: "3xl", scope: undefined },
);

const emit = defineEmits<{
  /** A freshly generated analysis, for callers that must remember it (the
   *  parent report sheet can be closed and reopened on the same result). */
  analyzed: [analysis: string];
}>();

const testStore = useTest();
const toast = useToast();

const initialAnalysis =
  typeof props.result.aiAnalysis === "string" ? props.result.aiAnalysis : "";
const analysis = ref<string>(initialAnalysis);
const cached = ref(false);
const lastPrice = ref<number | null>(null);
const error = ref<string | null>(null);
const confirmRefreshOpen = ref(false);

const hasAnalysis = computed(() => analysis.value.trim().length > 0);
/**
 * The price the reader is shown, in **تومان**.
 *
 * The backend quotes `analysisAiPrice` in **ریال** (both on the test
 * configuration and in `meta.analysisAiPrice` of the analysis response), while
 * this app prices everything for its readers in تومان — 1 تومان = 10 ریال. The
 * conversion happens here, at the display boundary, so the raw figure keeps its
 * wire unit everywhere else.
 */
const displayPrice = computed(() => {
  const rial = Number(lastPrice.value ?? props.price ?? 0);

  return Number.isFinite(rial) && rial > 0 ? Math.round(rial / 10) : 0;
});
const renderedAnalysis = computed(() => renderAiMarkdown(analysis.value));
const surfaceRadius = computed(() =>
  props.radius === "xl" ? "rounded-xl" : "rounded-3xl",
);
const controlRadius = computed(() =>
  props.radius === "xl" ? "rounded-xl" : "rounded-full",
);

/** A different result on the same screen replaces everything shown here. */
watch(
  () => props.result.id,
  () => {
    analysis.value =
      typeof props.result.aiAnalysis === "string" ? props.result.aiAnalysis : "";
    cached.value = false;
    lastPrice.value = null;
    error.value = null;
  },
);

/** The store writes a fresh analysis back onto the cached result. */
watch(
  () => props.result.aiAnalysis,
  (value) => {
    if (typeof value === "string" && value.trim()) analysis.value = value;
  },
);

async function analyze(refresh: boolean) {
  if (testStore.state.loading.analyzeAi) return;

  error.value = null;

  const response = await testStore.analyzeResultWithAi(
    props.result.id,
    refresh,
    props.scope,
  );

  if (!response?.success) {
    error.value =
      response?.message ||
      "تحلیل با هوش مصنوعی انجام نشد. کمی بعد دوباره تلاش کنید.";
    return;
  }

  analysis.value = response.analysis ?? analysis.value;
  emit("analyzed", analysis.value);
  cached.value = Boolean(response.cached);
  lastPrice.value =
    typeof response.meta?.analysisAiPrice === "number"
      ? response.meta.analysisAiPrice
      : null;

  toast.add({
    title: refresh ? "تحلیل جدید آماده شد" : "تحلیل آماده شد",
    description: response.cached
      ? "تحلیل ذخیره‌شده این نتیجه نمایش داده می‌شود."
      : "تحلیل هوش مصنوعی این نتیجه با موفقیت تولید شد.",
    color: "success",
    icon: "solar:check-circle-bold",
  });
}

function requestRefresh() {
  confirmRefreshOpen.value = true;
}

function closeConfirm() {
  confirmRefreshOpen.value = false;
}

async function confirmRefresh() {
  confirmRefreshOpen.value = false;
  await analyze(true);
}
</script>

<template>
  <section
    v-if="enabled || hasAnalysis"
    class="bg-white p-5"
    :class="surfaceRadius"
    aria-labelledby="ai-analysis-heading"
  >
    <header class="flex items-start gap-3">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-x-primary-100 to-x-secondary-100 text-x-primary-800"
        aria-hidden="true"
      >
        <UIcon name="solar:magic-stick-3-bold-duotone" size="24" />
      </span>

      <div class="min-w-0 flex-1">
        <h2
          id="ai-analysis-heading"
          class="text-sm font-bold text-x-text-title"
        >
          تحلیل نتیجه با هوش مصنوعی
        </h2>
        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          یک خوانش شخصی‌سازی‌شده از پاسخ‌های شما، فراتر از تفسیر کوتاه آزمون.
        </p>
      </div>
    </header>

    <!-- Generating -->
    <div v-if="testStore.state.loading.analyzeAi" class="mt-4 space-y-2.5" aria-busy="true">
      <span class="sr-only">در حال تولید تحلیل هوش مصنوعی</span>
      <div class="flex items-center gap-2 text-xs text-x-text-subtitle">
        <UIcon name="line-md:loading-twotone-loop" size="18" aria-hidden="true" />
        در حال تحلیل پاسخ‌های شما…
      </div>
      <USkeleton class="h-3.5 w-11/12 rounded-lg bg-x-primary-50" />
      <USkeleton class="h-3.5 w-full rounded-lg bg-x-primary-50" />
      <USkeleton class="h-3.5 w-4/5 rounded-lg bg-x-primary-50" />
    </div>

    <!-- Failed -->
    <UAlert
      v-else-if="error"
      class="mt-4"
      variant="soft"
      color="error"
      :title="error"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="analyze(false)"
        />
      </template>
    </UAlert>

    <!-- Existing analysis -->
    <template v-else-if="hasAnalysis">
      <div
        class="ai-markdown content mt-4 rounded-2xl bg-x-primary-content-100/60 p-4"
        v-html="renderedAnalysis"
      />

      <div
        v-if="enabled"
        class="mt-4 flex flex-wrap items-center justify-between gap-3"
      >
        <p v-if="displayPrice > 0" class="text-xs text-x-text-subtitle">
          هزینه تحلیل مجدد:
          <span class="font-bold text-x-text-title">
            {{ comma(displayPrice) }}
          </span>
          تومان
        </p>

        <UButton
          color="x-primary"
          variant="soft"
          icon="solar:refresh-circle-linear"
          label="تحلیل مجدد با هوش مصنوعی"
          :ui="{ base: `h-10 px-4 ${controlRadius}` }"
          @click="requestRefresh"
        />
      </div>

      <p v-if="cached" class="mt-2 text-[11px] leading-5 text-x-text-muted">
        این تحلیل از نتیجه ذخیره‌شده قبلی نمایش داده می‌شود.
      </p>
    </template>

    <!-- No analysis yet -- and the feature is offered for this test. -->
    <div v-else-if="enabled" class="mt-4">
      <UButton
        block
        color="x-primary"
        variant="solid"
        icon="solar:magic-stick-3-linear"
        label="تحلیل نتیجه با هوش مصنوعی"
        :ui="{ base: `h-11 ${controlRadius} bg-x-primary-600! hover:bg-x-primary-700!` }"
        @click="analyze(false)"
      />
      <p
        v-if="displayPrice > 0"
        class="mt-2 text-center text-xs leading-6 text-x-text-subtitle"
      >
        هزینه این تحلیل
        <span class="font-bold text-x-text-title">{{ comma(displayPrice) }}</span>
        تومان است و از کیف پول شما کسر می‌شود.
      </p>
      <p v-else class="mt-2 text-center text-xs leading-6 text-x-text-subtitle">
        تحلیل با هوش مصنوعی برای این آزمون فعال است.
      </p>
    </div>
  </section>

  <!-- Paid re-analysis needs an explicit confirmation. -->
  <UModal
    v-if="enabled"
    v-model:open="confirmRefreshOpen"
    :ui="{
      content: `w-86 ${surfaceRadius} shadow-none`,
      header: 'hidden',
      footer: 'hidden',
      overlay: 'backdrop-blur-sm',
    }"
  >
    <template #content>
      <div class="space-y-4 p-5 text-center">
        <span
          class="mx-auto grid size-16 place-items-center rounded-full bg-x-primary-100 text-x-primary-800"
          aria-hidden="true"
        >
          <UIcon name="solar:refresh-circle-bold-duotone" size="34" />
        </span>

        <p class="text-sm font-bold text-x-text-title">تحلیل مجدد نتیجه</p>
        <p class="text-xs leading-6 text-x-text-subtitle">
          تحلیل قبلی با تحلیل تازه جایگزین می‌شود و هزینه آن دوباره از کیف پول
          شما کسر خواهد شد.
        </p>

        <p v-if="displayPrice > 0" class="text-sm">
          هزینه:
          <span class="font-bold text-x-text-title">{{ comma(displayPrice) }}</span>
          تومان
        </p>

        <div class="flex gap-2 pt-1">
          <UButton
            block
            color="neutral"
            variant="soft"
            label="انصراف"
            :ui="{ base: `h-11 ${controlRadius}` }"
            @click="closeConfirm"
          />
          <UButton
            block
            color="x-primary"
            variant="solid"
            label="تایید و تحلیل مجدد"
            :ui="{ base: `h-11 ${controlRadius} bg-x-primary-600! hover:bg-x-primary-700!` }"
            @click="confirmRefresh"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
