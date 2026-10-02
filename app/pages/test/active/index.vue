<script setup lang="ts">
const testStore = useTest();

/** Newest purchase first, so the most recent test is always on top. */
const activeTests = computed(() =>
  testStore.state.myTests ? [...testStore.state.myTests].reverse() : [],
);

const isLoading = computed(() => testStore.state.loading?.getMyTests === true);

const hasError = computed(() => !isLoading.value && Boolean(testStore.state.error));

const loadActiveTests = async () => {
  await testStore.getMyTests("available");
};

onMounted(loadActiveTests);
</script>

<template>
  <TestTabItems />
  <div class="w-11/12 mx-auto">
    <p class="text-sm mt-2 mb-4 inline-block font-bold text-x-text-title">
      آزمون‌های فعال شما
    </p>

    <div class="space-y-3">
      <!-- Loading -->
      <div v-if="isLoading" aria-busy="true">
        <TestListSkeleton label="در حال دریافت آزمون‌های فعال شما" />
      </div>

      <!-- Error -->
      <UiStateMessage
        v-else-if="hasError"
        icon="solar:link-broken-linear"
        :title="testStore.state.error ?? ''"
        action-label="تلاش دوباره"
        @action="loadActiveTests"
      />

      <!-- Empty -->
      <UiStateMessage
        v-else-if="activeTests.length === 0"
        icon="solar:document-outline"
        title="هنوز آزمون فعالی ندارید"
        description="هر آزمونی را که تهیه کنید، همین‌جا در دسترس می‌ماند."
        action-label="مشاهده فروشگاه آزمون‌ها"
        action-to="/test"
      />

      <!-- Success -->
      <ul v-else class="space-y-3">
        <li
          class="reveal"
          v-for="(item, index) in activeTests"
          :key="item.id"
          :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
        >
          <TestActiveCard :item="item" />
        </li>
      </ul>
    </div>
  </div>
</template>
