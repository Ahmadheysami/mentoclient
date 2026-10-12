<script setup lang="ts">
/**
 * The code-entry screen — a PAGE, not a modal: it is typeable, shareable and
 * survives a refresh. NO middleware: the gate redirects here, so gating it
 * would loop (panels/child.vue declares none, and each gated page brings its
 * own).
 */
definePageMeta({
  layout: "child",
});

useSeoMeta({ title: "ورود به پنل" });
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center px-5 py-10">
    <ChildEnterCode class="w-full max-w-sm" />
  </div>
</template>
