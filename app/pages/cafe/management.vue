<script setup lang="ts">
definePageMeta({
  layout: "blank",
  middleware: ["auth"],
});
</script>

<template>
    <div class="m">
        <NuxtPage />
    </div>
</template>
