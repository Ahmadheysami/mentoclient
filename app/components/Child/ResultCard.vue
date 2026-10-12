<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";

/**
 * Compact «latest exam outcome» card for the home/profile previews. Mirrors
 * the result row conventions of /panels/child/results: the cup-star chip, the
 * title-first hierarchy, a <time> date, and a soft variant chip — here it
 * carries the score when the caller has one. (The wire result itself has no
 * numeric score today; the props stay optional so the card never invents
 * data.)
 */
withDefaults(
  defineProps<{
    title: string;
    date: string;
    score?: number | null;
    total?: number | null;
    /**
     * A TEXT chip («در محدوده متعادل») for callers whose wire carries a label
     * rather than a number — the child results read is one. Wins over `score`.
     */
    chipLabel?: string;
  }>(),
  { score: null, total: null, chipLabel: undefined },
);

const childPanel = useChildPanel();
</script>

<template>
  <article
    class="neu-raised flex items-center gap-3 bg-white p-4"
    :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
  >
    <span
      class="grid size-12 shrink-0 place-items-center"
      :class="
        childPanel.variant === 'child'
          ? 'rounded-2xl bg-x-kid-sun-100 text-x-kid-sun-700'
          : 'rounded-xl bg-x-teen-100 text-x-teen-700'
      "
      aria-hidden="true"
    >
      <UIcon name="solar:cup-star-linear" size="24" />
    </span>

    <span class="min-w-0 flex-1">
      <strong class="block truncate text-sm font-yekan-bold text-x-text-title">
        {{ title }}
      </strong>
      <span class="block text-xs text-x-text-subtitle">
        <time :datetime="date">{{ faDate(date) }}</time>
      </span>
    </span>

    <span
      v-if="chipLabel !== undefined"
      class="max-w-2/5 shrink-0 truncate rounded-full px-3 py-1.5 text-center text-xs font-yekan-bold"
      :class="
        childPanel.variant === 'child'
          ? 'bg-x-kid-mint-100 text-x-kid-mint-700'
          : 'bg-x-teen-100 text-x-teen-700'
      "
    >
      {{ chipLabel }}
    </span>

    <span
      v-else-if="score !== null && score !== undefined"
      class="max-w-2/5 shrink-0 truncate rounded-full px-3 py-1.5 text-center text-xs font-yekan-bold"
      :class="
        childPanel.variant === 'child'
          ? 'bg-x-kid-mint-100 text-x-kid-mint-700'
          : 'bg-x-teen-100 text-x-teen-700'
      "
    >
      <template v-if="total !== null && total !== undefined">
        {{ faNumber(score) }} از {{ faNumber(total) }}
      </template>
      <template v-else>{{ faNumber(score) }}</template>
    </span>
  </article>
</template>
