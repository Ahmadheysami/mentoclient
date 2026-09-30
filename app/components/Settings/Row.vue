<script setup lang="ts">
/**
 * The shared unit of every settings list: an icon disc, the label, and a
 * control on the inline-end.
 *
 * The root is a real `<NuxtLink>` or a real `<button>`, so it is reachable,
 * activatable and announced by the platform with no `role`, no `tabindex` and
 * no key handler.
 *
 * `as="row"` is the one escape from that, and it is not optional: a switch row
 * carries its own `USwitch` in the slot, and a `<button>` inside a `<button>`
 * is invalid HTML that a keyboard user cannot reach at all — the inner control
 * is unfocusable and the outer one swallows the key. Those rows render a plain
 * `<div>`, put the whole title block in a `<label for>`, and let the browser
 * wire the tap to the switch the way Telegram's rows behave.
 */
const props = withDefaults(
  defineProps<{
    icon: string;
    title: string;
    description?: string;
    to?: string;
    /** Colour the icon and the title as an action that removes something. */
    danger?: boolean;
    as?: "button" | "row";
    /** `id` of the control in the slot; only read in `row` mode. */
    labelFor?: string;
  }>(),
  { description: undefined, to: undefined, danger: false, as: "button", labelFor: undefined },
);

const emit = defineEmits<{ activate: [] }>();

/** `NuxtLink` has to be resolved, not named: a string `:is` would not pick it up. */
const NuxtLinkComponent = resolveComponent("NuxtLink");

const isLink = computed<boolean>(() => Boolean(props.to));
const isRow = computed<boolean>(() => !props.to && props.as === "row");
</script>

<template>
  <component
    :is="isLink ? NuxtLinkComponent : isRow ? 'div' : 'button'"
    :to="to"
    :type="isLink || isRow ? undefined : 'button'"
    class="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-start last:border-b-0"
    :class="isLink || isRow ? '' : 'transition-colors duration-150 ease-out'"
    @click="isLink || isRow ? undefined : emit('activate')"
  >
    <!--
      The disc, on the inline-start — the physically-RIGHT side in this
      hard-coded RTL app, the same edge every other leading icon in the app
      sits on. `aria-hidden`, because the label beside it already says what the
      row is; a screen reader announcing the glyph name on top of that is noise.
    -->
    <span
      class="grid size-9 shrink-0 place-items-center rounded-full"
      :class="danger ? 'bg-red-50 text-red-500' : 'bg-x-primary-100 text-x-primary-700'"
      aria-hidden="true"
    >
      <UIcon :name="icon" size="20" />
    </span>

    <component
      :is="labelFor ? 'label' : 'div'"
      :for="labelFor"
      class="min-w-0 flex-1"
    >
      <span
        class="block truncate text-sm font-bold"
        :class="danger ? 'text-red-500' : 'text-x-text-title'"
      >
        {{ title }}
      </span>
      <span
        v-if="description"
        class="mt-0.5 block text-xs leading-5 text-x-text-subtitle"
      >
        {{ description }}
      </span>
    </component>

    <!--
      `ms-auto` pushes the control onto the inline-end, which is the physical
      LEFT here, so the label keeps the inline-start edge the way it does
      everywhere else on the screen.

      `min-w-0` + `overflow-x-auto` rather than `shrink-0`: a three-pill
      segmented control plus a 36px disc plus padding is about 380px, which
      overflows a 320px phone. Letting the CONTROL scroll is the compromise
      Telegram makes too — the icon and the label never move, and the pills
      that do not fit are one swipe away. `[overscroll-behavior-x:contain]`
      stops that swipe from chaining to the page scroller.
    -->
    <span
      class="ms-auto flex min-w-0 items-center overflow-x-auto pe-0.5 [overscroll-behavior-x:contain]"
    >
      <slot />
    </span>
  </component>
</template>
