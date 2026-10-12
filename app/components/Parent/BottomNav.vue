<script setup lang="ts">
/**
 * The parent panel's bottom navigation — five destinations, always visible.
 *
 * Active state is derived from `route.path` (startsWith, so child routes of a
 * section stay lit), never from local state, so a deep link lands with the
 * right item highlighted. Every item is a real route that exists, with a real
 * `h-14` target and a visible focus ring.
 *
 * Every item is a `.neu-control` (main.css §18), so the whole strip is
 * pressable and the current destination sits recessed. That recessed look is
 * driven by `aria-current` in CSS rather than by a class here, so it can never
 * disagree with the state a screen reader announces — and it is paired with a
 * background tint and a darker ink, because a shadow is not a state cue.
 *
 * The RAIL is the panel's own ivory (`warm-50`), not a white slab, and the
 * unselected pills are white. That is the whole hierarchy of this component:
 * the page ground and the pinned chrome are one continuous surface, and each
 * nav item is a white object standing on it. The opposite — a white rail with
 * transparent pills — puts a raised surface on a ground of its own colour,
 * which is exactly the case main.css §18 measured at ~1.2:1, so the pill edges
 * would exist only as a hairline and the strip would read as a lumpy band
 * instead of as five pressable targets.
 */
const route = useRoute();

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const items: NavItem[] = [
  { to: "/panels/parent", label: "خانه", icon: "solar:home-2-linear" },
  { to: "/panels/parent/children", label: "فرزندان", icon: "solar:users-group-rounded-linear" },
  { to: "/panels/parent/access", label: "دسترسی", icon: "solar:link-circle-linear" },
  { to: "/panels/parent/activity", label: "فعالیت", icon: "solar:pulse-2-linear" },
  { to: "/panels/parent/settings", label: "تنظیمات", icon: "solar:settings-linear" },
];

function isActive(to: string): boolean {
  return to === "/panels/parent"
    ? route.path === "/panels/parent"
    : route.path.startsWith(to);
}
</script>

<template>
  <nav
    aria-label="ناوبری پنل والد"
    class="shrink-0 border-t border-x-parent-100 bg-x-parent-warm-50/95 backdrop-blur-xl"
  >
    <ul class="grid grid-cols-5">
      <li v-for="item in items" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="flex h-14 flex-col items-center justify-center gap-0.5  text-[11px] font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          :class="
            isActive(item.to)
              ? 'bg-x-parent-100 text-x-parent-700 outline-x-parent-500'
              : 'bg-white text-x-text-subtitle'
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <UIcon
            :name="item.icon"
            size="22"
            :class="isActive(item.to) ? 'text-x-parent-600!' : ''"
          />
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
