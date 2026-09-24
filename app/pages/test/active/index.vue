<script setup lang="ts">
const testStore = useTest();

const reversedMyTests = computed(() => {
  return testStore.state.myTests ? [...testStore.state.myTests].reverse() : [];
});

onMounted(async () => {
  await testStore.getMyTests('available');
});
</script>

<template>
  <TestTabItems />
  <div class="w-11/12 mx-auto">
    <p class="text-sm mt-2 mb-4 inline-block font-bold">
      تست های خریداری شده و فعال
    </p>
    <div class="space-y-3">
      <div
        class="h-[55dvh] grid place-items-center"
        v-if="testStore.state.loading?.getMyTests"
      >
        <div>
          <UIcon name="line-md:loading-twotone-loop" size="40" />
        </div>
      </div>
      <div
        class="h-[55dvh] grid place-items-center"
        v-if="!testStore.state.loading?.getMyTests && (testStore.state.myTests?.length as number) <= 0"
      >
        <div class="grid place-items-center gap-2">
          <UIcon name="solar:document-outline" size="80" />
          <p class="text-sm">
          آزمون فعال ندارید
        </p>
        </div>
      </div>
      <div v-if="!testStore.state.loading?.getMyTests" class="space-y-4">
        <UCollapsible
          class="flex flex-col gap-2 w-full bg-white rounded-2xl"
          v-for="(item, index) of reversedMyTests"
          :key="item.id"
          :default-open="index == 0"
        >
          <div class="flex px-3 py-5.5 items-center justify-between">
            <div class="">
              <span class="text-sm">{{ item.test[0]?.title }}</span>
            </div>
            <UIcon
              name="solar:alt-arrow-down-line-duotone"
              class="group-data-[state=open]:rotate-180 transition-transform duration-200"
              size="19"
            />
          </div>

          <template #content>
            <div class="px-5 pb-3 space-y-2">
              <img
                :src="item.test[0]?.image"
                :alt="item.test[0]?.title"
                class="w-22 outline-6 object-cover outline-x-secondary-100 scale-125 translate-y-5 h-22 mx-auto rounded-full"
              />
              <p class="flex items-center justify-between text-sm">
                <span>وضعیت</span>
                <strong>{{
                  item.status == "available" ? "فعال" : "غیر فعال"
                }}</strong>
              </p>
              <p class="flex items-center justify-between text-sm">
                <span>تعداد استفاده</span>
                <strong class="ltr"
                  >{{ item.usedCount }} / {{ item.usageLimit }}</strong
                >
              </p>
              <div class="flex gap-2 justify-center">
                <UButton
                  variant="solid"
                  color="x-primary"
                  block
                  label="شروع آزمون"
                  :to="`/test/active/exam?examId=${item.id}`"
                  class="mt-3"
                  :ui="{ base: 'h-11 rounded-full' }"
                />
                <UButton
                  variant="subtle"
                  block
                  color="x-secondary"
                  :to="`/test?s=${item.test[0]?.testId}`"
                  label="مشاهده"
                  class="mt-3"
                  :ui="{ base: 'h-11 rounded-full' }"
                />
              </div>
            </div>
          </template>
        </UCollapsible>
      </div>
    </div>
  </div>
</template>
