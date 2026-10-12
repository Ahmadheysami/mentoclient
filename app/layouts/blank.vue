<script setup lang="ts">
/**
 * The exam's ground. The ADULT exam keeps the app ground; a CHILD exam
 * (`?scope=child`) wears the child's palette, so the whole run of the exam
 * reads as part of the child panel, not the adult shop.
 */
const route = useRoute();
const childPanel = useChildPanel();

const isChildScope = computed(() => route.query.scope === "child");

const childGround = computed(() =>
  childPanel.variant === "child"
    ? "neu-kid border-x-kid-300 bg-x-kid-50"
    : "neu-teen border-x-teen-300 bg-x-teen-50",
);
</script>

<template>
  <div
    class="relative default__layout custom-scroll max-w-md border-x h-dvh overflow-y-auto mx-auto font-yekan-regular"
    :class="
      isChildScope
        ? childGround
        : 'bg-x-primary-content-100 border-slate-200'
    "
  >
    <slot />
  </div>
</template>
