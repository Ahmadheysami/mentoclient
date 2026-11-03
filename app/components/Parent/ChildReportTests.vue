<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";
import { resultCodeText, testTypeLabel } from "~/utils/parent-report";
import type {
  ChildOverviewTestResultDto,
  ChildOverviewTestsDto,
} from "~/types/parent-panel";

/**
 * The tests section of one child's report: the mix of what was taken, then the
 * results themselves.
 *
 * The list is a preview of a capped upstream read: `tests.recent` holds at most
 * 50 rows and `tests.completed` is derived from that same window, so the subline
 * says «نتیجهٔ آخر» rather than claiming an all-time total.
 *
 * ## WHY THE BAR IS ONE HUE IN STEPS
 *
 * Four hues for four test types would make this the most colourful thing on a
 * screen where colour means «something needs attention». One indigo in four
 * steps keeps the mix readable and leaves the accent to the data. The legend
 * repeats each label and count, so the bar is never the only carrier of the
 * numbers.
 *
 * A result body is deliberately absent here. The list is for scanning; the body
 * and the AI analysis belong to the sheet that opens from a row, which is also
 * the only place the backend HTML is rendered.
 */
const props = defineProps<{
  tests: ChildOverviewTestsDto;
  childId: string;
  childName: string;
}>();

const emit = defineEmits<{ open: [result: ChildOverviewTestResultDto] }>();

const expanded = ref(false);
const listId = "child-report-test-results";

const recentResults = computed<ChildOverviewTestResultDto[]>(() =>
  Array.isArray(props.tests.recent)
    ? props.tests.recent.filter(
        (result) => typeof result === "object" && result !== null,
      )
    : [],
);

const byType = computed(() =>
  Array.isArray(props.tests.byType) ? props.tests.byType : [],
);

const childLabel = computed<string>(() =>
  props.childName.trim() || "فرزند شما",
);

const testsHref = computed<string>(() =>
  `/panels/parent/children/${props.childId}/tests`,
);

const visibleResults = computed<ChildOverviewTestResultDto[]>(() =>
  expanded.value ? recentResults.value : recentResults.value.slice(0, 5),
);

const rows = computed(() =>
  visibleResults.value.map((result) => {
    const rawTitle = typeof result.title === "string"
      ? result.title.trim()
      : "";
    const resultTitle = typeof result.result?.title === "string"
      ? result.result.title.trim()
      : "";

    return {
      result,
      title: rawTitle || "آزمون",
      resultTitle,
      type: testTypeLabel(result.testType),
      date: faDate(result.completedAt),
      code: resultCodeText(result.result?.code),
      ai:
        typeof result.aiAnalysis === "string" &&
        result.aiAnalysis.trim().length > 0,
      ariaLabel: `دیدن نتیجه ${rawTitle || "آزمون"} برای ${childLabel.value}`,
    };
  }),
);

const hasMore = computed<boolean>(() => recentResults.value.length > 5);
const showRecentLimit = computed<boolean>(
  () => recentResults.value.length >= 50,
);

/**
 * One hue, four steps, in order. The classes are whole literals so Tailwind can
 * see them; a `bg-x-parent-500/${n}` would ship an empty stylesheet.
 */
const STEP_TONES = [
  "bg-x-parent-500",
  "bg-x-parent-500/70",
  "bg-x-parent-500/45",
  "bg-x-parent-300",
] as const;

const composition = computed(() => {
  const entries = byType.value
    .filter(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.testType === "string" &&
        typeof entry.count === "number" &&
        Number.isFinite(entry.count) &&
        entry.count > 0,
    )
    .map((entry, index) => ({
      key: `${entry.testType}-${index}`,
      label: testTypeLabel(entry.testType),
      count: entry.count,
      colorClass: STEP_TONES[index % STEP_TONES.length] ?? STEP_TONES[0],
    }));

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  return {
    entries: entries.map((entry) => ({
      ...entry,
      width: total > 0 ? `${(entry.count / total) * 100}%` : "0%",
    })),
    total,
    ariaLabel:
      entries.length > 0
        ? `ترکیب آزمون‌ها: ${entries
            .map((entry) => `${entry.label} ${faNumber(entry.count)}`)
            .join("، ")}`
        : "ترکیب آزمون‌ها در دسترس نیست",
  };
});
</script>

<template>
  <section id="report-tests" aria-labelledby="report-tests-title" class="scroll-mt-20">
    <div class="flex items-baseline justify-between gap-3 px-1">
      <h2 id="report-tests-title" class="min-w-0 font-yekan-bold text-sm text-x-text-title">
        آزمون‌ها
      </h2>

      <NuxtLink
        :to="testsHref"
        class="inline-flex min-h-11 shrink-0 items-center text-xs text-x-parent-700 underline decoration-x-parent-200 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        همهٔ آزمون‌ها
      </NuxtLink>
    </div>

    <div
      v-if="tests.completed === 0"
      class="mt-2 rounded-2xl border border-dashed border-x-parent-200 px-4 py-6 text-center"
    >
      <p class="text-sm font-yekan-bold text-x-text-title">
        هنوز آزمونی کامل نشده
      </p>
      <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
        نتیجهٔ اولین آزمون فرزندتان بعد از تکمیل همین‌جا نمایش داده می‌شود.
      </p>
      <NuxtLink
        :to="testsHref"
        class="mt-2 inline-flex min-h-11 items-center text-xs font-yekan-bold text-x-parent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        تخصیص آزمون
      </NuxtLink>
    </div>

    <template v-else>
      <div class="mt-2 rounded-2xl border border-x-parent-warm-100 bg-white p-4">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="font-yekan-bold text-sm text-x-text-title">ترکیب آزمون‌ها</h3>
          <span class="shrink-0 text-xs text-x-text-subtitle tabular-nums">
            <template v-if="showRecentLimit">
              {{ faNumber(tests.completed) }} آزمون در {{ faNumber(recentResults.length) }} نتیجهٔ آخر
            </template>
            <template v-else>
              {{ faNumber(tests.completed) }} آزمون
            </template>
          </span>
        </div>

        <div
          v-if="composition.total > 0"
          role="img"
          :aria-label="composition.ariaLabel"
          class="mt-3 flex h-2 overflow-hidden rounded-full bg-x-parent-warm-100"
        >
          <span
            v-for="entry in composition.entries"
            :key="entry.key"
            aria-hidden="true"
            class="block h-full"
            :class="entry.colorClass"
            :style="{ width: entry.width }"
          />
        </div>
        <p v-else class="mt-3 text-xs leading-6 text-x-text-subtitle">
          ترکیب آزمون‌ها در دسترس نیست.
        </p>

        <ul v-if="composition.entries.length > 0" class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          <li
            v-for="entry in composition.entries"
            :key="`legend-${entry.key}`"
            class="flex items-center gap-1.5 text-xs leading-5 text-x-text-subtitle"
          >
            <span
              aria-hidden="true"
              class="size-1.5 shrink-0 rounded-full"
              :class="entry.colorClass"
            />
            {{ entry.label }}
            <b class="font-yekan-bold text-x-text-title tabular-nums">
              {{ faNumber(entry.count) }}
            </b>
          </li>
        </ul>
      </div>

      <div v-if="recentResults.length > 0" class="mt-3 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white">
        <ul :id="listId" class="divide-y divide-x-parent-warm-100">
          <li v-for="row in rows" :key="row.result.id">
            <button
              type="button"
              :aria-label="row.ariaLabel"
              class="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-150 ease-out active:bg-x-parent-warm-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
              @click="emit('open', row.result)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-yekan-bold text-sm text-x-text-title">
                  {{ row.title }}
                </span>

                <span
                  v-if="row.resultTitle"
                  class="mt-0.5 block truncate text-xs text-x-text-subtitle"
                >
                  {{ row.resultTitle }}
                </span>

                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-x-text-subtitle">
                  <span>{{ row.type }}</span>

                  <template v-if="row.date">
                    <span aria-hidden="true">·</span>
                    <time :datetime="row.result.completedAt" class="tabular-nums">
                      {{ row.date }}
                    </time>
                  </template>

                  <span
                    v-if="row.code"
                    class="max-w-full break-all rounded-md bg-x-parent-warm-100 px-1.5 py-0.5 text-[11px] leading-5"
                  >
                    کد {{ row.code }}
                  </span>

                  <span
                    v-if="row.ai"
                    class="rounded-md bg-x-parent-warm-100 px-1.5 py-0.5 text-[11px] leading-5"
                  >
                    تحلیل هوش مصنوعی
                  </span>
                </span>
              </span>

              <UIcon
                name="solar:alt-arrow-left-linear"
                size="16"
                class="shrink-0 text-x-parent-300"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
      </div>

      <p
        v-else
        class="mt-3 rounded-2xl bg-x-parent-warm-50 px-4 py-3 text-xs leading-6 text-x-text-subtitle"
      >
        نتیجه‌های اخیر در این گزارش موجود نیست؛ از صفحهٔ آزمون‌ها می‌توانید سابقهٔ آزمون‌ها را ببینید.
      </p>

      <button
        v-if="hasMore"
        type="button"
        :aria-expanded="expanded"
        :aria-controls="listId"
        class="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-yekan-bold text-x-parent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        @click="expanded = !expanded"
      >
        {{ expanded ? "نمایش کمتر" : `نمایش همهٔ ${faNumber(recentResults.length)} نتیجه` }}
        <UIcon
          name="solar:alt-arrow-down-linear"
          size="14"
          aria-hidden="true"
          class="transition-transform duration-200 ease-out motion-reduce:transition-none"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>
    </template>
  </section>
</template>
