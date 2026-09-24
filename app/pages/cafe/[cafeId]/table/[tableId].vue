<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});

const cafeStore = useCafe(),
  chatOptionItems = ref<DropdownMenuItem[]>([
    {
      label: "گزارش",
      icon: "solar:pen-2-bold",
    },
    {
      label: "خروج از میز",
      icon: "solar:pen-2-bold",
      onSelect() {
        leaveTableModal.value = !leaveTableModal.value
      },
      ui: {
        itemLabel: "text-red-500",
        itemLeadingIcon: "text-red-500",
        item: "bg-red-50 rounded-xl",
      },
    },
  ]),
  messageContainer = ref<HTMLDivElement>(),
  { $toast } = useNuxtApp(),
  { params } = useRoute(),
  table = ref<SubscribeItem["table"] | null>(null),
  leaveTableModal = ref<boolean>(false)

// Scroll to end
function scrollChatToEnd() {
  if (messageContainer.value) {
    messageContainer.value.scrollTo({
      top: messageContainer.value?.scrollHeight || 0,
    });
  }
}

const subscribeToChannel = async () => {
  if (!table.value?.id || cafeStore.state.loading.subscribe) {
    $toast.info("یک بار دیگر امتحان کنید");
    return;
  }

  const res = await cafeStore.subscribe(table.value ? table.value.id : "");
  if (!res?.success) {
    $toast.error(res?.message);
    return;
  }
  cafeStore.state.loading.subscribe = true;
  table.value = await cafeStore.getSingleTable(table.value.cafeId, table.value.id);
  $toast.success(res?.message);
  cafeStore.state.loading.subscribe = false;
};

const leaveFromTable = async () => {
  if (!table.value?.id || cafeStore.state.loading.left) {
    $toast.info("یک بار دیگر امتحان کنید");
    return;
  }

  const res = await cafeStore.left(table.value ? table.value.id : "");
  if (!res?.success) {
    $toast.error(res?.message);
    return;
  }
  $toast.success(res?.message);
  leaveTableModal.value = false
  await navigateTo("/cafe")
}
onMounted(async () => {
  table.value = await cafeStore.getSingleTable(
    params.cafeId as string,
    params.tableId as string,
  );
  if (!table.value) {
    $toast.error("خطایی در بارگذاری میز رخ داده است");
    await navigateTo("/cafe");
  }

  // create dropdown item for mnager role 
  if(table.value && table.value.isManager){
    chatOptionItems.value = []
    chatOptionItems.value.push({
      label: 'تنظیمات ',
      icon: 'solar:settings-linear'
    })
  }
});
</script>

<template>
  <div class="h-full">
    <!--  -->
    <div class="grid h-dvh">
      <!-- Get started -->
      <div v-if="false" class="h-dvh grid place-items-center w-full">
        <div>
          <div class="text-center space-y-4">
            <UIcon
              name="solar:slash-circle-outline"
              class="animate-spin"
              size="25"
            />
            <p class="font-bold text-xs">در حال بارگذاری گفتگو ...</p>
          </div>
        </div>
      </div>
      <!--  -->
      <div v-if="false" class="h-dvh grid place-items-center w-full">
        <div>
          <div class="text-center space-y-4">
            <AppLogo type="typo-colorize" size="md" />
            <p class="font-bold text-sm">پیامی تا کنون ارسال نشده</p>
          </div>
        </div>
      </div>
      <!-- Header -->
      <div
        class="fixed z-10 w-100 top-3 max-sm:w-11/12 left-1/2 -translate-x-1/2"
      >
        <div
          class="h-full p-2.5 w-full backdrop-blur-sm rounded-full border border-slate-200 bg-white/60 shadow-inner"
        >
          <div
            class="flex gap-2.5 items-center"
            v-if="cafeStore.state.loading.getSingleTable"
          >
            <USkeleton class="w-13 h-13 bg-slate-100 rounded-full"></USkeleton>
            <div class="grid gap-1">
              <USkeleton class="w-45 h-5 bg-slate-100 rounded-lg" />
              <USkeleton class="w-30 h-3.5 bg-slate-100 rounded-lg" />
            </div>
          </div>
          <div
            v-if="!cafeStore.state.loading.getSingleTable && table !== null"
            class="flex justify-between items-center"
          >
            <div class="flex items-center gap-3">
              <UAvatar
                class="w-14 h-14"
                :src="table.profileImage"
                :alt="table.nikname"
              />
              <div class="grid">
                <strong class="text-sm">{{ table.nikname }} </strong>
                <p class="text-xs text-x-text-body line-clamp-1">
                  کافه {{ table.status === "privite" ? "خصوصی" : "عمومی" }}
                </p>
              </div>
            </div>
            <UDropdownMenu
              :items="chatOptionItems"
              :ui="{
                content:
                  'rtl rounded-2xl bg-white/70 shadow-inner shadow-none border-slate-100 p-0.5',
              }"
              size="sm"
            >
              <UButton variant="ghost" icon="solar:menu-dots-bold" size="lg" />
            </UDropdownMenu>
          </div>
        </div>
      </div>
      <!-- Messages -->
      <div
        v-if="true"
        :class="{ 'pb-18 pt-24': true }"
        class="grid place-items-end overflow-y-auto"
        ref="messageContainer"
      >
        <div class="w-full space-y-1 px-3.5">
          <!-- <CafeChatMessage v-for="item of 10" text="سلام خوبی" type="provider"/>
          <CafeChatMessage v-for="item of 10" text="سلام ممنون تو خوبی" type="user"/> -->
        </div>
      </div>
    </div>

    <!-- User Prompt -->
    <div
      class="fixed z-10 w-100 bottom-2.5 max-sm:w-11/12 left-1/2 -translate-x-1/2"
    >
      <!-- If not subscription in table -->
      <UButton
        variant="solid"
        @click="subscribeToChannel"
        color="x-primary"
        label="عضویت در میز"
        size="md"
        block
        class="rounded-full cursor-pointer"
        :ui="{ base: 'h-12 font-bold' }"
        :disabled="cafeStore.state.loading.subscribe"
        :loading="cafeStore.state.loading.subscribe"
        v-if="
          !cafeStore.state.loading.getSingleCafe &&
          (!table?.subscribe || table.subscribe.length <= 0)
        "
      />

      <div
        v-else
        class="fixed z-10 w-100 bottom-1 max-sm:w-11/12 left-1/2 -translate-x-1/2 py-4 rounded-full border border-slate-200 bg-white/60 shadow-inner backdrop-blur-md"
      >
        <p class="text-sm text-center">عضو شده</p>
      </div>
      <BotChatPrompt :normal="true" v-if="false" />


      <!-- Modal -->
       <UModal v-model:open="leaveTableModal" :close="false" :ui="{content: 'w-96 max-md:w-85 rounded-3xl shadow-none'}">
        <template #body>
          <UiAlert :loading="cafeStore.state.loading.left" title="خروج از میز" description="آیا برای خروج از میز اطمینان دارید؟" @accept="leaveFromTable" @cancel="() => leaveTableModal = !leaveTableModal"/>
        </template>
       </UModal>
    </div>
  </div>
</template>
