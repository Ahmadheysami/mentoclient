<script setup lang="ts">
import { safeStoryAccent } from "~/types/story";
import type { StoryColorizedLink } from "~/types/story";

/**
 * The "colorized" story CTA: the advert treatment — a two-stop gradient, an
 * accent tile, a subtitle and a hover-lift.
 *
 * A plain `<a>`, not `UButton`: it needs a gradient background, a tile, a
 * subtitle and a hover-lift, and forcing all of that through `UButton`'s single
 * `base` slot buys nothing while inheriting `truncate` on the wrong node.
 *
 * `label` / `description` are untrusted and are `{{ }}` text only. `accent` has
 * already been through `safeStoryAccent` upstream; the CSS fallbacks below are
 * the house brand pair (`x-primary-500` / `x-secondary-500`), so a missing or
 * rejected accent can never produce an off-brand or invisible button.
 */
const props = defineProps<{
  link: StoryColorizedLink;
  /** Already gated by `safeStoryHref`; `null` never reaches this component. */
  href: string;
}>();

const accentVars = computed(() => {
  const accent = safeStoryAccent(props.link.accent);

  // `undefined` (not an empty object) so the `.story-cta` CSS fallbacks apply.
  return accent
    ? ({ "--story-cta-from": accent[0], "--story-cta-to": accent[1] } as const)
    : undefined;
});

/** The only icon collection installed locally (`@iconify-json/solar`). */
const DEFAULT_ICON = "solar:link-circle-linear";

/**
 * The icon name is untrusted and needs an allow-list for a RUNTIME reason, not a
 * cosmetic one: `@nuxt/icon` serves the locally installed collection from its own
 * bundle, but for any other collection it falls back to the PUBLIC Iconify API —
 * `@iconify/vue`'s `loadIcon`, called from the browser. A payload of
 * `<attacker-collection>:x` would therefore make every reader's browser contact a
 * third party with its IP. An unknown name rendering as *nothing* is irrelevant
 * here: the request is made before anyone can see whether it rendered.
 */
const icon = computed(() => {
  const name = props.link.icon;

  return name?.startsWith("solar:") ? name : DEFAULT_ICON;
});
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="story-cta group flex w-full items-center gap-3 rounded-3xl p-3 text-start no-underline outline-none transition-transform duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[.99] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transform-none"
    :style="accentVars"
  >
    <span
      class="grid size-11 shrink-0 place-items-center rounded-2xl bg-black/25 text-white"
    >
      <!-- Allow-listed to `solar:` above; anything else falls back to the link
           glyph. See the `icon` docblock for why an unknown name is not
           harmless. -->
      <UIcon :name="icon" size="22" aria-hidden="true" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-bold text-white">{{ link.label }}</span>
      <span
        v-if="link.description"
        class="block truncate text-[11px] text-white/75"
      >
        {{ link.description }}
      </span>
    </span>

    <!--
      Forward is LEFTWARD in RTL, so the affordance is a left arrow and its
      hover nudge is `-translate-x-1`, not `+`. Same icon `Ui/StateMessage.vue`
      already uses for "go".
    -->
    <UIcon
      name="solar:alt-arrow-left-linear"
      size="20"
      aria-hidden="true"
      class="shrink-0 text-white transition-transform duration-200 ease-out group-hover:-translate-x-1 motion-reduce:transform-none"
    />
  </a>
</template>

<style scoped>
.story-cta {
  /* The fallbacks are the HOUSE BRAND PAIR, published by the viewer root as
     `--story-accent-*`, so a missing or rejected accent can never produce an
     off-brand or invisible button. The innermost literals are the fallback of
     that fallback, so the component is still correct outside a viewer. */
  background-image: linear-gradient(
    135deg,
    var(--story-cta-from, var(--story-accent-from, #2b7fff)),
    var(--story-cta-to, var(--story-accent-to, #7c86ff))
  );
  /* Sharp, coloured elevation. `box-shadow` is allowed on this feature;
     `filter: blur()` / `backdrop-blur-*` / `drop-shadow-*` are not. */
  box-shadow: 0 8px 20px -10px var(--story-cta-to, var(--story-accent-to, #7c86ff));
}

@media (prefers-reduced-motion: reduce) {
  .story-cta {
    transition: none;
  }
}
</style>
