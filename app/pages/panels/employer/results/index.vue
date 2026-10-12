<script setup lang="ts">
import type { TestResult } from "~/types/test";
import { faDate, faNumber } from "~/utils/fa";

definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "نتایج آزمون‌ها",
});

const testStore = useTest();

const isLoading = computed(() => testStore.state.loading.getTestsDone);

const hasError = computed(() => !isLoading.value && Boolean(testStore.state.error));

/** Newest attempt first. */
const results = computed(() =>
  [...testStore.state.testResults].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  ),
);

interface ResultGroup {
  testId: string;
  title: string;
  /** Most recent attempt, i.e. the one worth showing. */
  latest: TestResult;
  attempts: number;
}

/**
 * Several attempts of the same test are one story, not N cards. Each test
 * appears once with its latest outcome; the detail page carries the history.
 */
const groups = computed<ResultGroup[]>(() => {
  const byTest = new Map<string, TestResult[]>();

  for (const item of results.value) {
    const bucket = byTest.get(item.testId);
    bucket ? bucket.push(item) : byTest.set(item.testId, [item]);
  }

  return [...byTest.values()].map((attempts) => ({
    testId: attempts[0]!.testId,
    title: attempts[0]!.test.title || "آزمون",
    latest: attempts[0]!,
    attempts: attempts.length,
  }));
});

const summary = computed(
  () => `${faNumber(results.value.length)} نتیجه از ${faNumber(groups.value.length)} آزمون`,
);

const loadResults = async () => {
  await testStore.getTestResults();
};

onMounted(loadResults);
</script>

<template>
  <div class="w-11/12 mx-auto pt-4 pb-8">
    <h1 class="mt-2 mb-1 text-sm inline-block font-yekan-bold text-gray-900">
      نتایج آزمون‌های شما
    </h1>

    <p
      class="mb-4 text-xs leading-5 text-gray-500"
      v-if="!isLoading && !hasError && groups.length"
    >
      {{ summary }}
    </p>

    <!-- Loading -->
    <div v-if="isLoading" aria-busy="true">
      <TestListSkeleton label="در حال دریافت نتایج شما" />
    </div>

    <!-- Error -->
    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="testStore.state.error ?? ''"
      action-label="تلاش دوباره"
      @action="loadResults"
    />

    <!-- Empty -->
    <UiStateMessage
      v-else-if="groups.length === 0"
      icon="solar:document-outline"
      title="هنوز نتیجه‌ای ثبت شده نیست"
      description="هر آزمونی را که کامل کنید، نتیجه‌اش همین‌جا می‌ماند."
      action-label="دیدن آزمون‌ها"
      action-to="/panels/employer/tests"
    />

    <!-- Success -->
    <ul v-else class="space-y-3">
      <li
        class="reveal"
        v-for="(group, index) in groups"
        :key="group.testId"
        :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
      >
        <NuxtLink
          :to="`/panels/employer/results/${group.latest.id}`"
          class="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-200 transition duration-200 ease-out hover:scale-95 hover:opacity-90 active:scale-95 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <UIcon name="solar:clipboard-check-linear" size="24" />
          </span>

          <span class="min-w-0 flex-1">
            <strong class="block truncate font-yekan-bold text-sm text-gray-900">{{ group.title }}</strong>
            <span class="block text-xs leading-5 text-gray-500">
              <time :datetime="group.latest.createdAt">
                {{ faDate(group.latest.createdAt) }}
              </time>
            </span>
          </span>

          <span
            class="max-w-2/5 shrink-0 truncate rounded-lg px-3 py-1.5 text-center text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
          >
            {{ group.latest.result.title }}
          </span>

          <UIcon
            name="solar:alt-arrow-left-linear"
            size="18"
            aria-hidden="true"
            class="shrink-0 text-x-primary-600"
          />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
