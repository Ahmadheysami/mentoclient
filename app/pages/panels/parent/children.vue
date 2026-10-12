<script setup lang="ts">
/**
 * The `/panels/parent/children` parent route: it supplies the record and forwards.
 *
 * Same idiom as `app/pages/panels/parent.vue` and `app/pages/panels/big.vue` — a
 * page beside a directory of the same name becomes the parent record of that
 * directory's routes, so `/panels/parent/children` and
 * `/panels/parent/children/new` share one nesting level instead of the list and
 * the form being siblings that happen to share a URL prefix.
 *
 * NO `middleware` here, on purpose, for the reason written on `panels/parent.vue`:
 * a gate on a renderless record protects nothing, so each page under it carries its
 * own `middleware: ["auth", "panel-plan"]` with `panel: "parent"`.
 */
definePageMeta({
  layout: "panel-parent",
});
</script>

<template>
  <NuxtPage />
</template>
