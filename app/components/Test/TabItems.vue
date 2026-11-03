<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";
// Tab items
const tabItems = ref<TabsItem[]>([
  {
    label: "فروشگاه",
    icon: "solar:document-add-broken",
    to: "/test",
  },
  {
    label: "تست های فعال",
    icon: "solar:document-medicine-broken",
    to: "/test/active",
  },
  {
    label: "انجام شده",
    icon: "solar:clipboard-check-linear",
    to: "/test/done",
  },
]);
</script>

<template>
  <div
    class="sticky bg-x-primary-content-100 z-1010 top-0 backdrop-blur-xl pb-3"
  >
    <UDashboardToolbar :ui="{ root: 'border-none py-2' }">
      <template #right>
        <div class="flex items-center">
          <UtilBackBtn />
        </div>
      </template>
      <template #left>
        <strong class="text-x-text-title text-lg"> آزمون های تخصصی </strong>
      </template>
    </UDashboardToolbar>

    <!--
      Tabs. Each link is `min-w-0` and the label truncates: three Persian
      labels in a third of a 320px screen cannot always fit beside their icon,
      and without `min-w-0` the grid track grew past the container and scrolled
      the whole header sideways. The icon never shrinks, so the row keeps its
      rhythm on the smallest phones.
    -->
    <div class="grid grid-cols-3 bg-white p-2 rounded-3xl w-11/12 mx-auto">
      <NuxtLink
        class="tablink transition-all rounded-2xl duration-300 text-[11px] sm:text-xs flex h-12 sm:h-13 min-w-0 px-1 justify-center items-center gap-1 text-center"
        :to="item?.to"
        v-for="item of tabItems"
      >
        <UIcon :name="item.icon" class="text-lg! shrink-0" aria-hidden="true" />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.router-link-active.router-link-exact-active {
  background: var(--color-x-primary-400) !important;
  color: #f5f5f5;
  font-weight: bold;
}
</style>
