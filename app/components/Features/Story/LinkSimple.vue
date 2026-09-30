<script setup lang="ts">
/**
 * The "simple" story CTA: a flat translucent button that says there is a link,
 * without pretending to be an advert.
 *
 * `UButton` rather than a bare `<a>`, because it already emits
 * `rel="noopener noreferrer"` for an external `to` and gives us the `:ui`
 * override surface for free.
 *
 * `href` arrives already through `safeStoryHref()` from `ViewerCta` — this
 * component must never be handed a raw payload value. `label` is untrusted and
 * is bound as text only; there is no `v-html` in this feature.
 */
defineProps<{
  /** Already gated by `safeStoryHref`; `null` never reaches this component. */
  href: string;
  label: string;
}>();
</script>

<template>
  <UButton
    :to="href"
    :label="label"
    size="lg"
    block
    target="_blank"
    rel="noopener noreferrer"
    :ui="{
      // `bg-white/10` is a FLAT translucent fill, not a backdrop blur: a blurred
      // fill over an unpredictable photo is a contrast gamble, and blur is
      // banned in this feature. The border and the 700-weight label are what
      // carry legibility instead.
      base: 'h-12 w-full rounded-2xl border border-white/25 bg-white/10 text-white transition-colors duration-200 ease-out hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white active:scale-[.98] motion-reduce:active:scale-100',
      label: 'truncate text-sm font-bold',
    }"
  />
</template>
