<script setup lang="ts">
import { faNumber } from "~/utils/fa";

const testStore = useTest();

const LIMIT = 30;

const isLoading = computed(() => testStore.state.loading.getStore);

const hasError = computed(() => !isLoading.value && Boolean(testStore.state.error));

const hasTests = computed(() => testStore.state.store.length > 0);

const pagination = computed(() => testStore.state.storePagination);
const currentPage = computed(() => Number(pagination.value.currentPage ?? 1));
const totalPages = computed(() => Number(pagination.value.totalPages ?? 1));
const canPaginate = computed(() => totalPages.value > 1);

const loadTests = async () => {
  await testStore.getStore({ limit: LIMIT });
};

const goToPage = async (action: "next" | "prev") => {
  if (action === "next" && !pagination.value.hasNext) return;
  if (action === "prev" && !pagination.value.hasPrev) return;

  await testStore.getStore({
    limit: LIMIT,
    page: action === "next" ? currentPage.value + 1 : currentPage.value - 1,
  });
};

onMounted(loadTests);
</script>

<template>
  <TestTabItems />
  <div class="grid gap-y-4 mt-2 w-11/12 mx-auto">
    <h1 class="my-1 text-sm inline-block font-bold text-x-text-title">آزمون‌ها</h1>

    <!-- Loading -->
    <div v-if="isLoading" aria-busy="true">
      <TestListSkeleton shape="tile" label="در حال دریافت آزمون‌ها" />
    </div>

    <!-- Error -->
    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="testStore.state.error ?? ''"
      action-label="تلاش دوباره"
      @action="loadTests"
    />

    <!-- Empty -->
    <UiStateMessage
      v-else-if="!hasTests"
      icon="solar:document-outline"
      title="تا کنون آزمونی منتشر نشده"
      description="به‌زودی اولین آزمون‌ها در این‌جا در دسترس شما قرار می‌گیرند."
    />

    <!-- Success -->
    <ul v-else class="grid gap-3">
      <li
        class="reveal"
        v-for="(test, index) in testStore.state.store"
        :key="test.testId"
        :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
      >
        <TestCard
          :title="test.title"
          :thumbnail="test.image"
          :to="test.testId"
          :options="{
            isFeature: test.isFeatured,
            audience: {
              from: test.targetAudience.minAge,
              to: test.targetAudience.maxAge,
            },
            questionCount: test.questionCount,
          }"
        />
      </li>
    </ul>
  </div>

  <!-- Pagination. In RTL, "previous" points right, so it comes first. -->
  <nav
    v-if="canPaginate && hasTests"
    class="mt-5 flex items-center justify-center gap-4"
    aria-label="صفحه‌بندی آزمون‌ها"
  >
    <UButton
      icon="solar:arrow-right-linear"
      variant="outline"
      color="neutral"
      aria-label="صفحه قبل"
      :disabled="!pagination.hasPrev || isLoading"
      :ui="{ base: 'size-11 rounded-full' }"
      @click="goToPage('prev')"
    />
    <span class="text-sm ltr text-x-text-subtitle">
      {{ faNumber(currentPage) }} / {{ faNumber(totalPages) }}
    </span>
    <UButton
      icon="solar:arrow-left-linear"
      variant="outline"
      color="neutral"
      aria-label="صفحه بعد"
      :disabled="!pagination.hasNext || isLoading"
      :ui="{ base: 'size-11 rounded-full' }"
      @click="goToPage('next')"
    />
  </nav>

  <TestSingle test-id="" />
</template>
