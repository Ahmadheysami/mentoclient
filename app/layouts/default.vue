<script setup lang="ts">
const route = useRoute();
const layoutRoot = ref<HTMLElement | null>(null);

/** The column is the scroller here, so the router cannot reset it for us. */
watch(
  () => route.fullPath,
  () => {
    nextTick(() => {
      if (layoutRoot.value) layoutRoot.value.scrollTop = 0;
    });
  },
);
</script>

<template>
    <div ref="layoutRoot" class="default__layout custom-scroll bg-x-primary-content-100 max-w-md border-x border-slate-200 h-dvh overflow-y-auto mx-auto font-yekan-regular pb-33">
        <slot />
        <!-- Bottom Bar Component -->
        <AppBottomBar />
    </div>
</template>
