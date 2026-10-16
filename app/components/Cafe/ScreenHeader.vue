<script setup lang="ts">
/**
 * The native top bar for every cafe screen that is NOT a conversation.
 *
 * Two shapes, one component, because they differ only in type size and whether
 * there is something to go back to — and two components would let the padding,
 * the ground and the hairline drift apart the moment either one is touched.
 *
 * ## `large` — Screen A's "Messages"
 *
 * A big bold title with a quiet line under it, and actions on the far side. This
 * is the iOS/Android **large-title** pattern: a root screen has no back button
 * (there is nowhere to go back to) and gets the space instead, and the list
 * underneath starts immediately under it.
 *
 * `back` defaults to `false` here, so a root screen cannot accidentally draw a
 * chevron pointing at the previous root.
 *
 * ## `compact` — every nested screen
 *
 * A fixed `h-14` row: back chevron, leading slot, title, trailing actions, and
 * a `#below` slot for a search field hanging under the hairline.
 *
 * ## WHY THE BACK CHEVRON IS THE **FIRST** DOM NODE, NOT THE LAST
 *
 * This app is hard-coded `dir="rtl"`, so the first child of a flex row renders
 * at the physical **right** and `inline-end` is the physical **left**.
 *
 * `docs/design/cafe-ui.webp` is an **LTR** mockup whose back chevron sits at the
 * far physical left. Mirroring it — which the brief requires, and which is also
 * what every Persian RTL app does, because a reader's thumb reaches the top-right
 * corner — puts the chevron at the physical **right**. In this app's own
 * vocabulary that is the **inline-start**, and the only way to write it without a
 * physical `right-0` is to be first in the DOM.
 *
 * So this is the one place in the cafe feature where "inline-end" in a design
 * note has to be read as "the far end of the bar in the mockup's own frame",
 * not as `end-4`. `ChatHeader` — the chat-shaped header — is laid out the same
 * way and for the same reason.
 *
 * The chevron icon itself is `solar:alt-arrow-left-linear`: the glyph points
 * **left**, which after the mirror means "back toward the previous screen" for an
 * RTL reader. A chevron rotated to point right here would point the reader
 * forward.
 *
 * ## WHY THE BACK LINK IS ≥44×44
 *
 * 44px is the smallest reliably hittable target on a phone (Apple's HIG and
 * Material both land there). The chevron glyph is 22px, so the touch target is
 * carried by the box, not the ink — and the `focus-visible` ring is drawn on that
 * same box, so a keyboard user sees a target the size of the thing they can
 * press.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    /** The quiet line under a large title. Ignored by `compact` beyond the row. */
    subtitle?: string;
    variant?: "large" | "compact";
    /**
     * `true` for the default route, or an explicit path to go back to.
     * Defaults to `true` in `compact` and `false` in `large`, so a nested screen
     * gets its chevron for free and a root screen cannot have one by accident.
     */
    back?: boolean | string;
  }>(),
  {
    variant: "large",
    /*
     * ⚠️ `back: undefined` IS THE POINT and must not be "cleaned up".
     *
     * Vue's **boolean casting**: a prop whose type includes `Boolean` and which
     * the caller did not pass is cast to `false` — not left `undefined` — unless
     * the prop declares a default. `back` needs to be *absent* when the caller
     * said nothing, because `showBack` below decides the variant's default from
     * it, and a silent `false` would take the chevron away from every `compact`
     * header in the app while looking, in review, like a working conditional.
     * Declaring `default: undefined` is the documented way to opt out.
     */
    back: undefined,
  },
);

/**
 * A `compact` header is always nested inside something, so it gets a chevron;
 * a `large` header is a root, so it does not. `withDefaults` cannot express a
 * default that depends on another prop, so the rule lives here instead — where
 * it can be read — rather than in the template at every use site.
 */
const showBack = computed(() =>
  props.back ?? props.variant === "compact",
);

/** `true` (the default) means "back", a string means "back to exactly here". */
const backTo = computed(() => (typeof props.back === "string" ? props.back : undefined));
</script>

<template>
  <header
    class="shrink-0 bg-x-primary-content-50"
    :class="variant === 'compact' ? 'border-b border-slate-200' : ''"
  >
    <!--
      `compact`. `px-2` rather than `px-4`: the chevron's box is 44px wide, so
      `px-4` would push the title 12px further from the edge than the reference
      draws it and give the row two different left margins.
    -->
    <div
      v-if="variant === 'compact'"
      class="flex h-14 items-center gap-2 px-2"
    >
      <NuxtLink
        v-if="showBack"
        :to="backTo"
        aria-label="بازگشت"
        class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors hover:bg-x-primary-content-200"
      >
        <UIcon name="solar:alt-arrow-left-linear" size="22" aria-hidden="true" />
      </NuxtLink>

      <slot name="leading" />

      <!--
        `min-w-0` on the body is what lets a long café name ellipsise instead of
        pushing the actions off the edge; the actions themselves are after it in
        the DOM and are never the ones that shrink.
      -->
      <div class="min-w-0 flex-1 px-1">
        <p class="truncate text-[15px] font-bold text-x-text-title">
          {{ title }}
        </p>
        <p v-if="subtitle" class="line-clamp-1 text-xs text-x-text-subtitle">
          {{ subtitle }}
        </p>
      </div>

      <slot name="actions" />
    </div>

    <!--
      `large`. No hairline under the title: Screen A draws the search pill
      immediately below it with white between them, and a rule here would cut the
      header off from the screen it titles.

      `text-2xl` (24px) rather than the reference's ~28px: Yekan's cap-height and
      x-height are larger than the mockup's typeface at the same nominal size, and
      «گفتگوهای شما» at 28px overflows a 448px column the moment a title is long.
    -->
    <div v-else class="px-4 pt-4 pb-2">
      <div class="flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl leading-none font-bold text-x-text-title">
            {{ title }}
          </h1>
          <p v-if="subtitle" class="mt-2 text-sm text-x-text-subtitle">
            {{ subtitle }}
          </p>
        </div>

        <slot name="actions" />
      </div>
    </div>

    <!--
      `#below` hangs under the hairline rather than inside the bar, so a search
      field keeps its own vertical rhythm and the 56px row stays 56px. Only
      meaningful next to `compact` — with `large` it lands directly under the
      title, which is also where Screen A puts its search pill.
    -->
    <slot name="below" />
  </header>
</template>