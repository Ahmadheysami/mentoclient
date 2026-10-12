<script setup lang="ts">
/**
 * Section title row used across the child home and list pages: the heading
 * owns the inline start (right in RTL), and an optional action — «همه» is the
 * usual one — sits at the inline end. Variant-aware ink and radius so it reads
 * as the same row in both panels without duplicating markup.
 */
withDefaults(
  defineProps<{
    title: string;
    actionLabel?: string;
    actionTo?: string;
  }>(),
  { actionLabel: undefined, actionTo: undefined },
);

const childPanel = useChildPanel();
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <h2
      class="min-w-0 truncate font-yekan-extra text-base"
      :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-text-title'"
    >
      {{ title }}
    </h2>

    <NuxtLink
      v-if="actionTo && actionLabel"
      :to="actionTo"
      class="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        childPanel.variant === 'child'
          ? 'text-x-kid-700 focus-visible:outline-x-kid-berry-700'
          : 'text-x-teen-violet-600 focus-visible:outline-x-teen-violet-600'
      "
    >
      {{ actionLabel }}
      <UIcon name="solar:alt-arrow-left-linear" size="14" aria-hidden="true" />
    </NuxtLink>
  </div>
</template>
