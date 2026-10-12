<script setup lang="ts">
import ChildNav from "~/components/Child/Nav.vue";
import AssistantFab from "~/components/Child/AssistantFab.vue";
import ChildClosedScreen from "~/components/Child/ClosedScreen.vue";

const childPanel = useChildPanel();
const settings = useSettings();
const route = useRoute();

/** Fullscreen flows hide the fixed chrome, so they do not need the nav clearance. */
const hidesChrome = computed(
  () =>
    route.path.startsWith("/panels/child/enter") ||
    route.path.startsWith("/panels/child/assistant") ||
    route.path.startsWith("/panels/child/exam"),
);

/**
 * The child panel's appearance, as attributes on `<html>`.
 *
 * Same mechanism the global preferences use (`app.vue` sets
 * `data-font-scale`/`data-motion` there), but a layout, not `app.vue`: Unhead
 * removes these the moment the child layout unmounts, so the adult panels
 * — which never carry `.neu-kid`/`.neu-teen` and never see these attrs —
 * cannot inherit the child palette or size. `main.css` keys both the theme
 * re-tint and the ui-size multiplier off these two attrs.
 */
useHead(
  computed(() => ({
    htmlAttrs: {
      "data-child-theme": settings.state.prefs.theme,
      "data-child-ui-size": settings.state.prefs.uiSize,
    },
  })),
);

/**
 * The full-screen notice reasons: the credential the child held is dead or
 * refused, and the panel must stop looking alive (§4.5). `signed-out` has no
 * copy (the action that set it already moved the child to `enter`), and
 * `outside-window` is a 400, not a logout — it gets the read-only strip
 * below instead of a full-screen takeover.
 */
const sessionEndMessage = computed(() => {
  switch (childPanel.state.sessionEnded) {
    case "expired":
      return "نشست شما تمام شد. دوباره کد را وارد کنید.";
    case "revoked":
      return "دسترسی این پنل توسط والد بسته شد.";
    case "disabled":
      return "حساب شما در حال حاضر غیرفعال است.";
    default:
      return null;
  }
});

async function goToEnter(): Promise<void> {
  // Clear BEFORE the navigation: the branch reads the same field, and a
  // navigation that lands with the marker still set would paint this same
  // screen over the enter page again.
  childPanel.clearSessionEnded();
  await navigateTo("/panels/child/enter");
}
</script>

<template>
  <div
    class="default__layout custom-scroll mx-auto flex h-dvh max-w-md flex-col overflow-hidden border-x font-yekan-regular"
    :class="
      childPanel.variant === 'child'
        ? 'neu-kid border-x-kid-300 bg-x-kid-50'
        : 'neu-teen border-x-teen-300 bg-x-teen-50'
    "
  >
    <template v-if="sessionEndMessage !== null">
      <UiStateMessage
        icon="solar:shield-warning-linear"
        :title="sessionEndMessage"
        action-label="ورود دوباره"
        @action="goToEnter"
      />
    </template>

    <template v-else-if="childPanel.state.sessionEnded === 'outside-window'">
      <!-- Full takeover, not a strip: the child can't use the panel right now,
           so there is nothing meaningful to render behind it. -->
      <main class="flex-1 overflow-y-auto">
        <ChildClosedScreen />
      </main>
    </template>

    <template v-else>
      <!-- pb-28: the fixed AssistantFab rides above the nav, so the last
           content block needs room to scroll clear of it. Fullscreen routes
           render no fixed chrome and get no extra clearance. -->
      <main
        class="flex-1 overflow-y-auto overscroll-contain"
        :class="hidesChrome ? 'pb-0' : 'pb-28'"
      >
        <slot />
      </main>

      <AssistantFab />
      <ChildNav />
    </template>
  </div>
</template>
