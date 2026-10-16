<script setup lang="ts">
/**
 * The shell every Cafe screen renders inside — the phone column, a screen's own
 * content, and the bottom pill.
 *
 * ## WHY THE COLUMN IS `max-w-md` WITH `border-x`, AND WHY IT IS NOT THE
 * `default` LAYOUT
 *
 * This is a mobile-only app, so the cafe slice is drawn as one `28rem` column
 * centred in the viewport with a hairline on either side of it, exactly as
 * `layouts/default.vue` does — on any viewport wider than the column itself. The
 * difference is the ground: `default.vue` sits on `x-primary-content-100` (the
 * app's soft blue) with an app-wide bottom bar, and both are wrong for a
 * messenger, whose screens are white with a *floating* black pill — Screen A of
 * the reference. So this layout is its own file rather than a `definePageMeta`
 * on the existing one.
 *
 * **`default__layout` is MANDATORY on the root element** — repeated here from
 * `layouts/panel.vue`, not copied by accident. The reader's text-size setting
 * (`html[data-font-scale]`) is implemented in `app/assets/css/main.css` as
 *
 * ```css
 * html[data-font-scale] .default__layout { max-width: calc(28rem / var(--app-font-scale)) }
 * ```
 *
 * — a rule scoped to that ONE class with no fallback selector. A layout that
 * drops it is not merely unstyled: the `max-w-md` column silently stops being
 * divided by the scale factor, so a reader who chose a large text gets a column
 * wider than the phone it was drawn for — in this layout only, while every
 * other screen stays correct.
 *
 * ## WHY THE SHELL ITSELF NEVER SCROLLS
 *
 * `overflow-hidden` on the root, and `<slot>` inside a `flex-1 min-h-0 flex
 * flex-col` column. Every screen owns its own scroller; the shell owns none.
 *
 * That split is the whole reason the bottom pill and the composer stay pinned
 * like a native app instead of scrolling away with the content: a single
 * scrolling root gives the page one scrolling box and no stable bottom edge to
 * pin anything to. `min-h-0` is not decoration either — a flex child defaults to
 * `min-height: auto`, so without it the column refuses to shrink below its
 * content's height and `flex-1` silently becomes `flex-none`.
 *
 * ## THE `cafeMenu` META CONTRACT
 *
 * The bottom pill is rendered only when `route.meta.cafeMenu !== false`, so a
 * screen that needs the full height can claim it:
 *
 * ```ts
 * definePageMeta({ layout: 'cafe', cafeMenu: false })
 * ```
 *
 * The chat thread is that screen. Its composer must sit on the bottom edge of
 * the viewport — exactly as Screen B of the reference draws it, with no pill
 * under it — and a pill there would both cover the composer and steal 88px of
 * thread. Everything else (cafés, joined tables, settings, search) keeps the
 * pill, because they are lists that must not be pushed up by it.
 *
 * The flag is read off the route rather than passed as a prop because the pill's
 * position is a property of *the screen*, and the route is the only thing that
 * knows which screen is on top. `false` is the exception and any absent value —
 * including a screen that forgets to declare it — keeps the pill, because a
 * missing pill is a screen with no way out and a missing flag is not.
 *
 * This comment is `sr-only`-adjacent documentation rather than visible copy:
 * there is nothing to read, so it lives here where the next screen's author will
 * find it.
 */
const route = useRoute();

/**
 * `route.meta` is an open string map in vue-router, so `cafeMenu` arrives
 * untyped. The cast is what says what the flag actually is — `boolean |
 * undefined` — rather than leaving it an `any` that answers `true` to a typo.
 */
const menuFlag = route.meta.cafeMenu as boolean | undefined;

/** Absent, `undefined` and `true` all keep the pill; only `false` removes it. */
const showMenu = computed(() => menuFlag !== false);
</script>

<template>
  <div
    class="default__layout custom-scroll relative mx-auto flex h-dvh max-w-md flex-col overflow-hidden border-x border-slate-200 bg-x-primary-content-50 font-yekan-regular"
  >
    <!--
      `relative` on the root is what lets `CafeBottomMenu` be `absolute
      inset-x-0 bottom-0` and stay inside THIS column rather than the viewport:
      on a desktop browser the column is centred, so a pill positioned against
      the viewport would float hundreds of pixels away from the screen it belongs
      to.
    -->
    <div class="flex min-h-0 flex-1 flex-col">
      <slot />
    </div>

    <CafeBottomMenu v-if="showMenu" />
  </div>
</template>