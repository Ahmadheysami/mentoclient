<script setup lang="ts">
import { faNumber } from "~/utils/fa";

defineProps<{
  title: string;
  options: {
    isFeature: boolean;
    audience: { from: number; to: number };
    questionCount: number;
  };
  to: string;
  thumbnail?: string;
}>();
</script>

<template>
  <NuxtLink
    :to="`/test?s=${to}`"
    class="flex gap-3 rounded-3xl bg-white p-4 transition duration-200 ease-out hover:scale-95 hover:opacity-90 active:scale-95 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600"
  >
    <NuxtImg
      v-if="thumbnail"
      :src="thumbnail"
      :alt="title"
      loading="lazy"
      class="size-24 shrink-0 rounded-2xl object-cover"
    />
    <span
      v-else
      class="grid size-24 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
      aria-hidden="true"
    >
      <UIcon name="solar:document-medicine-linear" size="32" />
    </span>

    <span class="flex min-w-0 flex-1 flex-col">
      <strong class="line-clamp-2 text-x-text-title">{{ title }}</strong>

      <!--
        Badges use UBadge (Nuxt UI) tinted from the design tokens: a soft
        gradient + hairline ring reads as "alive" where a flat tint vanished
        against the white card. Only token colours, so nothing new is invented.
      -->
      <span class="mt-2 flex flex-wrap items-center gap-2">
        <UBadge
          v-if="options.isFeature"
          variant="soft"
          icon="solar:star-bold"
          label="پیشنهادی"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-secondary-500 to-x-secondary-100 text-x-secondary-900 ring-x-secondary-300/60',
          }"
        />

        <UBadge
          variant="soft"
          icon="solar:user-rounded-linear"
          :label="`${faNumber(options.audience.from)} تا ${faNumber(options.audience.to)} سال`"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-500 to-x-primary-200 text-x-primary-900 ring-x-primary-300/60',
          }"
        />

        <UBadge
          variant="soft"
          icon="solar:list-check-linear"
          :label="`${faNumber(options.questionCount)} سوال`"
          :ui="{
            base:
              'gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-linear-to-l from-x-primary-content-600 to-x-primary-content-400 text-x-primary-content-900 ring-x-primary-content-400/60',
          }"
        />
      </span>

      <span
        class="mt-auto text-center gap-1 pt-3 text-sm font-medium text-x-primary-500!"
      >
        مشاهده و فعال‌سازی
        <UIcon name="solar:alt-arrow-left-linear" size="18" aria-hidden="true" />
      </span>
    </span>
  </NuxtLink>
</template>
