<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useScroll } from "@vueuse/core";
const cafeOptionItems: DropdownMenuItem[] = [
    {
      label: "میز و کافه های من",
      icon: "solar:list-check-minimalistic-outline",
      async onSelect(e) {
        await navigateTo("/cafe/management");
      },
    },
    {
      label: "صفحه اصلی",
      icon: "solar:arrow-left-linear",
      async onSelect(e) {
        await navigateTo("/");
      },
    },
  ],
  cafeStore = useCafe(),
  containerEl = useTemplateRef("container"),
  { y, arrivedState } = useScroll(containerEl),
  cafeCurrentPage = ref<number>(1),
  infinityCafesScroll = ref<boolean>(false),
  cafesLimit = ref<number>(10);

async function loadNewCafes() {
  watchEffect(async () => {
    if (arrivedState.bottom) {
      infinityCafesScroll.value = true;
      cafeCurrentPage.value++;
      const newCafes = await cafeStore.getCafeFeet(
        { limit: cafesLimit.value, page: cafeCurrentPage.value + 1 },
        true,
      );
      if (typeof newCafes !== "boolean") {
        if (newCafes.public.length <= 0) {
          infinityCafesScroll.value = false;
          return;
        }
        cafeStore.state.cafeFeet.public.push(...newCafes.public);
        cafeStore.state.cafeFeet.privite.push(...newCafes.privite);
      }

      infinityCafesScroll.value = false;
    }
  });
}

const topCafes = computed(() => {
  const topCafesItems = cafeStore.state.topCafes.map(item => {
    return {
      avatar: item.profileImage,
      label: item.label,
      id: item.id
    }
  })

  return topCafesItems
})
onMounted(async () => {
  await Promise.all([
    cafeStore.getCafeFeet({ limit: cafesLimit.value }),
    cafeStore.getSubscribedChannels({ limit: 150 }),
    cafeStore.getTopCafes()
  ]);
  loadNewCafes();
});
</script>

<template>
  <div class="h-full">
    <!--  -->
    <div class="h-dvh">
      <!-- Header -->
      <div class="fixed w-100 max-sm:w-95 left-1/2 -translate-x-1/2 z-20 top-3">
        <div
          class="h-full px-4 py-2.5 rounded-full w-full flex justify-between backdrop-blur-sm items-center border border-slate-200 bg-white/60 shadow-inner"
        >
          <div class="flex items-center gap-3">
            <div class="flex items-center -space-x-7">
              <NuxtImg
                src="/images/cup-cafe.webp"
                class="w-14 h-14 relative z-10 drop-shadow-xl drop-shadow-x-primary-500/50"
              />
              <AppLogo type="colorize" size="sm" />
            </div>
            <div class="grid gap-2">
              <strong>کافه منتویا </strong>
            </div>
          </div>
          <div class="flex">
            <UButton to="/cafe/search" variant="ghost" icon="solar:magnifer-linear" size="lg" />
            <UDropdownMenu
            :items="cafeOptionItems"
            :ui="{
              content:
                'rtl rounded-2xl bg-white/70 shadow-inner shadow-none border-slate-100 p-1.5',
            }"
            size="sm"
          >
            <UButton variant="ghost" icon="solar:menu-dots-bold" size="lg" />
          </UDropdownMenu>
          </div>
        </div>
      </div>
      <!-- Cafes List -->
      <div class="overflow-y-auto h-dvh pt-25" ref="container">
        <div class="w-full space-y-4">
          <div class="mt-7">
            <CafeTopCafes class="my-5.5" :items="(topCafes as any)" :loading="cafeStore.state.loading.getTopCafes" >
              <template #topbar>
                <strong class="inline-block px-6 mb-5">برترین کافه ها</strong>
              </template>
            </CafeTopCafes>
            <div class="my-11">
              <p class="font-bold px-6 sticky top-5 z-10 mb-3">
                میز های عضو شده من
              </p>
              <CafeChatItemSkeleton
                v-if="cafeStore.state.loading.getSubscribedTables"
                class="animate__animated"
                v-for="item of 4"
              />
              <CafeChatItem v-for="chat of cafeStore.state.subscribedTables" :name="chat.table.nikname" :description="chat.table.lastMessage.text || 'پیامی تا کنون در این میز ارسال نشده'" :to="`/cafe/${chat.cafeId}/table/${chat.roomId}`"></CafeChatItem>
            </div>
            <div class="mt-7">
              <p class="font-bold px-6 sticky top-5 z-10 mb-3">
                کافه ها
                <span class="text-xs text-x-text-muted" v-if="cafeStore.state.cafeFeet.public.length <= 0">(خالی از کافه)</span>
              </p>
              <CafeChatItemSkeleton
                v-if="cafeStore.state.loading.getCafeFeet"
                class="animate__animated"
                v-for="item of 6"
              />
              <CafeChatItem
                v-if="!cafeStore.state.loading.getCafeFeet"
                :enabled="chat.enabled"
                :to="`/cafe/${chat.id}/table`"
                :name="chat.label"
                :view="chat.view"
                :image="(chat.profileImage as any)"
                :description="chat.title"
                :key="key"
                v-for="(chat, key) of cafeStore.state.cafeFeet.public"
              >
            <template #left>
              <UButton variant="soft" color="x-primary" label="ورود به کافه" size="sm" :ui="{base: 'rounded-full'}" />
            </template>
              </CafeChatItem>
            </div>
            <div
              class="grid place-items-center py-3"
              v-if="infinityCafesScroll"
            >
              <UIcon
                name="solar:menu-dots-bold-duotone"
                class="animate-spin"
                size="33"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- User Prompt -->
    <div
      class="fixed z-10 w-100 bottom-2.5 max-sm:w-11/12 left-1/2 -translate-x-1/2"
    ></div>
  </div>
</template>
