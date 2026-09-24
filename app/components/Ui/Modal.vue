<script setup lang="ts">
withDefaults(defineProps<{
    defaultOpen?: boolean,
    open?: boolean
}>(), {
    defaultOpen: false,
    open: false
});
</script>
<template>
  <UModal v-model:open="open" :default-open="defaultOpen" :ui="{overlay: 'md:w-md', body: 'border-none', content: 'w-80! rounded-2xl shadow-none'}">
    <template #close>
        <span></span>
    </template>
    <template #body>
        <div>
            <p>afslfasfl;</p>
        </div>
    </template>
  </UModal>
</template>
