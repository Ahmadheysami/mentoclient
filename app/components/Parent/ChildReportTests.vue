<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";
import { resultCodeText, testTypeLabel } from "~/utils/parent-report";
import type {
  ChildOverviewTestResultDto,
  ChildOverviewTestsDto,
} from "~/types/parent-panel";

/**
 * The tests section of one child's report.
 *
 * The list is a preview of a capped upstream read: `tests.recent` holds at most
 * 50 rows and `tests.completed` is derived from that same window, so the
 * subline says «نتیجه آخر» rather than claiming an all-time total.
 *
 * A result body is deliberately absent here. The list is for scanning; the
 * body, the categories and the AI analysis belong to the sheet that opens from
 * a row, which is also the only place the backend HTML is rendered.
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
      type: testTypeLabel(result.testType),
      date: faDate(result.completedAt),
      resultTitle,
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
 * One colour per type, from the tokens the panel already owns. The class
 * strings are whole literals so Tailwind can see them; a `bg-${type}` would
 * ship an empty stylesheet.
 */
const TYPE_COLORS: Record<string, string> = {
  DISC: "bg-x-parent-500",
  LIKERT: "bg-x-parent-300",
  MBTI: "bg-x-teen-violet-500",
  ENNEAGRAM: "bg-x-kid-sun-500",
};

const DEFAULT_TYPE_COLOR = "bg-x-kid-mint-500";

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
      colorClass:
        TYPE_COLORS[entry.testType.trim().toUpperCase()] ?? DEFAULT_TYPE_COLOR,
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
  <section
    id="report-tests"
    aria-labelledby="report-tests-title"
    class="scroll-mt-20"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="report-tests-title" class="text-sm font-yekan-bold text-x-text-title">
          گزارش آزمون‌ها
        </h2>
        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          <template v-if="showRecentLimit">
            {{ faNumber(tests.completed) }} آزمون در
            {{ faNumber(recentResults.length) }} نتیجهٔ آخر
          </template>
          <template v-else>
            {{ faNumber(tests.completed) }} آزمون کامل‌شده
          </template>
        </p>
      </div>

      <NuxtLink
        :to="testsHref"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        همه آزمون‌ها
      </NuxtLink>
    </div>

    <UiStateMessage
      v-if="tests.completed === 0"
      compact
      icon="solar:clipboard-list-linear"
      title="هنوز آزمونی کامل نشده"
      description="نتیجهٔ اولین آزمون فرزندتان بعد از تکمیل همین‌جا نمایش داده می‌شود."
      class="mt-3"
    />

    <template v-else>
      <div
        v-if="byType.length > 0"
        class="neu-raised-lg mt-3 rounded-3xl bg-white p-4"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xs font-yekan-bold text-x-text-title">ترکیب آزمون‌ها</h3>
          <span class="shrink-0 text-[11px] text-x-text-subtitle">
            {{ faNumber(tests.completed) }} آزمون
          </span>
        </div>

        <div
          v-if="composition.total > 0"
          role="img"
          :aria-label="composition.ariaLabel"
          class="neu-inset mt-3 flex h-3 overflow-hidden rounded-full bg-x-parent-warm-100"
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

        <ul class="mt-3 flex flex-wrap gap-1.5">
          <li
            v-for="entry in composition.entries"
            :key="`legend-${entry.key}`"
            class="inline-flex items-center gap-1.5 rounded-full bg-x-parent-warm-100 px-2.5 py-1 text-[11px] leading-5 text-x-text-subtitle"
          >
            <span
              aria-hidden="true"
              class="size-2 shrink-0 rounded-full"
              :class="entry.colorClass"
            />
            {{ entry.label }} · {{ faNumber(entry.count) }}
          </li>
        </ul>
      </div>

      <div v-if="recentResults.length > 0" class="mt-4">
        <h3 class="text-xs font-yekan-bold text-x-text-title">نتیجه‌های اخیر</h3>

        <ul :id="listId" class="mt-2 grid gap-2">
          <li v-for="row in rows" :key="row.result.id">
            <button
              type="button"
              :aria-label="row.ariaLabel"
              class="neu-raised flex min-h-14 w-full items-start gap-3 rounded-3xl bg-white p-3 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
              @click="emit('open', row.result)"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
                aria-hidden="true"
              >
                <UIcon name="solar:clipboard-check-linear" size="20" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="min-w-0 truncate text-sm font-yekan-bold text-x-text-title">
                    {{ row.title }}
                  </span>
                  <span
                    class="shrink-0 rounded-full bg-x-parent-50 px-2 py-0.5 text-[10px] font-yekan-bold text-x-parent-700"
                  >
                    {{ row.type }}
                  </span>
                </span>

                <span
                  v-if="row.resultTitle"
                  class="mt-0.5 block truncate text-xs text-x-text-subtitle"
                >
                  {{ row.resultTitle }}
                </span>

                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-x-text-subtitle">
                  <time
                    v-if="row.date"
                    :datetime="row.result.completedAt"
                    class="tabular-nums"
                  >
                    {{ row.date }}
                  </time>

                  <span
                    v-if="row.code"
                    class="max-w-full break-all rounded-full bg-x-parent-warm-100 px-2 py-0.5"
                  >
                    کد {{ row.code }}
                  </span>

                  <span
                    v-if="row.ai"
                    class="rounded-full bg-x-kid-sun-100 px-2 py-0.5 font-yekan-bold text-x-kid-900"
                  >
                    تحلیل هوش مصنوعی
                  </span>
                </span>
              </span>

              <UIcon
                name="solar:alt-arrow-left-linear"
                size="18"
                class="mt-1 shrink-0 text-x-parent-300"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>

        <button
          v-if="hasMore"
          type="button"
          :aria-expanded="expanded"
          :aria-controls="listId"
          class="neu-control mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-yekan-bold text-x-parent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          @click="expanded = !expanded"
        >
          {{ expanded ? "نمایش کمتر" : "نمایش همه" }}
          <UIcon
            name="solar:alt-arrow-down-linear"
            size="16"
            aria-hidden="true"
            class="transition-transform duration-200 ease-soft motion-reduce:transition-none"
            :class="expanded ? 'rotate-180' : ''"
          />
        </button>
      </div>

      <p
        v-else
        class="mt-4 rounded-2xl bg-x-parent-warm-50 px-3 py-3 text-xs leading-6 text-x-text-subtitle"
      >
        نتیجه‌های اخیر در این گزارش موجود نیست؛ از صفحهٔ آزمون‌ها می‌توانید سابقهٔ آزمون‌ها را ببینید.
      </p>
    </template>
  </section>
</template>
