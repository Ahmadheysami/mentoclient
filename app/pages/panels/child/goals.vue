<script setup lang="ts">
/**
 * LAYOUT RECORD for `/panels/child/goals/*`: the list is `goals/index.vue`, one
 * goal's steps is `goals/[id].vue`.
 *
 * ⚠ THIS FILE IS NOT OPTIONAL. Nuxt pairs a `goals.vue` page with a `goals/`
 * directory into ONE route record, and `goals.vue` becomes that record's PARENT
 * component. A record that never renders `<NuxtPage />` swallows its children:
 * `/panels/child/goals/<id>` painted the LIST page at the child's URL — title
 * «هدف‌های من», two skeletons, no steps, no error, no navigation to leave it —
 * so the steps page was never mounted and the goal was impossible to open. The
 * same trap sits in `panels/parent/children.vue`, `panels/big.vue`, `cafe.vue`
 * and `test.vue`, which is exactly why each of those records renders
 * `<NuxtPage />`. If a page here ever grows a sub-route, the sibling `X.vue`
 * must keep its `<NuxtPage />`.
 *
 * The layout and the gate are declared ONCE, here, rather than repeated in both
 * children: `child-panel` is idempotent (it returns as soon as the profile is
 * in the store) and one declaration is one rule to keep true.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});
</script>

<template>
  <NuxtPage />
</template>
