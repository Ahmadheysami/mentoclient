<script setup lang="ts">
/**
 * The cafe navigation pill — Screen A's bottom bar.
 *
 * ## WHY IT IS A NEAR-BLACK PILL AND NOT A WHITE BAR WITH LABELS
 *
 * The design this slice was drawn from (Screen A of `docs/design/cafe-ui.webp`)
 * is an iOS-style messenger: four icons in one rounded-full black pill, floating
 * above the home indicator with generous side margins, and **no visible labels**.
 * That is not decoration — it is what lets the pill float over a long scrolling
 * list without the list having to reserve 88px of dead space behind it, and it
 * is why `bottom-0` + `inset-x-0` (not a bar in the flow) is correct here.
 *
 * Dropping the labels costs the four links their visible names, so **every link
 * carries both an `aria-label` and an `sr-only` span**. The span is not
 * redundancy: `aria-label` is what a screen reader announces, and the `sr-only`
 * text is what makes the name exist in the accessibility tree for anyone reading
 * the DOM. An icon-only navigation that forgets this is four unlabelled
 * controls.
 *
 * ## WHY THE ACTIVE STATE IS A CLASS AND NOT A `<style scoped>` RULE
 *
 * The previous version styled `router-link-exact-active` from a scoped
 * `<style>` block with a `::before` pseudo-element and a `z-index: -1`. Three
 * things were wrong with that:
 *
 * 1. A `z-index: -1` chip paints *behind the parent's background* whenever the
 *    parent has one, which is exactly why the chip was invisible on the pill.
 * 2. The colour came from a custom property rather than a token utility, so it
 *    could not be overridden by the same one class the rest of the cafe feature
 *    styles itself with.
 * 3. It was invisible in the template, so nobody reading `BottomMenu.vue` could
 *    tell the active state existed.
 *
 * `router-link-exact-active` is still what decides it — Vue Router puts the
 * class on the element, which keeps the "exact" semantics (`/cafe` must not
 * light up while `/cafe/joined` is open) — but it is now *bound* to a token
 * class on a real child element, which is inspectable and overridable.
 *
 * ## WHY IT IS `absolute` AND NOT `fixed`
 *
 * `layouts/cafe.vue` marks its `max-w-md` root `relative`, so `inset-x-0` here
 * resolves against the **phone column** and not the viewport. That is what keeps
 * the pill centred in the frame on a wide browser instead of glued to the edge
 * of the screen. `layouts/cafe.vue` also hides this component entirely on a
 * screen that declares `cafeMenu: false`.
 */
const route = useRoute();

const items = [
  { label: "تنظیمات", icon: "solar:settings-linear", to: "/cafe/settings" },
  { label: "کافه‌ها", icon: "solar:cup-hot-linear", to: "/cafe" },
  { label: "میزهای پیوسته", icon: "solar:chat-round-linear", to: "/cafe/joined" },
  { label: "گفتگو", icon: "solar:dialog-2-linear", to: "/cafe/chat" },
] as const;

/**
 * Exact-match, and it is exact on purpose.
 *
 * `router-link-exact-active` would do the same job, but reading the path here
 * makes the decision visible in the template next to the classes it picks, and
 * keeps the whole active state in one place instead of split between a class
 * Vue Router adds imperatively and a class bound declaratively. A string compare
 * also cannot silently light `/cafe` up while `/cafe/joined` is open, which is
 * the case a prefix match would get wrong and the reason the old rule was
 * called "exact".
 */
const isActive = (to: string): boolean => route.path === to;
</script>

<template>
  <nav
    class="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
    aria-label="منوی کافه"
  >
    <!--
      `pb-[max(1rem,env(safe-area-inset-bottom))]`: on a home-indicator phone a
      fixed padding leaves the pill under the bar the OS draws. `max(…)` keeps
      the visual padding everywhere and grows only where the inset is real — the
      same recipe `ComposerShell` uses.

      The pill is 44 + 28 = 72px tall and sits 16px + the safe-area inset above
      the edge, so `CafeFabMenu`'s `bottom-24` (96px) clears it on every device.

      `pointer-events-none` on the nav and `auto` on the four links: the nav is a
      full-bleed strip, and a transparent strip that eats taps is a row of the
      list underneath that silently does nothing.
    -->
    <div
      class="mx-auto flex w-fit items-center gap-7 rounded-full bg-x-text-title px-6 py-3.5"
    >
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :aria-label="item.label"
        class="pointer-events-auto grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500"
        :class="
          isActive(item.to) ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
        "
      >
        <UIcon :name="item.icon" size="22" aria-hidden="true" />
        <span class="sr-only">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>