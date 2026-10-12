<script setup lang="ts">
/**
 * The parent panel's title bar, in the parent palette.
 *
 * Reads its title from `route.meta.panelTitle` — the same key the page's
 * `definePageMeta` gate block already carries — so the bar never needs a
 * prop that could drift from the gate's own title. Mirrors the decision in
 * `App/PanelHeader.vue`, but painted for the parent identity.
 */
const route = useRoute(),
  router = useRouter(),
  backTo = computed(() => getParentPath(route, router));

const title = computed<string>(() => {
  const value = route.meta.panelTitle;
  return typeof value === "string" ? value : "";
});
</script>

<template>
  <header
    class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 bg-x-parent-warm-50/90 px-4 backdrop-blur-xl"
  >
    <NuxtLink
      :to="backTo"
      class="neu-control grid size-11 place-items-center rounded-full text-x-parent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      aria-label="بازگشت"
    >
      <UIcon name="solar:alt-arrow-right-linear" size="20" />
    </NuxtLink>

    <h1 v-if="title" class="min-w-0 flex-1 truncate font-yekan-bold text-x-text-title">
      {{ title }}
    </h1>

    <img
      src="/images/panels/parent-avatar.svg"
      alt="نمایه والد"
      class="size-9 rounded-full ring-2 ring-x-parent-200"
      width="36"
      height="36"
    >
  </header>
</template>
