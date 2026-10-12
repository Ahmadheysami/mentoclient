<script setup lang="ts">
/**
 * The `/panels/child` parent route: layout + forwarding only.
 *
 * **No `middleware` here, and never any on a child page.** The child panel
 * has no auth, no OTP, no plan purchase, and no redirect to `/auth`. The
 * access link IS the entry mechanism, so a child who opens it lands directly
 * inside `layouts/child.vue`.
 */
definePageMeta({
  layout: "child",
});
</script>

<template>
  <NuxtPage />
</template>
