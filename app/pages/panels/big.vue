<script setup lang="ts">
/**
 * The `/panels/big` parent route: it supplies the panel chrome and forwards.
 *
 * Same idiom as `app/pages/test.vue` — a page beside a directory of the same
 * name becomes the parent of that directory's routes, so this file is where
 * `/panels/big`'s `layout` is declared once for everything under it.
 *
 * NO `middleware` here, on purpose. This component never renders anything of
 * its own — it is `<NuxtPage />` and nothing else — so a gate placed here would
 * run on the parent record and a gate omitted here would simply not run. Access
 * is therefore decided on each child page, where there is something to protect.
 * `app/pages/panels/big/index.vue` carries the full `definePageMeta`; a panel
 * page added without it would render this chrome with no gate, which is the hole
 * that repeating the meta on every child is meant to close.
 */
definePageMeta({
  layout: "panel",
});
</script>

<template>
  <NuxtPage />
</template>
