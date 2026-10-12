<script setup lang="ts">


definePageMeta({
  // NO guard here. `/test/active/exam` is shared by the adult panel and the
  // child/teen panel (`?scope=child`); a blanket `auth` would bounce a child
  // session to `/auth` before the exam page's own scope-aware guard ever runs,
  // and the child could never launch their exam. Every /test page therefore
  // carries its OWN guard: the adult pages list `middleware: ["auth"]`, and the
  // exam page lists its scope-aware pair.
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
