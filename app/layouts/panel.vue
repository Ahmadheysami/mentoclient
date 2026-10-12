<script setup lang="ts">
import BottomBar from '~/components/App/BottomBar.vue';

/**
 * The chrome of a paid panel: a title bar over a scrolling page.
 *
 * Two choices here are load-bearing, and both are invisible until they are
 * wrong.
 *
 * **1. `default__layout` is MANDATORY on this root element.** The reader's
 * text-size setting (`html[data-font-scale]`) is implemented in
 * `app/assets/css/main.css:1481` as
 *
 * ```css
 * html[data-font-scale] .default__layout { max-width: calc(28rem / var(--app-font-scale)) }
 * ```
 *
 * — a rule scoped to that ONE class, with no other selector to fall back on. A
 * layout that drops it is not merely unstyled: the panel's `max-w-md` column
 * silently stops being divided by the scale factor, so a reader who chose a
 * large text gets a layout wider than the phone it was drawn for, and only in
 * this layout, while every other screen stays correct. The comment in
 * `main.css` calls `default__layout` "the one and only class on the root
 * element", so the class is the contract, not a leftover from `default.vue`.
 * It is repeated here on purpose; `panel__layout` is an addition beside it,
 * never a replacement.
 *
 * **2. The scroll is SPLIT — `overflow-hidden` on the root, `overflow-y-auto` on
 * `<main>`.** This is deliberately NOT the `overflow-y-auto` root that
 * `default.vue` and `blank.vue` use. Here the root is a fixed `h-dvh` flex
 * column and `<main>` is the only element that scrolls, which is what lets the
 * assistant chat and the goal timeline pin a composer to the bottom of the
 * viewport while the transcript scrolls behind it. A single scroller on the root
 * would give the page one scrolling box and no stable bottom edge to pin to.
 *
 * Also deliberately different from `default.vue`: `pb-33` is dropped, because
 * there is no bottom bar to clear — see below.
 */
const route = useRoute();

/**
 * Whether the current route is in the employer panel.
 *
 * The employer panel has its own professional light theme (teal accent, slate
 * surfaces) that is completely distinct from the big panel's sky/lime palette.
 * The `.employer-panel` scope in `main.css` re-points shared component tokens
 * (FeatureCard, BottomBar, PanelHeader, etc.) so they automatically use the
 * employer palette when this class is present on the root element.
 */
const isEmployerPanel = computed(() => route.meta.panel === 'employer');

/**
 * The ONE chrome exception this layout makes: the assistant takes the whole
 * screen.
 *
 * `Bot/ProChatView.vue` renders no navigation of its own, so the sub-menu on a
 * panel page is this layout's `BottomBar` — and on the assistant route it is
 * both rendered away and un-cleared: `<main>` swaps its `pb-23` for `pb-0`, so
 * the chat's `h-full min-h-0` column gets the full height and its `shrink-0`
 * composer sits on the bottom edge of the viewport instead of floating above a
 * pill. `pb-23` was never a page gutter; it was that pill's clearance, and with
 * the pill gone it would only reserve dead space.
 *
 * Same shape and the same reason as `hidesChrome` in `layouts/child.vue`. The
 * `AppPanelHeader` above stays on every route: it is this page's own title bar
 * — where you are, the way back, the coin pill — not a sub-menu.
 */
const isAssistantRoute = computed(
  () => route.meta.hideBottomBar === true,
);
</script>

<template>
    <div
        class="panel__layout default__layout custom-scroll bg-x-primary-content-100 max-w-md border-x border-slate-200 h-dvh overflow-hidden mx-auto font-yekan-regular flex flex-col"
        :class="{ 'employer-panel': isEmployerPanel }"
    >
        <AppPanelHeader />

        <!--
            The one scroller. `overscroll-contain` keeps a swipe that reaches the
            end of a transcript from chaining to a parent, which on a touch phone
            reads as the whole page lurching.

            `pb-23` is `BottomBar`'s clearance and nothing else — that pill is
            `absolute bottom-3.5` and floats over the content — so the assistant
            route, which renders no pill, takes `pb-0` instead.
        -->
        <main
            class="flex-1 overflow-y-auto overscroll-contain"
            :class="isAssistantRoute ? 'pb-0' : 'pb-23'">
            <slot />
            <BottomBar v-if="!isAssistantRoute" />
        </main>

        <!--
            NO full-width bottom bar, unlike `default.vue`: all four of this
            layout's items — خانه / کیف پول و سکه / حساب / تنظیمات — lead outside
            the paid panel, and such a bar covers the bottom of the viewport, so a
            composer pinned to the bottom edge of a panel screen would sit behind
            it. The panel home page (`/panels/big`) is the navigation hub instead,
            and the compact floating `BottomBar` above stands in for it — except
            on the assistant route, which takes the full screen.
        -->
    </div>
</template>
