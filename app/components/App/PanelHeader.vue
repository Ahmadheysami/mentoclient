<script setup lang="ts">
/**
 * The title bar of a paid panel: where you are, the way back, and what you can
 * spend.
 *
 * A title bar, deliberately NOT `App/TopBar.vue`. That is the home screen's
 * welcome — avatar, full name, «سلام دوست من 👋» and a notification bell — and
 * reusing it here would greet a reader on their goal page, put their own name
 * where a section name belongs, and spend a `GET /notifications` on a count they
 * did not ask for on every panel screen.
 *
 * The title comes from `route.meta` rather than a prop, so a page declares it in
 * the SAME `definePageMeta` that declares the `panel` its gate needs. The two
 * cannot drift apart, and a new panel page cannot forget the title while still
 * passing the gate.
 *
 * The component takes no props on purpose: everything it renders is decided by
 * the route it is rendered under, and a prop here would be a second, divergent
 * copy of that decision.
 */
const route = useRoute();

/**
 * `route.meta` is whatever `definePageMeta` put in it, and the `RouteMeta` index
 * signature types both keys as `any` — so they are NARROWED here, never cast. A
 * cast would type-check and then fail at runtime on the one page that forgot the
 * key, which is precisely the page whose bar must not be broken.
 *
 * `computed`, not a plain read in `setup()`: the layout outlives a navigation,
 * so the bar has to follow the current route's meta instead of capturing the
 * first page's values for the whole session.
 */
const panel = computed<string | null>(() => {
  const value = route.meta.panel;

  return typeof value === "string" && value.length > 0 ? value : null;
});

const title = computed<string>(() => {
  const value = route.meta.panelTitle;

  return typeof value === "string" ? value : "";
});

/**
 * The way back is the panel's own home, not the browser history.
 *
 * A deep-linked reader — a shared goal link, a notification, a back gesture
 * from another app — has no history of this panel to pop, and `Util/BackBtn`
 * falls back to `/` when `to` is absent, which would drop them out of the panel
 * they were reading. Pointing at `/panels/<panel>` puts them on the hub of the
 * panel they came for.
 *
 * `undefined` when the route declares no `panel`: there is then no known hub, so
 * the caller omits the button instead of linking to a route that may not exist.
 */
const backTo = computed<string | undefined>(() =>
  panel.value === null ? undefined : `/panels/${panel.value}`,
);
</script>

<template>
    <!--
        A `<header>` so the bar is the page's `banner` landmark, and `<h1>` so the
        route's name is the document's top heading.

        `shrink-0` is the class that actually holds this bar in place: the panel
        layout is a `h-dvh` flex column whose only scroller is `<main>`, so a bar
        that could shrink would be squeezed instead of pinned. `sticky top-0` is
        kept as a no-op guard for the case where a panel page later opts into
        letting the bar scroll with the page.
    -->
    <header
        class="panel-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 bg-x-primary-content-100/90 px-4 backdrop-blur-xl">
        <UtilBackBtn v-if="panel" :arrow="'right'" :to="backTo" />

        <!--
            No `panelTitle` means no element, rather than an empty heading: a bar
            that renders a blank line where its name should be reads as a broken
            screen, and says nothing to a screen reader. `min-w-0` is what makes
            `truncate` work — a flex item defaults to `min-width: auto` and
            refuses to get narrower than its text.
        -->
        <h1 v-if="title" class="min-w-0 truncate font-yekan-bold text-x-text-title">
            {{ title }}
        </h1>

        <!--
            The only elastic part of the row. `ms-auto` puts it on the inline-END,
            which is the physical LEFT in this hard-coded RTL app and therefore the
            side the back button is not on.
        -->
        <AppCoinPill class="ms-auto" />
    </header>
</template>
