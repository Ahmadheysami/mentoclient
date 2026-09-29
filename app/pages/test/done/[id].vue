<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";

const route = useRoute(),
  testStore = useTest(),
  resultId = computed(() => String(route.params.id ?? ""));

const isLoading = computed(() => testStore.state.loading?.getTestsDone === true);

const result = computed(
  () =>
    testStore.state.testResults.find((item) => item.id === resultId.value) ?? null,
);

/**
 * Every attempt of the same test, oldest first, so the index doubles as the
 * attempt number. Derived from what the API really returns — no scores.
 */
const attempts = computed(() =>
  testStore.state.testResults
    .filter((item) => item.testId === result.value?.testId)
    .sort(
      (first, second) =>
        new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
    ),
);

/** The other attempts, labelled «تلاش ۱، تلاش ۲، …». */
const previousAttempts = computed(() =>
  attempts.value
    .map((item, index) => ({ item, heading: `تلاش ${faNumber(index + 1)}` }))
    .filter((entry) => entry.item.id !== resultId.value),
);

const hasError = computed(
  () => !isLoading.value && Boolean(testStore.state.error),
);

const loadResults = async () => {
  await testStore.getTestResults();
};

// Only fetch when the store is cold, so navigating from the list feels instant.
onMounted(async () => {
  if (!testStore.state.testResults.length) await loadResults();
});
</script>

<template>
  <div class="w-11/12 mx-auto">
    <!-- Header -->
    <UDashboardToolbar :ui="{ root: 'border-none py-2' }">
      <template #right>
        <UtilBackBtn to="/test/done" />
      </template>
      <template #left>
        <div class="min-w-0">
          <strong class="line-clamp-1 block text-x-text-title text-lg">
            {{ result?.test.title || "نتیجه آزمون" }}
          </strong>
          <time
            v-if="result"
            :datetime="result.createdAt"
            class="block text-xs leading-5 text-x-text-subtitle"
          >
            {{ faDate(result.createdAt) }}
          </time>
        </div>
      </template>
    </UDashboardToolbar>

    <!-- Loading: skeletons shaped like the sections below -->
    <div class="space-y-4" v-if="isLoading" aria-busy="true">
      <span class="sr-only">در حال دریافت نتیجه شما</span>
      <div
        class="grid place-items-center gap-4 rounded-4xl bg-white p-6"
        aria-hidden="true"
      >
        <USkeleton class="size-20 rounded-full bg-x-primary-100" />
        <USkeleton class="h-8 w-40 rounded-2xl bg-x-primary-100" />
        <USkeleton class="h-6 w-28 rounded-full bg-x-primary-100" />
      </div>
      <div class="space-y-3 rounded-3xl bg-white p-5" aria-hidden="true">
        <USkeleton class="h-4 w-24 rounded-lg bg-x-primary-100" />
        <USkeleton class="h-4 w-full rounded-lg bg-x-primary-100" />
        <USkeleton class="h-4 w-11/12 rounded-lg bg-x-primary-100" />
        <USkeleton class="h-4 w-4/5 rounded-lg bg-x-primary-100" />
      </div>
    </div>

    <!-- Error -->
    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="testStore.state.error ?? ''"
      action-label="تلاش دوباره"
      @action="loadResults"
    />

    <!-- Not found -->
    <UiStateMessage
      v-else-if="!result"
      icon="solar:compass-linear"
      title="این نتیجه پیدا نشد"
      description="شاید نتیجه دیگری را دنبال می‌کردید. از فهرست نتایج، مسیر درست را پیدا کنید."
      action-label="مشاهده همه نتایج"
      action-to="/test/done"
    />

    <div v-else class="space-y-4 pb-4">
      <!-- Hero: the outcome, readable within a few seconds -->
      <section
        class="reveal grid place-items-center gap-3 rounded-4xl bg-white p-6 text-center"
      >
        <span
          class="grid size-20 place-items-center rounded-full bg-x-primary-100 text-x-primary-800"
          aria-hidden="true"
        >
          <UIcon name="solar:leaf-bold-duotone" size="40" />
        </span>

        <h1 class="text-2xl font-liana! leading-9 text-x-text-title">
          {{ result.result.title }}
        </h1>

        <p class="text-xs leading-6 text-x-text-subtitle">نتیجه شما در این آزمون</p>

        <span
          class="rounded-full px-3 py-1.5 text-xs font-medium leading-5 bg-linear-to-l from-x-secondary-200 to-x-secondary-100 text-x-secondary-900 ring-1 ring-x-secondary-300/60"
        >
          کد تخصصی: {{ result.result.code }}
        </span>
      </section>

      <!-- Interpretation: plain text, comfortable measure, no v-html -->
      <section class="rounded-3xl bg-white p-5">
        <h2 class="text-sm font-bold text-x-text-title">تفسیر نتیجه</h2>
        <p class="mt-3 whitespace-pre-line text-sm leading-8 text-x-text-body content" v-html="result.result.body">
        </p>
      </section>

      <!-- History: a plain list, hidden when there is nothing before this attempt -->
      <section class="space-y-3" v-if="previousAttempts.length">
        <h2 class="text-sm font-bold text-x-text-title">تلاش‌های پیشین این آزمون</h2>
        <p class="text-xs leading-6 text-x-text-subtitle">
          این آزمون را {{ faNumber(attempts.length) }} بار تکمیل کرده‌اید.
        </p>
        <ul class="space-y-3">
          <li v-for="attempt in previousAttempts" :key="attempt.item.id">
            <TestResultCard :item="attempt.item" :heading="attempt.heading" />
          </li>
        </ul>
      </section>

      <!-- Next step -->
      <section class="space-y-3 pt-2">
        <UButton
          to="/test/done"
          label="مشاهده همه نتایج"
          icon="solar:alt-arrow-left-linear"
          trailing-icon
          block
          variant="solid"
          color="x-primary"
          :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
        />
        <UButton
          to="/test"
          label="یک آزمون دیگر"
          icon="solar:add-circle-linear"
          block
          variant="outline"
          color="neutral"
          :ui="{ base: 'h-11 rounded-full' }"
        />
        <p class="pt-1 text-center text-xs leading-6 text-x-text-subtitle">
          خروجی PDF و تحلیل هوش مصنوعی به‌زودی فعال می‌شود.
        </p>
      </section>
    </div>
  </div>
</template>
