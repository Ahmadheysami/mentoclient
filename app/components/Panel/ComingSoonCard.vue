<script setup lang="ts">
/**
 * One capability this panel will have and does not have yet — a ROW inside the
 * grouped roadmap card the page draws, not a card of its own.
 *
 * ## NOTHING HERE IS A LINK, AND THAT IS THE DESIGN
 *
 * There is no `<NuxtLink>`, no `<button>`, no `role`, no `tabindex`, no `hover:`
 * and no `active:scale`. The whole point of this component is that a reader must
 * not be able to mistake it for a destination, so it is given **no affordance at
 * all** — a pointer rests on it and nothing lights up, a keyboard tab stops on
 * it and nothing happens, and the only signal is the «به‌زودی» badge saying so
 * in words rather than in styling alone.
 *
 * That is also why it is NOT a `disabled` button: `disabled` still advertises a
 * control that exists and cannot be pressed, which is a promise this panel has
 * not made. This is a static row of information, the way a roadmap is.
 *
 * ⚠️ **THE BADGE IS NOT AN AFFORDANCE EITHER, AND IT IS THE WHOLE SIGNAL.** It says
 * the same thing the absence of a link says, in words — which is the point of it
 * having a label at all. A dot or an icon alone would say "not yet" only to a reader
 * who already knew what the glyph meant, and the badge must survive on a page whose
 * only other status word is in a store error.
 *
 * ## WHY THE DASHED OUTLINE WENT, AND WHAT REPLACED IT
 *
 * This row used to be a card of its own with a dashed `border`, and there were two
 * reasons for that: it had to read as "part of this page and not a lesser kind of
 * thing", and it had to not be mistaken for the tappable card beside it. The page
 * now draws ONE grouped card around all five, so the first reason is answered by
 * the container — and the second is answered better by the outline being gone: a
 * dashed rectangle is a boundary the eye reads as an edge, so five of them made a
 * picket fence at the bottom of a page whose whole argument is calm. Subordination
 * is now carried by the badge and by the absence of any hover. The section's own
 * heading is NOT dimmed to help — `x-text-muted` measures 2.27:1 on the page ground,
 * so the hierarchy is carried by surfaces and by order instead of by type colour.
 *
 * ## THE BADGE IS THE MEASURED AMBER, USED AS A STATUS AND NOTHING ELSE
 *
 * `color="warning"` is still the app's own semantic for "in progress" — it is the
 * same value `Plan/MyStatus.vue` and `Astrology/Form.vue` already reach for, and it
 * is what the theme resolves against — but the paint is the reference's measured
 * amber rather than the theme's orange: `bg-x-gold-200` with a `gold-500` dot.
 * Amber appears in `docs/design/big-panel-reference.jpg` at 1.9% of its pixels and
 * only ever as a status dot next to something true, which is exactly what
 * «به‌زودی» is. It is therefore allowed here and only here: as a SURFACE it would
 * be a fifth hue on a page whose colour weight is sky and lime, and a large amber
 * area is the loudest thing on the screen.
 *
 * ⚠️ **THE PAIR IS 5.45:1, AND IT USED TO BE 4.42:1.**
 * `x-gold-700` on `x-gold-200` (#fdf0b8) first measured 4.42:1 — a hair under AA's
 * 4.5:1 for an 11px label. The reference's own amber is `#f5d847`, which is far too
 * light to be a text colour on anything, so the label is a darkened step of the same
 * hue rather than the measured fill itself: `#8a6a0f` -> `#7a5c0b` takes it to 5.45:1
 * and is one token in `main.css` and nothing else. The hue is unchanged, so the badge
 * still belongs to the reference's amber; only its depth moved.
 *
 * The `gold-500` hairline stays on the badge for a different reason than the label
 * did: `x-gold-200` on the white row measures 1.15:1, so the fill alone gives the
 * badge no edge at all, and it is the ring that makes it read as a pill.
 *
 * `UBadge` stays the element rather than a hand-rolled `<span>`, and the gold is
 * passed in `:ui.base` — which Nuxt UI merges LAST through `tailwind-merge`, so
 * these classes win over the theme's `bg-warning/10` rather than racing it in CSS
 * source order. The dot is the default slot's first child, which is where the
 * badge's own `gap` puts it.
 *
 * ## THE NAME WRAPS AND IS NEVER TRUNCATED
 *
 * The contract on `name` is VERBATIM — never translated, never reworded — and a
 * clipped product name (`AI-Powered Accou…`) is a mis-spelling rather than a
 * summary. So the title wraps (`line-clamp-2`) instead of ellipsising, and it sits
 * inside a `<bdi>` so the bidi algorithm treats a Latin run as one left-to-right
 * island inside this RTL page rather than reordering its words around the
 * neighbouring Persian text. Today's five names are Persian and would survive
 * either way; the wrapper is here because the contract is the name, not today's
 * value of it.
 *
 * The `<bdi>` also keeps a bare wrapper element around it, because `line-clamp-2` is
 * implemented as `display: -webkit-box` and an inline `<bdi>` is not a box.
 */
defineProps<{
  /** An Iconify name from the LOCALLY bundled `solar` collection. */
  icon: string;
  /** The name, VERBATIM. Never translated, never reworded. */
  name: string;
  /** The Persian line that says what this feature will be for. */
  description: string;
}>();
</script>

<template>
  <div class="flex items-start gap-3 py-3">
    <!--
      `items-start` rather than `items-center` because the name may take two lines
      while the badge takes one: centring would float the badge against the second
      line of a title it does not belong to.

      `bg-x-mist-100` rather than the old blue tint: the row's own ground is the
      white grouped card, and a chip that has to separate from white without
      introducing a hue is the warm neutral's job. The glyph is the ink token — 13.5:1
      on `#f2f2f1` — and the chip is `aria-hidden`, because the Persian name beside it
      is what identifies the row.
    -->
    <span
      class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-mist-100 text-x-text-title"
      aria-hidden="true"
    >
      <UIcon :name="icon" size="20" />
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex items-start gap-2">
        <span class="min-w-0 flex-1 line-clamp-2">
          <bdi class="font-yekan-bold text-sm text-x-text-title">{{ name }}</bdi>
        </span>

        <UBadge
          color="warning"
          class="shrink-0"
          :ui="{
            base: 'gap-1.5 rounded-full bg-x-gold-200 px-2 py-0.5 text-[11px] leading-5 font-medium text-x-gold-700 ring-1 ring-x-gold-500/40',
          }"
        >
          <!-- `aria-hidden`: the word beside it already says the whole thing. -->
          <span class="size-1.5 shrink-0 rounded-full bg-x-gold-500" aria-hidden="true" />
          به‌زودی
        </UBadge>
      </div>

      <p class="mt-1 line-clamp-2 text-xs leading-6 text-x-text-subtitle">
        {{ description }}
      </p>
    </div>
  </div>
</template>
