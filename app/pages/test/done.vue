<script setup lang="ts">
const testStore = useTest();

onMounted(async () => {
  await testStore.getTestResults();
});
</script>

<template>
  <TestTabItems />
  <div class="w-11/12 mx-auto">
    <p class="text-sm mt-2 mb-4 inline-block font-bold">
      نتیجه تست های انجام شده
    </p>
    <div
      class="h-[55dvh] grid place-items-center"
      v-if="testStore.state.loading?.getTestsDone"
    >
      <div>
        <UIcon name="line-md:loading-twotone-loop" size="40" />
      </div>
    </div>
    <div
      class="h-[55dvh] grid place-items-center"
      v-if="
        !testStore.state.loading?.getTestsDone &&
        (testStore.state.testResults?.length as number) <= 0
      "
    >
      <div class="grid place-items-center gap-2">
        <UIcon name="solar:document-outline" size="80" />
        <p class="text-sm">تا این لحظه نتیجه ثبت نشده</p>
      </div>
    </div>
    <div
      class="space-y-3"
      v-if="!testStore.state.loading.getTestsDone && testStore.state.testResults.length >= 1"
    >
      <UCollapsible
        class="flex flex-col gap-2 w-full bg-white rounded-2xl"
        v-for="(item, index) of testStore.state.testResults"
        :default-open="index == 0"
      >
        <div class="flex px-3 py-5.5 items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="w-6 h-6 rounded-full text-xs grid place-items-center bg-x-primary-400 text-white font-bold"
              >{{ index + 1 }}</span
            >
            <span class="text-sm">{{ item.test.title }}</span>
          </div>
          <UIcon
            name="solar:alt-arrow-down-line-duotone"
            class="group-data-[state=open]:rotate-180 transition-transform duration-200"
            size="19"
          />
        </div>

        <template #content>
          <div class="px-5 pb-3 space-y-2">
            <div class="space-y-2 mt-5">
              <p>نتیجه:</p>
              <strong>{{ item.result.title }}</strong>
              <p class="text-sm mt-3">
                {{ item.result.body }}
              </p>
              <p class="space-x-2">
                <span>کد تخصصی:</span> <strong>{{ item.result.code }}</strong>
              </p>

              <div class="flex gap-3">
                <UButton
                  variant="solid"
                  color="x-primary"
                  block
                  label="دانلود نتیجه کامل"
                  class="mt-3"
                  icon="solar:cloud-download-linear"
                  download="test-result.pdf"
                  size="sm"
                  :ui="{ base: 'h-10 rounded-full' }"
                />
                <UButton
                  variant="solid"
                  color="x-secondary"
                  size="sm"
                  block
                  disabled
                  icon="solar:star-fall-outline"
                  label="برسی با هوش مصنوعی"
                  class="mt-3"
                  :ui="{ base: 'h-10 rounded-full' }"
                />
              </div>
            </div>
          </div>
        </template>
      </UCollapsible>
    </div>
  </div>
</template>
