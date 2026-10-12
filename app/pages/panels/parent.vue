<script setup lang="ts">
/**
 * The `/panels/parent` parent route: supplies the panel chrome and forwards.
 *
 * Same idiom as `app/pages/panels/big.vue`: a page beside a directory of the
 * same name becomes the parent record of that directory's routes, so the
 * `layout` is declared once here.
 *
 * NO `middleware` here, on purpose — each child page carries its own
 * `middleware: ["auth", "panel-plan"]` with `panel: "parent"`, because a gate
 * on this renderless parent record would not protect a child page that
 * forgot its own. See `app/pages/panels/big.vue` for the full reasoning.
 */
definePageMeta({
  layout: "panel-parent",
});
</script>

<template>
  <NuxtPage />
</template>
