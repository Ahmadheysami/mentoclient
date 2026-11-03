<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";

/**
 * Compact «latest exam outcome» card for the home/profile previews. Mirrors
 * the result row conventions of /panels/child/results: the cup-star chip, the
 * title-first hierarchy, a <time> date, and a soft variant chip — here it
 * carries the score when the caller has one. (The wire result itself has no
 * numeric score today; the props stay optional so the card never invents
 * data.)
 *
 * `to` turns the whole card into a link to one result. Omitted, the card stays
 * a plain read-only row — the home preview has always been display-only.
 *
 * Without a `to`, the card is a real `<button>` that emits `open`: the two
 * screens holding one show it in a sheet rather than navigating away.
 */
const props = withDefaults(
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
    /** Result page this card opens. When absent the card is not a link. */
    to?: string;
  }>(),
  { score: null, total: null, chipLabel: undefined, to: undefined },
);

const emit = defineEmits<{
  /** The reader tapped a non-linked card and wants its result sheet. */
  open: [];
}>();

const childPanel = useChildPanel();

/** `NuxtLink` has to be resolved, not named: a string `:is` would not pick it up. */
const NuxtLinkComponent = resolveComponent("NuxtLink");

const surfaceRadius = computed(() =>
  childPanel.variant === "child" ? "rounded-3xl" : "rounded-xl",
);

/** A link needs a visible affordance; a read-only card must not pretend. */
const isLink = computed(() => typeof props.to === "string" && props.to.length > 0);
</script>

<template>
  <component
    :is="isLink ? NuxtLinkComponent : 'button'"
    :to="isLink ? to : undefined"
    :type="isLink ? undefined : 'button'"
    :aria-label="isLink ? undefined : `دیدن نتیجه ${title}`"
    :class="[
      surfaceRadius,
      'transition-transform duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100',
      isLink ? 'focus-visible:outline-2 focus-visible:outline-offset-2' : 'cursor-pointer text-start',
      isLink
        ? childPanel.variant === 'child'
          ? 'focus-visible:outline-x-kid-berry-700'
          : 'focus-visible:outline-x-teen-violet-600'
        : '',
    ]"
    class="neu-raised flex w-full items-center gap-3 bg-white p-4"
    @click="isLink ? undefined : emit('open')"
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

    <UIcon
      v-if="isLink"
      name="solar:alt-arrow-left-linear"
      size="16"
      class="shrink-0 text-x-text-muted"
      aria-hidden="true"
    />
  </component>
</template>
