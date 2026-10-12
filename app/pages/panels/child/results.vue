<script setup lang="ts">
import type { TestResult } from "~/types/test";

/**
 * The child's own exam results — the same read as `/test/done`, scoped to the
 * child session: `?scope=child` makes the proxy read the child cookie
 * (`server/utils/session.ts`).
 *
 * Cards are display-only on purpose: the adult detail page
 * (`/test/done/[id]`) re-reads the results with the PARENT cookie, so sending
 * the child there would show them nothing.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "نتایج" });

const childPanel = useChildPanel();
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
}

/**
 * Several attempts of the same test are one story, not N cards — the same
 * grouping `/test/done` uses: each test appears once with its latest outcome.
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
  }));
});

const loadResults = async () => {
  await testStore.getTestResults(undefined, "child");
};

onMounted(loadResults);
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <ChildSectionHeader
      :title="childPanel.variant === 'child' ? 'نتایج ماجراهای من' : 'نتایج آزمون‌های من'"
    />

    <!-- Loading -->
    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton
        v-for="row in 3"
        :key="row"
        class="h-20 bg-white"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="hasError"
      class="mt-5"
      variant="soft"
      color="error"
      :title="testStore.state.error ?? ''"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="loadResults"
        />
      </template>
    </UAlert>

    <!-- Empty -->
    <UiStateMessage
      v-else-if="groups.length === 0"
      icon="solar:cup-star-linear"
      title="هنوز نتیجه‌ای نداری"
      description="وقتی یک آزمون را تمام کنی، نتیجه‌اش همین‌جا می‌آید."
      action-label="دیدن آزمون‌ها"
      action-to="/panels/child/tests"
    />

    <!-- Success -->
    <ul v-else class="mt-5 grid gap-3">
      <li
        v-for="(group, index) in groups"
        :key="group.testId"
        class="reveal"
        :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
      >
        <ChildResultCard
          :title="group.title"
          :date="group.latest.createdAt"
          :chip-label="group.latest.result.title"
        />
      </li>
    </ul>
  </div>
</template>
