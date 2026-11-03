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

/** `NuxtLink` has to be resolved, not named: a string `:is` would not pick it up. */
const NuxtLinkComponent = resolveComponent("NuxtLink");
</script>

<template>
  <component
    :is="to ? NuxtLinkComponent : 'div'"
    :to="to ? `/test?s=${to}` : undefined"
    class="flex items-start gap-3 rounded-3xl bg-white p-3.5 transition duration-200 ease-out hover:scale-95 hover:opacity-90 active:scale-95 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-600 sm:p-4"
  >
    <!--
      A smaller thumbnail on phones and the old 96px one from `sm` up: on a
      320px screen the 96px image plus padding left ~150px for the title and
      three badges, which is what made this list look cramped and forced the
      badges onto three rows. `shrink-0` keeps the image square either way.
    -->
    <NuxtImg
      v-if="thumbnail"
      :src="thumbnail"
      :alt="title"
      loading="lazy"
      class="size-20 shrink-0 rounded-2xl object-cover sm:size-24"
    />
    <span
      v-else
      class="grid size-20 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800 sm:size-24"
      aria-hidden="true"
    >
      <UIcon name="solar:document-medicine-linear" class="size-8" />
    </span>

    <span class="flex min-w-0 flex-1 flex-col">
      <strong class="line-clamp-2 text-sm text-x-text-title sm:text-base">{{ title }}</strong>

      <!--
        Badges use UBadge (Nuxt UI) tinted from the design tokens: a soft
        gradient + hairline ring reads as "alive" where a flat tint vanished
        against the white card. Only token colours, so nothing new is invented.
      -->
      <span class="mt-2 flex flex-wrap items-center gap-1.5">
        <UBadge
          v-if="options.isFeature"
          variant="soft"
          icon="solar:star-bold"
          label="پیشنهادی"
          :ui="{
            base:
              'gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-linear-to-l from-x-secondary-500 to-x-secondary-100 text-x-secondary-900 ring-x-secondary-300/60 sm:px-2.5 sm:py-1 sm:text-xs',
          }"
        />

        <UBadge
          variant="soft"
          icon="solar:user-rounded-linear"
          :label="`${faNumber(options.audience.from)} تا ${faNumber(options.audience.to)} سال`"
          :ui="{
            base:
              'gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-linear-to-l from-x-primary-500 to-x-primary-200 text-x-primary-900 ring-x-primary-300/60 sm:px-2.5 sm:py-1 sm:text-xs',
          }"
        />

        <UBadge
          variant="soft"
          icon="solar:list-check-linear"
          :label="`${faNumber(options.questionCount)} سوال`"
          :ui="{
            base:
              'gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 bg-linear-to-l from-x-primary-content-600 to-x-primary-content-400 text-x-primary-content-900 ring-x-primary-content-400/60 sm:px-2.5 sm:py-1 sm:text-xs',
          }"
        />
      </span>

      <span
        class="mt-auto flex items-center justify-center gap-1 pt-3 text-xs font-medium text-x-primary-500 sm:text-sm"
      >
        مشاهده و فعال‌سازی
        <UIcon name="solar:alt-arrow-left-linear" size="18" aria-hidden="true" />
      </span>
    </span>
  </component>
</template>
