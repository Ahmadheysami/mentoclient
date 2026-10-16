<script setup lang="ts">
/**
 * The conversation's own top bar — Screen B's header.
 *
 * ## WHY THIS IS NOT `CafeScreenHeader variant="compact"`
 *
 * Because the two are not the same bar. A nested screen's header is a title with
 * optional leading and trailing decoration; a conversation's header is an
 * *identity* — a face, a name, and who is there — with the two actions a call
 * has. Sharing one component would mean a union of two slot sets and four
 * `variant`-conditional branches to describe the difference, which is worse than
 * two small honest files. They keep the same padding scale, the same hairline,
 * the same 44px target and the same ink, so they still look like one system.
 *
 * ## THE ORDER, AND WHY IT IS WRITTEN OUT RATHER THAN LEFT TO THE READER
 *
 * **back chevron → avatar → name → spacer → video → call**, which in this app's
 * hard-coded RTL renders right-to-left: chevron at the physical right, actions
 * at the physical left.
 *
 * That is the mirror of `docs/design/cafe-ui.webp` (an LTR mockup with the
 * chevron at the far physical left and the call icons at the far right), and it
 * is what every Persian RTL app does. Note the consequence for anyone editing
 * this later: **the chevron is the FIRST child even though it is at the far
 * inline-end of the mockup.** Putting it last would silently move it to the
 * physical left and un-mirror the whole bar.
 *
 * The spacer is `flex-1` rather than a centred absolute title because the name
 * has to be allowed to grow and ellipsise — a centred title fights an action
 * button for the same 44px on a 360px phone, and the name always loses.
 *
 * ## WHY THE CALL BUTTONS RENDER `disabled`
 *
 * Phase 1 wires nothing: there is no socket call, no call state and no permission
 * prompt, so a tappable phone icon would answer a tap with silence. A control
 * that *looks* live and is not is a worse lie than one that is obviously inert,
 * and there is already that exact precedent in `MessageBubble.vue`, whose play
 * button renders disabled for the same reason with the same Persian label so a
 * screen-reader user learns what the card is even when they cannot press it.
 *
 * Both buttons are **optional props**, not hidden-by-default decoration: a
 * voice-only table has no reason to offer a video call, and a Phase 2 page
 * should be able to switch one on by passing one boolean rather than by editing
 * this file.
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
    /** Offer a video call. Phase 1: rendered, inert. */
    video?: boolean;
    /** Offer a voice call. Phase 1: rendered, inert. */
    call?: boolean;
  }>(),
  { to: "/cafe/joined", video: false, call: true },
);

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

    <button
      v-if="video"
      type="button"
      disabled
      aria-label="تماس تصویری"
      class="grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors hover:bg-x-primary-content-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <UIcon name="solar:videocamera-linear" size="22" aria-hidden="true" />
    </button>

    <button
      v-if="call"
      type="button"
      disabled
      aria-label="تماس صوتی"
      class="grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors hover:bg-x-primary-content-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <UIcon name="solar:phone-linear" size="22" aria-hidden="true" />
    </button>
  </header>
</template>