<script setup lang="ts">
/**
 * The status pill that nests in a plan card's dip.
 *
 * It is a **sibling** of the masked surface, never a child: the mask would erase
 * anything inside it. Its wrapper is exactly as wide as the dip and centres the
 * label in it, which is what keeps the label clear of the arc at both ends no
 * matter how long the Persian string turns out to be.
 *
 * `surface` decides what the pill wears. On the hero the dip shows the solid
 * accent back layer, so the pill wears that same accent and dark text stays
 * legible against it — the arc reads as one continuous shape running behind the
 * label. On a quiet card the dip shows the page, so the pill stays transparent
 * and the ambient light behind the card reads straight through it — as in the
 * mockup.
 */
withDefaults(
  defineProps<{
    label: string;
    /** `active` is the plan the account already holds, so its dot is green. */
    tone: "active";
    surface?: "page" | "accent";
  }>(),
  { surface: "page" },
);
</script>

<template>
  <!--
    A full-width-of-the-dip flex row rather than a fixed offset: the pill has to
    stay centred while the label's width follows the data. `pointer-events-none`
    hands every tap back to the card, which is the whole click target.
  -->
  <span
    class="pointer-events-none absolute inset-block-start-0 end-0 z-20 flex w-[calc(var(--notch-length)*2)] justify-center"
  >
    <span
      class="mt-1 inline-flex h-5 items-center gap-1.5 rounded-full px-1.5 text-[10px] leading-none font-bold whitespace-nowrap"
      :class="
        surface === 'accent' ? 'bg-x-secondary-400 text-x-primary-900' : 'text-x-text-title'
      "
    >
      {{ label }}
      <span
        class="size-1.5 shrink-0 rounded-full bg-success-500"
        aria-hidden="true"
      />
    </span>
  </span>
</template>
