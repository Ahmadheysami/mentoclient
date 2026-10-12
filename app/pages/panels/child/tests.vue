<script setup lang="ts">
/**
 * LAYOUT RECORD for `/panels/child/tests/*`: the list is `tests/index.vue`, an
 * exam's start gate is `tests/[assetId].vue`.
 *
 * ⚠ THIS FILE IS NOT OPTIONAL — see the identical note in `goals.vue`. Without
 * `<NuxtPage />` here, `/panels/child/tests/<assetId>` rendered the LIST page at
 * the gate's URL, so the terms, the checkbox and «شروع» never existed and the
 * child had no way to launch an exam at all.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});
</script>

<template>
  <NuxtPage />
</template>
