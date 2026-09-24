<script setup lang="ts">
const props = defineProps<{
    title: string;
    options: {
      isFeature: boolean;
      audience: { from: number; to: number };
      questionCount: number;
    };
    to: string;
    thumbnail?: string;
  }>(),
  imageLoaded = ref<boolean>(true);
</script>

<template>
  <ULink
    :to="`/test?s=${props.to}`"
    class="text-right bg-white flex gap-2 hover:shadow-2xl hover:shadow-black/10 transition-all items-center rounded-3xl"
  >
    <NuxtImg
      :src="props.thumbnail || '/logo.png'"
      :class="{ 'opacity-60 object-cover! p-7!': !props.thumbnail }"
      class="h-36 min-w-31 max-w-31 object-cover rounded-r-3xl"
      :alt="props.title"
      @error="imageLoaded = false"
      v-if="imageLoaded"
    />
    <!-- <UIcon v-else name="mdi-light:picture" :size="136" /> -->
    <img
      src="/logo.png"
      class="w-30 h-34 object-cover opacity-80 bg-blue-500/10 rounded-2xl p-5"
      v-else
      :alt="props.title"
    />
    <div class="w-full p-3">
      <strong class="line-clamp-2 text-x-text-title">
        {{ props.title }}
      </strong>
      <div class="tags flex gap-2 my-2">
        <span
          v-if="props.options.isFeature"
          class="flex items-center text-xs bg-x-secondary-50 text-x-secondary-500 p-1.5 rounded-full text-center"
          >پیشنهادی</span
        >
        <span
          class="flex items-center text-xs bg-yellow-50 text-yellow-600 p-1.5 rounded-full text-center"
        >
          از
          {{ props.options.audience.from }}
          تا
          {{ props.options.audience.to }}
          سال
        </span>
        <span
          v-if="true"
          class="flex items-center text-xs bg-emerald-50 text-emerald-600 p-1.5 rounded-full text-center"
          >{{ props.options.questionCount }} سوال</span
        >
      </div>
      <div class="flex justify-end">
        <UButton
          type="button"
          variant="solid"
          class="mt-3"
          :ui="{ base: 'rounded-3xl px-6 py-2' }"
          color="x-primary"
          label="مشاهده و فعال سازی"
        />
      </div>
    </div>
  </ULink>
</template>
