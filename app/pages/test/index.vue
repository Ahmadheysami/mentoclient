<script setup lang="ts">
const testStore = useTest(),
  limit = ref<number>(30),
  pagination = testStore.state.storePagination,
  paginationHandler = async (action: "next" | "prev") => {
    if (action === "next" && !testStore.state.storePagination?.hasNext) return;
    // if (action === "prev" && !pagination?.hasPrev) return;
    
    
    await testStore.getStore({
      limit: limit.value,
      page:
        action === "next"
          ? Number(testStore.state.storePagination?.currentPage) + 1
          : Number(testStore.state.storePagination?.currentPage) - 1,
    });
  };

onMounted(async () => {
  await testStore.getStore({ limit: limit.value });
});
</script>

<template>
  <TestTabItems />
  <div class="grid gap-y-4 mt-2 w-11/12 mx-auto">
    <p class="text-sm my-1 inline-block font-bold">آزمون ها</p>
    <div>
      <div
        class="h-[50dvh] grid place-items-center"
        v-if="testStore.state.loading?.getStore"
      >
        <div>
          <UIcon name="line-md:loading-twotone-loop" size="40" />
        </div>
      </div>
      <div
        class="h-[50dvh] grid place-items-center"
        v-if="
          !testStore.state.loading?.getStore &&
          (testStore.state.store?.length as number) <= 0
        "
      >
        <div class="">
          <AppLogo size="lg" type="medium" to="/" />
          <p class="mt-4">تا کنون آزمونی منتشر نشده</p>
        </div>
      </div>
      <div class="grid gap-3">
        <TestCard
          v-if="!testStore.state.loading?.getStore"
          v-for="test of testStore.state.store"
          :key="test.testId"
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
      </div>
    </div>
  </div>

  <div
    class="flex items-center justify-center mt-5"
    v-if="testStore.state.loading"
  >
    <!-- Pagination -->
    <UButton
      variant="link"
      color="x-secondary"
      v-if="testStore.state.storePagination.hasNext"
      :class="{ invisible: !testStore.state.storePagination.hasNext }"
      @click="paginationHandler('next')"
      >
      <UIcon name="solar:arrow-right-linear" size="30" />
    </UButton>
    <span class="text-sm ltr" v-show="testStore.state.storePagination.hasNext || testStore.state.storePagination.hasPrev">
      {{ testStore.state.storePagination.currentPage }} /
      {{ testStore.state.storePagination.totalPages }}
    </span>
    <!-- Pagination -->
    <UButton
    variant="link"
    color="x-secondary"
      :disabled="!testStore.state.storePagination.hasPrev"
      :class="{ invisible: !testStore.state.storePagination.hasPrev }"
      @click="paginationHandler('prev')"
    >
      <UIcon name="solar:arrow-left-linear" size="30" />
    </UButton>
  </div>
  <TestSingle test-id="" />
</template>

<style lang="scss"></style>
