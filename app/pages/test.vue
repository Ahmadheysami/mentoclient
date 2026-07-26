<script setup lang="ts">


definePageMeta({
  middleware: ["auth"],
});

</script>
<template>
  <UPage>
    <div>
      <NuxtPage />
    </div>
  </UPage>
</template>

<style lang="scss" scoped>
</style>
