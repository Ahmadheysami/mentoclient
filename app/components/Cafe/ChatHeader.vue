<script setup lang="ts">
/**
 * The conversation's own top bar — Screen B's header.
 *
 * ## WHY THIS IS NOT `CafeScreenHeader variant="compact"`
 *
 * Because the two are not the same bar. A nested screen's header is a title with
 * optional leading and trailing decoration; a conversation's header is an
 * *identity* — a face, a name, and who is there — with one action of its own.
 * Sharing one component would mean a union of two slot sets and four
 * `variant`-conditional branches to describe the difference, which is worse than
 * two small honest files. They keep the same padding scale, the same hairline,
 * the same 44px target and the same ink, so they still look like one system.
 *
 * ## THE ORDER, AND WHY IT IS WRITTEN OUT RATHER THAN LEFT TO THE READER
 *
 * **back chevron → avatar → name → spacer → ⋯**, which in this app's hard-coded
 * RTL renders right-to-left: the chevron at the physical right, the overflow
 * control at the physical left.
 *
 * That is the mirror of `docs/design/cafe-ui.webp` (an LTR mockup with the
 * chevron at the far physical left and the call icons at the far right), and it
 * is what every Persian RTL app does. Note the consequence for anyone editing
 * this later: **the chevron is the FIRST child even though it is at the far
 * inline-end of the mockup.** Putting it last would silently move it to the
 * physical left and un-mirror the whole bar.
 *
 * ⚠️ The `⋯` was added in the messaging wave, and it is not decoration: doc §7's
 * table-level report and §6's leave have no other entry point anywhere in the
 * feature. It emits and does nothing else — the sheet it opens belongs to the
 * screen (`CafeTableMenu`), for the same reason the chevron emits nothing and
 * `to`s instead.
 *
 * The spacer is `flex-1` rather than a centred absolute title because the name
 * has to be allowed to grow and ellipsise — a centred title fights an action
 * button for the same 44px on a 360px phone, and the name always loses.
 *
 * ## ⚠️ THERE ARE NO CALL BUTTONS, AND THEIR ABSENCE IS A DECISION
 *
 * This bar used to draw a video and a phone icon, both permanently `disabled`
 * because Phase 1 wires no socket call, no call state and no permission prompt.
 * They are removed rather than left inert: 88px of a 360px bar spent on two
 * controls that can only ever refuse — announced to a screen reader as «تماس
 * تصویری» and «تماس صوتی» with nothing behind them — is the product promising a
 * feature it does not have, and `docs/X123ApiDocs.md` carries no call endpoint in
 * any of its sections, so nothing about them is one phase away from working.
 *
 * `online` and the `⋯` stay, and `online` is still a real prop: presence arrives
 * with the socket's `cafe:table:join-new-user`.
 */
const props = withDefaults(
  defineProps<{
    /** The table's own name. ⚠️ `nikname` is misspelled in the backend model. */
    nikname?: string | null;
    /** The quiet line under the name: member count, «آنلاین», … */
    subtitle?: string;
    profileImage?: string | null;
    /** Draws `CafeAvatar`'s presence dot. */
    online?: boolean;
    /** Where the chevron goes. Defaults to the joined/café list it was opened from. */
    to?: string;
    /**
     * Persian label for the overflow control. ⚠️ It comes from the caller
     * because the ONLY thing a `⋯` can mean on a bar that also has «بازگشت» is
     * given by the screen it is on: «گزینه‌های گفتگو» here, «گزینه‌های میز» on a
     * list screen.
     */
    overflowLabel?: string;
  }>(),
  {
    to: "/cafe/joined",
    overflowLabel: "گزینه‌های گفتگو",
  },
);

const emit = defineEmits<{
  /** The `⋯` was pressed. The caller owns the sheet it opens. */
  overflow: [];
}>();

/** A blank `nikname` is a missing name, not a nameless table. */
const name = computed(() => props.nikname?.trim() || "گفتگو");

/**
 * One `aria-label` for the whole bar's leading identity, so a screen reader
 * arriving at the chevron reads «گفتگو» with it rather than three separate
 * announcements of avatar, name and subtitle.
 */
const accessibleName = computed(() =>
  props.subtitle ? `${name.value}، ${props.subtitle}` : name.value,
);
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-x-primary-content-50 px-2"
  >
    <!-- See the file header: FIRST child, on purpose. -->
    <NuxtLink
      :to="to"
      aria-label="بازگشت"
      class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors hover:bg-x-primary-content-200"
    >
      <UIcon name="solar:alt-arrow-left-linear" size="22" aria-hidden="true" />
    </NuxtLink>

    <!--
      Both the chevron and the identity block are real links to `to` rather than
      a button calling `router.back()`: a link has an href the reader can open in
      a new tab, and it still works after a hard refresh, where a history button
      has nothing to go back to. They are redundant on purpose — the avatar is
      the big target, the chevron is the one muscle memory looks for.
    -->
    <NuxtLink
      :to="to"
      :aria-label="accessibleName"
      class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl transition-colors hover:bg-x-primary-content-200"
    >
      <CafeAvatar
        :src="profileImage ?? undefined"
        :name="name"
        :online="online"
        size="sm"
      />

      <span class="min-w-0">
        <span class="block truncate text-[15px] leading-6 font-bold text-x-text-title">
          {{ name }}
        </span>
        <span
          v-if="subtitle"
          class="block truncate text-xs leading-4 text-x-text-subtitle"
        >
          {{ subtitle }}
        </span>
      </span>
    </NuxtLink>

    <!--
      The overflow affordance, and it is LAST — at the far inline-end — because it
      is the least used control on the bar and the one that must never be the
      target a thumb lands on by accident while reaching for the chevron on the
      opposite side.

      ⚠️ It is a real button with `aria-haspopup` rather than a decorative glyph:
      §7's table-level report and §6's leave have NO other entry point in the whole
      feature, so this control is the difference between those actions existing and
      not existing. Its accessible name comes from the caller, which is what tells a
      screen-reader user what the `⋯` opens before opening it.

      `aria-expanded` is not bound here — this header does not own the sheet's open
      state (the caller does), and a hard-coded `false` would be a claim the bar
      cannot keep. `haspopup` states the relationship, which is the half that is
      always true.
    -->
    <button
      type="button"
      :aria-label="overflowLabel"
      aria-haspopup="menu"
      class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors hover:bg-x-primary-content-200"
      @click="emit('overflow')"
    >
      <UIcon name="solar:menu-dots-circle-linear" size="22" aria-hidden="true" />
    </button>
  </header>
</template>