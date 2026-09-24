<script setup lang="ts">
const cafeStore = useCafe(),
  settingsModal = ref<boolean>(false),
  targetId = ref<string | null>(null);
const openSettingsModal = (id: string | null) => {
  settingsModal.value = !settingsModal.value;
  if (!id) {
    settingsModal.value = !settingsModal.value;
    return;
  }

  targetId.value = id;
};
watch(settingsModal, async (newVal: boolean) => {
  if (newVal) {
    if (targetId.value) {
      await cafeStore.getTablesUnderCafes(targetId.value);
    }
  } else {
    cafeStore.state.tablesUnderCafe = []
  }
});

onMounted(async () => {
  await cafeStore.getManagentsCafe({});
});
</script>

<template>
  <div>
    <!-- Head -->
    <UDashboardToolbar
      :ui="{ root: 'bg-white shadow-sm border-none py-3 sticky top-0 z-20 ' }"
    >
      <template #right>
        <UtilBackBtn to="/cafe" />
      </template>
      <template #left>
        <strong class="text-x-text-title text-lg"> مدیریت من </strong>
      </template>
    </UDashboardToolbar>

    <div class="body p-2">
      <!-- If Empty -->
      <div
        class="h-[80dvh] bg-red-200 grid place-items-center"
        v-if="
          !cafeStore.state.loading.getMyCt &&
          cafeStore.state.managementsData.length <= 0
        "
      >
        <UiAlert
          title="تا کنون به میز یا کافه دعوت نشدید"
          class="*:font-yekan-reqular! *:text-sm!"
          type="info"
          :action="false"
        />
      </div>
      <div
        class="overflow-hidden rounded-2xl"
        v-if="cafeStore.state.loading.getMyCt"
      >
        <CafeChatItemSkeleton v-for="item of 7" />
      </div>

      <!-- Access List -->
      <div class="grid gap-1 rounded-2xl overflow-hidden" v-else>
        <CafeChatItem
          class="*:text-sm py-2"
          :name="
            String(
              item.type === 'cafe'
                ? item.cafe[0]?.label
                : item.type === 'table'
                  ? item.table[0]?.nikname
                  : 'بدون نام',
            )
          "
          :description="`عنوان مدیریتی: ${item.type === 'cafe' ? 'مدیر کافه' : 'مدیر میز'}`"
          v-for="item of cafeStore.state.managementsData"
          :key="item.id"
        >
          <template #left>
            <UButton
              v-if="item.type == 'table'"
              :to="`/cafe/${item.table[0]?.cafeId}/table/${item.table[0]?.id}`"
              color="x-secondary"
              variant="soft"
              :ui="{ base: 'rounded-full', label: 'text-xs' }"
              size="sm"
              label="ورود به میز"
            />
            <UButton
              v-if="item.type == 'cafe'"
              @click="openSettingsModal(item.type === 'cafe' ? item.targetId : null)"
              color="x-secondary"
              variant="soft"
              :ui="{ base: 'rounded-full', label: 'text-xs' }"
              size="sm"
              label="بیشتر"
            />
          </template>
        </CafeChatItem>
      </div>
    </div>
    <!-- Modal -->
    <UModal
      v-model:open="settingsModal"
      :fullscreen="true"
      :close="false"
      :ui="{ content: 'w-md max-w-md shadow-none' }"
    >
      <template #header>
        <div class="flex items-center justify-between w-full pe-2">
          <strong>تنظیمات و مدیریت کافه</strong>
          <UButton
            variant="link"
            @click="(settingsModal = !settingsModal) as any"
          >
            <UIcon
              :name="`solar:arrow-left-linear`"
              size="28"
              class="text-x-text-subtitle"
            />
          </UButton>
        </div>
      </template>
      <template #body>
        <div class="grid overflow-y-auto">
        <div class="w-full space-y-4">
          <div class="mt-7">
            <p class="font-bold px-6 sticky top-5 z-10 mb-3">میز ها</p>
            <CafeChatItemSkeleton
              class="animate__animated"
              v-for="item of 5"
              v-if="cafeStore.state.loading.getTablesUnderCafe"
            />
            <!-- Table Item -->
            <CafeChatItem
              :name="table.nikname"
              :description="
                table.lastMessage.text || 'پیامی تا کنون در این میز ارسال نشده'
              "
              :to="`/cafe/${table.cafeId}/table/${table.id}`"
              v-for="table of cafeStore.state.tablesUnderCafe"
            >
              <template #left> </template>
            </CafeChatItem>

            <!-- If empty from tables -->
             <div class="text-sm text-center space-y-6 font-bold" v-if="!cafeStore.state.loading.getSingleCafe && (cafeStore.state.tablesUnderCafe.length <= 0)" >
              <AppLogo type="colorize" :size="'lg'"/>
              <p >تا به الآن میز فعالی وجود ندارد</p>
             </div>
          </div>
        </div>
      </div>
      </template>
    </UModal>
  </div>
</template>
