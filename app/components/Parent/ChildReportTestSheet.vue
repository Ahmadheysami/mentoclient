<script setup lang="ts">
import { faDate } from "~/utils/fa";
import { resultCodeText, testTypeLabel } from "~/utils/parent-report";
import type { ChildOverviewTestResultDto } from "~/types/parent-panel";

/**
 * The one place a result's stored content is read.
 *
 * The list above is intentionally shallow; a parent opens this sheet to see
 * what was recorded, so the backend HTML and the AI analysis are rendered only
 * here. The content is server-generated and already sanitized by the backend,
 * and no result id is used to build a public test-result URL: the report is the
 * record, not a link into the child's test flow.
 *
 * ## WHY THE HEADER IS TYPE, NOT A COLOUR FIELD
 *
 * The previous header was a filled indigo block. A full-screen sheet already
 * owns the whole screen, so a coloured band on top only made the first third of
 * the content scroll away before the result started. The facts a parent checks
 * first — test type, date, code — are one grey meta line, and the result's own
 * title is the first thing at reading size.
 *
 * ## WHY `for` SITS BESIDE `body`
 *
 * A stored result carries two interpretations: `body` is the reader's own text
 * (what the child/teen panel renders) and `for` is the parent-facing one. This
 * sheet is the parent's surface, so it shows both — the child's text first, the
 * parent interpretation under its own heading — and never mixes them into one
 * paragraph.
 *
 * The paid AI analysis is offered here because this is where a parent reads a
 * result; `analysisAiEnabled` / `analysisAiPrice` come from the test's own
 * configuration, read with the PARENT cookie — the same read `/test/done/[id]`
 * performs.
 */
const props = defineProps<{
  result: ChildOverviewTestResultDto | null;
  childName: string;
}>();

const emit = defineEmits<{ close: [] }>();

const testStore = useTest();

const isOpen = computed<boolean>(() => props.result !== null);

const childLabel = computed<string>(() =>
  props.childName.trim() || "فرزند شما",
);

const title = computed<string>(() =>
  props.result?.title?.trim() || "نتیجه آزمون",
);

const description = computed<string>(() => `نتیجه ${childLabel.value}`);

const type = computed<string>(() =>
  testTypeLabel(props.result?.testType),
);

const date = computed<string>(() =>
  props.result ? faDate(props.result.completedAt) : "",
);

const code = computed<string>(() =>
  resultCodeText(props.result?.result?.code),
);

const resultTitle = computed<string>(() =>
  props.result?.result?.title?.trim() || "نتیجه ثبت‌شده",
);

const body = computed<string>(() => {
  const value = props.result?.result?.body;

  return typeof value === "string" ? value : "";
});

/** The parent-facing interpretation (`for` on the stored result). */
const forBody = computed<string>(() => {
  const value = props.result?.result?.for;

  return typeof value === "string" ? value : "";
});

/**
 * What this result's TEST says about the paid analysis. Guarded on `testId`
 * because `singleTest` is shared with the app's test modal: a stale entry for
 * another test must never decide whether this one may be analysed.
 */
const testConfig = computed(() => {
  const config = testStore.state.singleTest;

  return config?.testId === props.result?.testId ? config : null;
});

const analysisEnabled = computed<boolean>(
  () => testConfig.value?.analysisAiEnabled === true,
);

const analysisPrice = computed<number>(() => {
  const price = Number(testConfig.value?.analysisAiPrice ?? 0);

  return Number.isFinite(price) && price > 0 ? price : 0;
});

/** Analyses generated during this visit, keyed by result id — closing and
 *  reopening the sheet must not look like an unpaid-for analysis again. */
const generatedAnalysis = ref<Record<string, string>>({});

const analysisTarget = computed(() => {
  const current = props.result;

  if (!current) return null;

  const stored =
    typeof current.aiAnalysis === "string" ? current.aiAnalysis.trim() : "";

  return {
    id: current.id,
    aiAnalysis: stored || generatedAnalysis.value[current.id] || "",
  };
});

function onAnalyzed(analysis: string) {
  const current = props.result;

  if (current) generatedAnalysis.value[current.id] = analysis;
}

watch(
  () => props.result?.testId,
  async (testId) => {
    if (!testId) return;
    if (testStore.state.singleTest?.testId === testId) return;

    await testStore.getSingleTest(testId);
  },
  { immediate: true },
);

const categories = computed<string[]>(() => {
  const value = props.result?.categories;

  if (!Array.isArray(value)) return [];

  return value.filter(
    (category): category is string =>
      typeof category === "string" && category.trim().length > 0,
  );
});

function onOpenChange(open: boolean) {
  if (!open) emit("close");
}
</script>

<template>
  <UModal
    fullscreen
    :open="isOpen"
    :title="title"
    :description="description"
    :ui="{ content: 'max-w-md mx-auto' }"
    @update:open="onOpenChange"
  >
    <template #body>
      <template v-if="result">
        <p class="text-xs leading-5 text-x-text-subtitle">
          {{ type }}
          <template v-if="date">
            <span aria-hidden="true"> · </span>
            <time :datetime="result.completedAt" class="tabular-nums">{{ date }}</time>
          </template>
          <template v-if="code">
            <span aria-hidden="true"> · </span>
            <span class="break-all">کد {{ code }}</span>
          </template>
        </p>

        <h2 class="mt-1 break-words font-yekan-extra text-xl leading-8 text-x-text-title">
          {{ resultTitle }}
        </h2>

        <ul v-if="categories.length > 0" class="mt-3 flex flex-wrap gap-1.5">
          <li
            v-for="(category, index) in categories"
            :key="`${category}-${index}`"
            class="max-w-full break-words rounded-md bg-x-parent-warm-100 px-2 py-0.5 text-[11px] leading-5 text-x-text-subtitle"
          >
            {{ category }}
          </li>
        </ul>

        <div
          v-if="body"
          class="content mt-4 rounded-2xl border border-x-parent-warm-100 bg-white px-4 py-4 text-sm leading-7"
          v-html="body"
        />
        <p
          v-else
          class="mt-4 rounded-2xl bg-x-parent-warm-50 px-4 py-3 text-xs leading-6 text-x-text-subtitle"
        >
          متن نتیجه ثبت نشده است.
        </p>

        <!-- The parent's own interpretation of the same result (`for`). -->
        <section
          v-if="forBody"
          aria-labelledby="report-result-for-title"
          class="mt-4"
        >
          <h3
            id="report-result-for-title"
            class="px-1 font-yekan-bold text-sm text-x-text-title"
          >
            نتیجه برای والد
          </h3>
          <div
            class="content mt-2 rounded-2xl border border-x-parent-200 bg-x-parent-warm-50 px-4 py-4 text-sm leading-7 text-x-text-body"
            v-html="forBody"
          />
        </section>

        <!--
          Paid AI analysis: the same surface `/test/done/[id]` uses, so the
          generate / re-generate rules (and the price) are identical here.
        -->
        <div v-if="analysisTarget" class="mt-5">
          <TestAiAnalysis
            :result="analysisTarget"
            :enabled="analysisEnabled"
            :price="analysisPrice"
            radius="xl"
            @analyzed="onAnalyzed"
          />
        </div>

        <p class="mt-4 px-1 text-xs leading-6 text-x-text-subtitle">
          این نتیجهٔ ثبت‌شده در پروندهٔ فرزند شماست. برای مشاهدهٔ همهٔ آزمون‌ها به صفحهٔ آزمون‌ها برگردید.
        </p>
      </template>
    </template>

    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        block
        label="بستن"
        class="min-h-11 rounded-full"
        @click="emit('close')"
      />
    </template>
  </UModal>
</template>
