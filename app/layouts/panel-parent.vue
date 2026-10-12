<script setup lang="ts">
import ParentTopBar from "~/components/Parent/TopBar.vue";
import ParentBottomNav from "~/components/Parent/BottomNav.vue";

/**
 * The chrome of the parent panel: a calm warm-neutral column with the panel's
 * own title bar on top and its own bottom nav below.
 *
 * Same two load-bearing decisions as `app/layouts/panel.vue`, kept intact:
 * `default__layout` on the root (the reader's text-size contract in
 * `main.css`), and a split scroller — the root is `h-dvh` overflow-hidden,
 * `<main>` is the only element that scrolls — so the nav stays pinned.
 *
 * Distinct identity: soft warm ground (`x-parent-warm-50`), indigo hairlines,
 * no `App/PanelHeader`, no `App/BottomBar`.
 *
 * `neu-parent` is the soft-UI scope class (main.css §18). It carries no colour
 * of its own — only the four tint variables every `.neu-*` class reads — so
 * putting it on the root is what lets `ParentTopBar`, `ParentBottomNav` and
 * everything in `<main>` share one shadow recipe while the ground stays the
 * parent's own warm ivory. The bottom nav's own rail is that same ivory rather
 * than a white slab, so the pinned chrome reads as part of the page ground
 * instead of a separate bright band under it.
 */
const route = useRoute();

/**
 * The assistant takes the whole screen, so the bottom nav is rendered away there
 * and the chat inherits the height it was pinned against — a `shrink-0` rail
 * is the one thing on this layout that takes space from `<main>` rather than
 * from the page's own scroll.
 *
 * The counterpart is `<main>`'s `pb-4`: that gutter exists to clear the rail,
 * so with no rail it becomes `pb-0` and the composer owns the bottom edge.
 *
 * Same shape and the same reason as `hidesChrome` in `layouts/child.vue`.
 * `ParentTopBar` above stays on every route — it is this page's own title bar,
 * not a sub-menu.
 */
const isAssistantRoute = computed(
  () => route.path.startsWith("/panels/parent/assistant"),
);
</script>

<template>
  <div
    class="panel__layout default__layout custom-scroll neu-parent mx-auto flex h-dvh max-w-md flex-col overflow-hidden border-x border-x-parent-100 bg-x-parent-warm-50 font-yekan-regular"
  >
    <ParentTopBar />

    <!--
      `pb-4` is the gutter that keeps the last content block clear of the pinned
      rail below. The assistant renders no rail, so it takes `pb-0` and the
      chat's composer sits on the bottom edge of the viewport.
    -->
    <main
      class="flex-1 overflow-y-auto overscroll-contain"
      :class="isAssistantRoute ? 'pb-0' : 'pb-4'"
    >
      <slot />
    </main>

    <ParentBottomNav v-if="!isAssistantRoute" />
  </div>
</template>
