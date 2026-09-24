<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import ChatItemSkeleton from "~/components/Cafe/ChatItemSkeleton.vue";
const text = ref<string>(""),
  cafeStore = useCafe(),
  loading = ref<boolean>(false),
  results = ref<SubscribeItem["table"][]>([]);

const searchFunction = async (searchText: string) => {
  const search = await cafeStore.searchTable(text.value);
  if (!search || search === null) return (results.value = []);

  results.value = search;
  loading.value = false
};

const debouncedSearch = useDebounceFn(searchFunction, 2500);

watchEffect(() => {
  if (text.value.trim()) {
    loading.value = true
    debouncedSearch(text.value);
  }
});
</script>

<template>
  <div class="relative h-dvh max-h-dvh bg-white/60 pt-21">
    <div
      class="w-full h-full grid place-items-center animate__animated animate__fadeIn"
      v-if="!text.trim().length"
    >
      <div class="grid place-items-center gap-4">
        <div
          class="w-21 grid place-items-center h-21 rounded-3xl bg-x-primary-50"
        >
          <UIcon
            name="solar:magnifer-linear"
            size="50"
            class="text-x-primary-500"
          />
        </div>
        <p class="text-sm">میز مورد نظرتون را جستجو کنید</p>
      </div>
    </div>
    <div
      class="w-full h-full grid place-items-center animate__animated animate__fadeIn"
      v-if="text.length && !loading && !results.length"
    >
      <div class="grid place-items-center gap-4">
        <div
          class="w-21 grid place-items-center h-21 rounded-3xl bg-red-50"
        >
          <UIcon
            name="solar:close-circle-linear"
            size="50"
            class="text-red-500"
          />
        </div>
        <p class="text-sm">میزی پیدا نشد</p>
      </div>
    </div>
    <div class="absolute top-0 left-0 w-full">
      <input
        
        type="text"
        v-model="text"
        placeholder="نام کانال یا ایدی آن را وارد کنید"
        class="w-full p-3 h-17 border-b border-slate-200 outline-none bg-tranparent rounded-none placeholder:text-sm"
      />
    </div>
    <div class="p-3" v-if="text.trim().length">
      <!-- Skeleton Loading -->
      <div v-if="text.trim().length && loading">
        <ChatItemSkeleton
          class="border-b animate__animated animate__fadeIn"
          v-for="item of 8"
        />
      </div>

      <!-- Results -->
      <div v-if="!loading">
        <CafeChatItem
          :to="`/cafe/${table.cafeId}/table/${table.id}`"
          :name="table.nikname"
          :description="`کافه ${table.status == 'public' ? 'عمومی' : 'خصوصی'}`"
          :key="key"
          v-for="(table, key) of results"
        >
          <template #left>
            <UButton size="sm" :ui="{base: 'rounded-full'}" label="ورود" color="x-primary" />
          </template>
        </CafeChatItem>
      </div>
    </div>
  </div>
</template>
