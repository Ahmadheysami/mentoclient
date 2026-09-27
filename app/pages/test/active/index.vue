<script setup lang="ts">
import { faNumber } from "~/utils/fa";

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
      <TestStateMessage
        v-else-if="hasError"
        icon="solar:link-broken-linear"
        :title="testStore.state.error ?? ''"
        action-label="تلاش دوباره"
        @action="loadActiveTests"
      />

      <!-- Empty -->
      <TestStateMessage
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
          <article class="rounded-3xl bg-white p-4">
            <div class="flex items-center gap-3">
              <span
                class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-x-primary-100 text-x-primary-800"
              >
                <NuxtImg
                  v-if="item.test[0]?.image"
                  :src="item.test[0].image"
                  :alt="item.test[0].title"
                  class="size-12 object-cover"
                />
                <UIcon
                  v-else
                  name="solar:document-medicine-linear"
                  size="24"
                  aria-hidden="true"
                />
              </span>

              <div class="min-w-0 flex-1">
                <strong class="block truncate text-x-text-title">
                  {{ item.test[0]?.title }}
                </strong>
                <span class="block text-xs text-x-text-subtitle">
                  {{ faNumber(item.usedCount) }} از {{ faNumber(item.usageLimit) }}
                  استفاده شده
                </span>
              </div>

              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium bg-linear-to-l from-x-primary-200 to-x-primary-100 text-x-primary-900 ring-1 ring-x-primary-300/60"
              >
                <UIcon name="solar:check-circle-linear" size="14" aria-hidden="true" />
                {{ item.status === "available" ? "فعال" : "غیرفعال" }}
              </span>
            </div>

            <UButton
              :to="`/test/active/exam?examId=${item.id}`"
              label="شروع آزمون"
              icon="solar:play-linear"
              block
              variant="solid"
              color="x-primary"
              class="mt-4"
              :ui="{ base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!' }"
            />

            <NuxtLink
              :to="`/test?s=${item.test[0]?.testId}`"
              class="mt-3 block text-center text-xs text-x-primary-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600"
            >
              دیدن جزئیات این آزمون
            </NuxtLink>
          </article>
        </li>
      </ul>
    </div>
  </div>
</template>
