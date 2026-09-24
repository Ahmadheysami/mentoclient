<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});

const cafeStore = useCafe(),
  { params } = useRoute(),
  {$toast} = useNuxtApp(),
  singleCafe = ref<CafeItem>();

onMounted(async () => {
  const cafe = await cafeStore.getSingleCafe(params?.cafeId as string);

  if (cafe === null) {
    $toast.error('کافه پیدا نشد')
    await navigateTo("/cafe")
  }
  await cafeStore.getTablesUnderCafes(params?.cafeId as string);

  singleCafe.value = cafe as any;
});
</script>

<template>
  <div class="h-full">
    <!--  -->
    <div class="h-dvh">
      <!-- Header -->
      <div class="sticky top-0 z-11">
        <div
          class="px-4 py-4.5 w-full backdrop-blur-sm items-center rounded-b-4xl border border-slate-200 cafe-profile shadow-inner"
        >
          <UButton size="xl" icon="text-x-text-subtitle" to="/cafe" />
          <div class="relative grid place-items-center gap-3">
            <UAvatar
              :src="singleCafe?.profileImage as any"
              :alt="singleCafe?.label"
              v-if="!cafeStore.state.loading.getSingleCafe"
              class="w-32 h-32 object-cover rounded-full border-2 border-slate-200"
            />
            <!-- Loading -->
            <USkeleton
              class="w-32 h-32 rounded-full bg-white/30"
              v-if="cafeStore.state.loading.getSingleCafe"
            />
            <div class="grid gap-2 text-center">
              <!-- Loading -->
              <USkeleton
                class="rounded-full h-3 w-36 bg-white/30 mx-auto"
                v-if="cafeStore.state.loading.getSingleCafe"
              />
              <USkeleton
              class="rounded-full h-3 w-56 bg-white/30 mx-auto"
              v-if="cafeStore.state.loading.getSingleCafe"
              />
              <USkeleton
                class="rounded-full h-3 w-11/12 bg-white/30 mx-auto"
                v-if="cafeStore.state.loading.getSingleCafe"
                />
                <div class="flex gap-3 mx-auto" v-if="cafeStore.state.loading.getSingleCafe">
                  <div class="w-17 h-8 bg-white/30 rounded-full"></div>
                  <div class="w-17 h-8 bg-white/30 rounded-full"></div>
                  <div class="w-17 h-8 bg-white/30 rounded-full"></div>
                </div>
                <div>
                <strong
                  class="text-xl line-clamp-1 text-white"
                  v-if="!cafeStore.state.loading.getSingleCafe"
                  >{{ singleCafe?.label }}
                </strong>
                <p class="text-slate-200 text-sm font-bold" v-if="!cafeStore.state.loading.getSingleCafe">
                  {{ singleCafe?.title }}
                </p>
                <p class="text-xs text-slate-200" v-if="!cafeStore.state.loading.getSingleCafe">
                  {{ singleCafe?.body }}
                </p>
              </div>
              <div v-if="!cafeStore.state.loading.getSingleCafe" class="flex items-center justify-center gap-2 mt-2">
                <div
                  class="hover:scale-110 hover:-translate-y-3 transition py-3 text-sm px-4.5 flex items-center gap-1.5 text-center bg-white/25 rounded-3xl border border-white/30"
                
                  >
                  <span class="text-white">بازدید : </span>
                  <strong class="text-slate-200 font-bold">{{
                    singleCafe?.view
                  }}</strong>
                </div>
                <div
                  class="hover:scale-110 hover:-translate-y-3 transition py-3 text-sm px-4.5 flex items-center gap-1.5 text-center bg-white/25 rounded-3xl border border-white/30"
                >
                  <span class="text-white">{{
                    singleCafe?.status === "public" ? "عمومی" : "خصوصی"
                  }}</span>
                </div>
                <div
                  class="hover:scale-110 hover:-translate-y-3 transition py-3 text-sm px-4.5 flex items-center gap-1.5 text-center bg-white/25 rounded-3xl border border-white/30"
                >
                  <span class="text-white">{{
                    singleCafe?.enabled ? "فعال" : "غیر فعال"
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Messages -->
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
             <div class="text-sm text-center space-y-6 font-bold" v-if="!cafeStore.state.loading.getSingleCafe && (singleCafe === null || cafeStore.state.tablesUnderCafe.length <= 0)" >
              <AppLogo type="colorize" :size="'lg'"/>
              <p >تا به الآن میز فعالی وجود ندارد</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cafe-profile {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' version='1.1' xmlns:xlink='http://www.w3.org/1999/xlink' xmlns:svgjs='http://svgjs.dev/svgjs' width='480' height='400' preserveAspectRatio='none' viewBox='0 0 480 400'%3e%3cg mask='url(%26quot%3b%23SvgjsMask1044%26quot%3b)' fill='none'%3e%3crect width='480' height='400' x='0' y='0' fill='url(%26quot%3b%23SvgjsLinearGradient1045%26quot%3b)'%3e%3c/rect%3e%3cpath d='M480 0L405.22 0L480 197.04z' fill='rgba(255%2c 255%2c 255%2c .1)'%3e%3c/path%3e%3cpath d='M405.22 0L480 197.04L480 226.57L196.89000000000001 0z' fill='rgba(255%2c 255%2c 255%2c .075)'%3e%3c/path%3e%3cpath d='M196.89 0L480 226.57L480 322.57L79.87999999999998 0z' fill='rgba(255%2c 255%2c 255%2c .05)'%3e%3c/path%3e%3cpath d='M79.88 0L480 322.57L480 355.12L22.999999999999993 0z' fill='rgba(255%2c 255%2c 255%2c .025)'%3e%3c/path%3e%3cpath d='M0 400L149.56 400L0 254.34z' fill='rgba(0%2c 0%2c 0%2c .1)'%3e%3c/path%3e%3cpath d='M0 254.34L149.56 400L320.53999999999996 400L0 130.92000000000002z' fill='rgba(0%2c 0%2c 0%2c .075)'%3e%3c/path%3e%3cpath d='M0 130.92000000000002L320.53999999999996 400L339.46999999999997 400L0 127.56000000000002z' fill='rgba(0%2c 0%2c 0%2c .05)'%3e%3c/path%3e%3cpath d='M0 127.56L339.46999999999997 400L356.46999999999997 400L0 77.23z' fill='rgba(0%2c 0%2c 0%2c .025)'%3e%3c/path%3e%3c/g%3e%3cdefs%3e%3cmask id='SvgjsMask1044'%3e%3crect width='480' height='400' fill='white'%3e%3c/rect%3e%3c/mask%3e%3clinearGradient x1='4.17%25' y1='105%25' x2='95.83%25' y2='-5%25' gradientUnits='userSpaceOnUse' id='SvgjsLinearGradient1045'%3e%3cstop stop-color='%230e2a47' offset='0'%3e%3c/stop%3e%3cstop stop-color='rgba(43%2c 127%2c 255%2c 1)' offset='1'%3e%3c/stop%3e%3c/linearGradient%3e%3c/defs%3e%3c/svg%3e");
  background-size: cover;
}
</style>
