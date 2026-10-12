<script setup lang="ts">
/**
 * All assigned exams, done + to-do.
 *
 * To-do is the STARTABLE subset (`availableTests` — expiring and used-up
 * filtered out); the used-up and expired assets in the raw list get their own
 * disabled group with honest chips, and «انجام‌شده» exams are one more group.
 * Each group is a headed section so the page scans as three lists, not one.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "آزمون‌ها" });

const childPanel = useChildPanel();

onMounted(() => {
  void childPanel.loadTests();
});

const isLoading = computed(
  () => childPanel.state.loading.available || childPanel.state.loading.consumed,
);

const hasError = computed(
  () =>
    !isLoading.value &&
    (childPanel.state.error.available !== null ||
      childPanel.state.error.consumed !== null),
);

/** Assigned but no longer playable — used up or past the deadline. */
const closedOut = computed(() =>
  childPanel.state.available.filter(
    (asset) => !childPanel.availableTests.includes(asset),
  ),
);

async function reload(): Promise<void> {
  await childPanel.loadTests(true);
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <ChildSectionHeader
      :title="childPanel.variant === 'child' ? 'فعالیت‌ها' : 'آزمون‌ها'"
    />

    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton
        v-for="row in 2"
        :key="row"
        class="h-24 bg-white"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      />
    </div>

    <UAlert
      v-else-if="hasError"
      class="mt-5"
      variant="soft"
      color="error"
      :title="childPanel.state.error.available ?? childPanel.state.error.consumed ?? ''"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="reload"
        />
      </template>
    </UAlert>

    <template v-else>
      <section v-if="childPanel.availableTests.length > 0" class="mt-6">
        <ChildSectionHeader
          :title="childPanel.variant === 'child' ? 'ماجراهای تازه' : 'آمادهٔ انجام'"
        />
        <ul class="mt-3 grid gap-3">
          <li v-for="asset in childPanel.availableTests" :key="asset.id">
            <ChildExamCard :asset="asset" />
          </li>
        </ul>
      </section>

      <section v-if="closedOut.length > 0" class="mt-6">
        <ChildSectionHeader
          :title="childPanel.variant === 'child' ? 'دیگه تموم شدن' : 'پایان‌یافته'"
        />
        <ul class="mt-3 grid gap-3">
          <li v-for="asset in closedOut" :key="asset.id">
            <ChildExamCard :asset="asset" />
          </li>
        </ul>
      </section>

      <section v-if="childPanel.state.consumed.length > 0" class="mt-6">
        <ChildSectionHeader title="انجام‌شده‌ها" />
        <ul class="mt-3 grid gap-3">
          <li v-for="asset in childPanel.state.consumed" :key="asset.id">
            <ChildExamCard :asset="asset" />
          </li>
        </ul>
      </section>

      <UiStateMessage
        v-if="childPanel.state.available.length === 0 && childPanel.state.consumed.length === 0"
        icon="solar:clipboard-list-linear"
        title="هنوز آزمونی برایت نیامده"
        description="وقتی والدت برایت آزمونی انتخاب کند، همین‌جا می‌بینی."
      />

      <UiStateMessage
        v-else-if="childPanel.availableTests.length === 0 && childPanel.state.consumed.length > 0"
        icon="solar:cup-star-linear"
        title="همه آزمون‌ها را انجام دادی"
        description="آفرین! هر آزمون تازه‌ای که والدت اضافه کند اینجا می‌آید."
      />
    </template>
  </div>
</template>
