<script setup lang="ts">
/**
 * Backward-compatibility redirect from `/panels/employee` to `/panels/employer`.
 *
 * The employer panel was moved from `/panels/employee/` to `/panels/employer/` and
 * the backend now emits `panel: "employer"` in subscriptions. This file exists
 * solely so that old links and bookmarks to `/panels/employee` still work: it
 * redirects to `/panels/employer` with `replace: true` so the browser history
 * does not keep the old URL as a separate entry.
 */
definePageMeta({
  layout: "panel",
});

onMounted(() => {
  navigateTo("/panels/employer", { replace: true });
});
</script>

<template>
  <NuxtPage />
</template>
