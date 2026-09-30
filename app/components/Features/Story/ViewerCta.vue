<script setup lang="ts">
import { safeStoryHref } from "~/types/story";
import type { StoryLink } from "~/types/story";

/**
 * The single dispatch point for a frame's call to action, and the single place
 * the payload's `url` is allowed to become an `href`.
 *
 * Three outcomes, in this order:
 *   1. no link          → render nothing. The bottom scrim is NOT this
 *                          component's business: `ViewerSlide` draws it from the
 *                          frame's own `v-if="frame.item.link"`, so a linkless
 *                          frame gets no scrim, and a frame whose link is
 *                          REFUSED here still carries an empty one;
 *   2. a link we refuse → render nothing AND warn in dev. Never a
 *                          disabled-looking dead button: a CTA that cannot be
 *                          pressed is worse than no CTA;
 *   3. a link we accept → dispatch on the discriminated union.
 */
const props = defineProps<{
  link?: StoryLink;
}>();

const href = computed(() => (props.link ? safeStoryHref(props.link.url) : null));

// Dev-only, and deliberately a `watch` and NOT a side effect inside the
// `computed` above: a computed is re-evaluated on read, so the warning would
// re-fire on every unrelated re-render. The raw URL is not printed — a refused
// URL can carry a sensitive query string — so only the scheme and host are.
watch(
  () => props.link,
  (link) => {
    if (!link || href.value || !import.meta.dev) return;

    try {
      const { protocol, host } = new URL(link.url.trim());
      console.warn("[story] rejected link protocol", `${protocol}//${host}`);
    } catch {
      console.warn("[story] rejected link protocol (unparsable URL)");
    }
  },
  { immediate: true },
);
</script>

<template>
  <!--
    Exhaustive dispatch on the union: a third `StoryLink['variant']` becomes a
    type error here rather than a silently blank button.
  -->
  <template v-if="href && link">
    <FeaturesStoryLinkSimple
      v-if="link.variant === 'simple'"
      :href="href"
      :label="link.label"
    />
    <FeaturesStoryLinkColorized v-else :link="link" :href="href" />
  </template>
</template>
