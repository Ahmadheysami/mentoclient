<script setup lang="ts">
/**
 * Placeholder rows shaped like the list cards they replace, so the page never
 * shifts when data arrives. Decorative only — the parent owns `aria-busy`.
 *
 * `shape="row"`  → compact list rows (results, active tests)
 * `shape="tile"` → shop cards with a leading thumbnail
 */
withDefaults(
  defineProps<{ rows?: number; label?: string; shape?: "row" | "tile" }>(),
  { rows: 3, label: "در حال دریافت اطلاعات", shape: "row" },
);
</script>

<template>
  <div class="space-y-3">
    <span class="sr-only">{{ label }}</span>

    <template v-if="shape === 'row'">
      <div
        class="flex items-center gap-3 rounded-3xl bg-white p-4"
        v-for="row in rows"
        :key="`skeleton-${row}`"
        aria-hidden="true"
      >
        <USkeleton class="size-12 shrink-0 rounded-2xl bg-x-primary-50" />
        <div class="flex-1 space-y-2">
          <USkeleton class="h-4 w-36 rounded-lg bg-x-primary-50" />
          <USkeleton class="h-5 w-24 rounded-full bg-x-primary-50" />
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="flex gap-3 rounded-3xl bg-white p-4"
        v-for="row in rows"
        :key="`skeleton-tile-${row}`"
        aria-hidden="true"
      >
        <USkeleton class="size-24 shrink-0 rounded-2xl bg-x-primary-100" />
        <div class="flex-1 space-y-3 py-1">
          <USkeleton class="h-4 w-4/5 rounded-lg bg-x-primary-100" />
          <USkeleton class="h-4 w-1/2 rounded-lg bg-x-primary-100" />
          <div class="flex gap-2 pt-1">
            <USkeleton class="h-6 w-16 rounded-full bg-x-primary-100" />
            <USkeleton class="h-6 w-20 rounded-full bg-x-primary-100" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
