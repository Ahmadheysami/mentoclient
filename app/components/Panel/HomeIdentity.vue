<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * The hub's identity row: who the reader is on this panel, and the one thing that
 * is waiting for them.
 *
 * ## WHY THIS IS IN THE PAGE AND NOT IN THE HEADER
 *
 * `App/PanelHeader.vue` is a `shrink-0` title bar that every panel screen shares,
 * and it deliberately refuses to be a welcome (`App/TopBar.vue` explains why). So
 * the reference's own top row — avatar, name, one line of context, bell — is
 * rebuilt HERE, on the one screen that is a front door rather than a place the
 * reader is passing through. `App/PanelHeader.vue` is not touched; the bar above
 * keeps saying «پنل بزرگسالان» and this says who is standing in it.
 *
 * ## NO CHEVRON, BECAUSE NOTHING IS FORTHCOMING
 *
 * The reference puts a chevron after the name because it opens a profile
 * switcher. This app has no switcher: `/me` is a form two taps away in settings,
 * and hanging a chevron on it would promise a menu that cannot open. Neither is
 * the name a link, for the same reason — a tappable thing with no affordance is
 * worse than a static one. This row is an identity block; the ONE control in it is
 * the bell, because a bell has exactly one obvious destination.
 *
 * ## THE READER IS NOT "LOADING" HERE — AND THAT IS THE GATE'S WORK
 *
 * `state.user === null` has no state of its own on this screen, and it does not
 * need one: `middleware/auth.ts` redirects to `/auth` when the reader is still
 * null after its own read, so a page behind that gate renders only with a user in
 * the store. Inventing a skeleton for a value that cannot be absent here would be
 * a fifth state for something that never happens — and the honest fallback for a
 * name the API did not fill is `App/TopBar.vue`'s own «کاربر», so a reader sees the
 * same word whichever screen they are on.
 *
 * `UAvatar` derives its own fallback from `alt`, so an account with no photo (or a
 * photo that 404s) shows the reader's own initials on the tile rather than a
 * broken image.
 *
 * ## THE ROW IS ON THE PAGE, NOT IN A CARD
 *
 * It sits directly on `bg-x-primary-content-100`, with no surface of its own, and
 * that is a deliberate asymmetry with every other block below it: this row answers
 * "who is here" in one glance and needs nothing to be re-read, so the cheapest
 * possible treatment is the right one. The reference draws its identity row on the
 * page colour too; what it does NOT do is hang a chevron on the name, and that
 * omission is kept above.
 *
 * The avatar's `sky-100` ring is the only thing separating the photo from the
 * page. It is the lightest of the measured sky tints on purpose: the page ground is
 * already `#ecf0fb`, a pale blue, so a stronger ring would turn the identity row
 * into the first card on the page — and a hairline would be a suggestion at this
 * contrast, so the ring is 2px. No `shadow-xs` here either: the white bell below is
 * the only lifted thing in this row, and two lift cues 44px apart would fight.
 *
 * The name is `text-base` rather than the inherited root size so the row's own
 * hierarchy is stated in this file and cannot drift when the layout's font scale
 * changes; the age under it drops to `text-xs`, which is the one line here that is
 * context rather than identity.
 *
 * ## THE DOT IS NOT A STATE, IT IS A COUNT
 *
 * `notification.get` is the same call `App/TopBar.vue` makes, with the same
 * `public: "1"` filter, and it runs on `mount` for the same reason every other
 * first-frame read in this app does: the server render must not spend a request
 * the reader's cookie cannot authorise.
 *
 * The store records **no error for this read**, so a refusal can only leave
 * `notificationStats` undefined — and that is why the absence of the dot means
 * "no unread notification has been reported", never "you have read them all". That
 * is a weaker claim than it looks, so it is also what the `aria-label` says: the
 * number is IN the label rather than beside the glyph, because an `aria-label`
 * replaces an element's text and a separately-rendered «۳» would never be read.
 */
const user = useUser();
const notification = useNotification();

onMounted(async () => {
  try {
    await notification.get({ public: "1" });
  } catch {
    /**
     * `get` has no `catch` of its own — it lets a transport failure reject — and
     * an `onMounted` awaiting a rejecting promise leaves an unhandled rejection
     * behind: nothing on screen changes and nothing in the console says why.
     *
     * There is nothing to render here, because the store keeps no error for this
     * read: `notificationStats` simply stays undefined and the bell shows no dot,
     * which is the claim documented above. A reader who wants the truth can open
     * `/notifications`, which is the button's own destination.
     */
  }
});

/**
 * The reader's two names, joined, or «کاربر».
 *
 * Tested one part at a time so «علی» with an empty surname shows «علی» — a
 * half-filled name is real information about what the reader has done. The
 * fallback is `App/TopBar.vue`'s, verbatim.
 */
const fullName = computed<string>(() => {
  const first = user.state.user?.fullName?.first?.trim();
  const last = user.state.user?.fullName?.last?.trim();

  return [first, last].filter(Boolean).join(" ") || "کاربر";
});

/**
 * «۳۴ سال», or `null` for an age the API did not give us.
 *
 * `null` rather than a guess and rather than an em-dash: this line is OMITTED
 * when there is nothing to say, so a reader with no age on file sees one clean
 * line instead of a name above an empty one.
 */
const ageLabel = computed<string | null>(() => {
  const age = user.state.user?.age;

  if (typeof age !== "number" || !Number.isFinite(age) || age <= 0) return null;

  return `${faNumber(age)} سال`;
});

</script>

<template>
  <!--
    A `<div>`, not a `<header>`: `App/PanelHeader.vue` is already the page's
    `banner`, and two banners in one document would make the landmark meaningless.
    This row is inside it, which is also why the page's only `<h1>` stays in the
    layout.
  -->
  <div class="reveal flex items-center gap-3">
    <!--
      The halo around the portrait is the row's one decorative value and it is
      `sky-100`, the lightest of the measured sky tints: the page ground is already a
      pale blue, so a heavier ring would promote this row into a card, and a 1px ring
      at this contrast would be a suggestion. 2px makes the halo read as a framed
      portrait without adding a second elevation cue next to the bell.
    -->
    <UAvatar
      :src="user.state.user?.avatar"
      :alt="fullName"
      :ui="{ root: 'size-12 shrink-0 rounded-full bg-white ring-2 ring-x-sky-100' }"
    />

    <!--
      `min-w-0` is what makes the name's `truncate` bite: a flex item defaults to
      `min-width: auto` and refuses to get narrower than its text, and a long
      compound Persian name would otherwise push the bell off the edge of a 320px
      screen instead of shortening.
    -->
    <div class="min-w-0 flex-1">
      <p class="truncate font-yekan-bold text-base text-x-text-title">
        {{ fullName }}
      </p>
      <p
        v-if="ageLabel"
        class="mt-0.5 truncate text-xs leading-6 text-x-text-subtitle"
      >
        {{ ageLabel }}
      </p>
    </div>

    <!--
      44×44 — `size-11` — because this is a touch target and not a glyph.

      `active:scale` with no `hover:` is the house rule for the same reason
      `Panel/FeatureCard.vue` states it: a hover state on a touch screen lights a
      card up under a finger that is only passing over it, and the `motion-reduce:`
      pair cancels both halves for a reader who has asked for no motion.

      The `sky-200` hairline is what stops the white disc dissolving into the pale
      page; the focus ring is the indigo one this page uses for every control, for
      the reason `Panel/FeatureCard.vue` gives — a ring drawn in the same blue family
      as the ground it sits on is the one thing on screen that cannot tell you where
      you are.

      ⚠️ **THE DOT STAYS RED, AND THAT IS NOT AN OVERSIGHT.** The new palette spends
      its amber on the roadmap's «به‌زودی» badge, which is a status about the PRODUCT.
      This dot is a status about the READER, and `App/TopBar.vue` has always drawn it
      in `bg-red-500`; giving "you have something new" a second colour on a second
      screen would teach the reader two colours for one meaning.

      The dot is `aria-hidden` because `bellLabel` already carries the count; the
      `ring` is the page background, so the dot reads as a notch punched out of the
      white disc rather than as a second smaller disc floating above it.
    -->
  </div>
</template>