<script setup lang="ts">
import type { ChildNavItem } from "~/types/child-panel";

const route = useRoute();
const childPanel = useChildPanel();

const items = computed<ChildNavItem[]>(() => [
  { to: "/panels/child", label: "خانه", icon: "solar:home-2-bold" },
  {
    to: "/panels/child/goals",
    label: "مسیر من",
    icon:
      childPanel.variant === "child"
        ? "solar:routing-3-linear"
        : "solar:flag-2-linear",
  },
  { to: "/panels/child/tests", label: "فعالیت‌ها", icon: "solar:widget-5-bold" },
  { to: "/panels/child/profile", label: "من", icon: "solar:user-rounded-bold" },
]);

function isActive(to: string): boolean {
  return to === "/panels/child"
    ? route.path === "/panels/child"
    : route.path.startsWith(to);
}

/**
 * The access-code screen is a login, not a hub: the shared nav under it
 * promises destinations the child does not hold a session for yet, so the
 * strip is taken off exactly this route and nothing else.
 */
const isEnterRoute = computed(
  () =>
    route.path.startsWith("/panels/child/enter") ||
    route.path.startsWith("/panels/child/assistant") ||
    route.path.startsWith("/panels/child/exam"),
);
</script>

<template>
  <template v-if="!isEnterRoute">
  <!--
    Kid nav: big chunky colorful pills on a white strip with a thick sun border.
    Teen nav: a light strip with slim, refined controls.
    Two identities, one component — the variant is the whole decision.

    Both use `.neu-control` (main.css §18), so every destination is pressable
    and the current one sits recessed at rest. The recessed look is driven by
    `aria-current` in CSS, so the depth can never disagree with the state a
    screen reader announces, and each variant pairs it with a background and
    ink change — a shadow is not a state cue on its own (WCAG 1.4.11).

    Unselected items carry their own fill in BOTH variants, for the same reason
    the parent nav's do: a `.neu-control` with no background is a raised surface
    on a ground of its own colour, which is the ~1.2:1 case main.css §18 measured.
    The fill is what bounds the pill; the hairline is the WCAG 1.4.11 edge on top.
    The kid's peach (`kid-50`) and the teen's plain white are the two registers —
    chunky-on-white-rail and quiet-on-ivory.

    THE TEEN ROW IS A GRID, LIKE THE OTHER TWO NAVS. It used to be
    `flex justify-around`, which is where this strip fell apart. `justify-around`
    splits the leftover space into equal MARGINS, so a row of pills that are not
    the same width gets gaps that do not match, and here they were worse than
    unequal: all three pills were `min-w-16` (64px) and nothing else, so three
    equal pills sat in a 400px rail with 34.7px of dead margin at each edge and
    69.3px between them — a 2:1 ratio, and the whole row collapsed into the
    middle half of the bar. A `grid` with one column per item makes each pill
    fill its column instead, so the rhythm is the same whatever the labels say;
    a 4-character word, a 9-character word and a 6-character word all get an
    equal share. That is also what the kid branch above already does, and what
    `Parent/BottomNav` does with five columns, so all three navs now read as
    one family. The `min-w-16` is gone with the shrink-wrap it existed to prop
    up: the column is the width now, and it is never the binding constraint
    (68px at the narrowest viewport with four items, against a floor of 44px).

    `whitespace-nowrap` IS LOAD-BEARING, not decoration. `h-12` is fixed and the
    label is an anonymous flex item that wraps if it is ever pushed past the
    pill's width — by a wider fallback face, or by any future label longer than
    these three. Two lines measure 60.1px inside a 48px pill at the default
    scale, so the text spills out the bottom. One line is 43.1px and fits.

    `.neu-control-nav` (main.css §18) shortens this row's arm to 8px, because
    fixing the grid brings the pills from 69px apart to 8px apart and the full
    12px arm would then smear in every gutter. `gap-2` doubles the clearance the
    switcher below had when it failed at `gap-1`, and `px-3` gives the columns
    the 24px a side was spending. The teen nav keeps `h-12` (48px) — it is
    already 4px past the 44px floor and the strip has to stay slim, which is the
    whole point of the variant. -->
  <nav
    v-if="childPanel.variant === 'child'"
    aria-label="ناوبری کودک"
    class="shrink-0 border-t-4 border-x-kid-sun-500 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
  >
    <ul class="grid grid-cols-4 gap-2">
      <li v-for="item in items" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="neu-control flex h-16 flex-col items-center justify-center gap-1 rounded-3xl text-xs font-yekan-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-kid-berry-700"
          :class="
            isActive(item.to)
              ? 'bg-x-kid-sun-100 text-x-kid-900'
              : 'bg-x-kid-50 text-x-text-subtitle'
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" size="24" />
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>

  <nav
    v-else
    aria-label="ناوبری نوجوان"
    class="shrink-0 border-t border-x-teen-200 bg-x-teen-50/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
  >
    <ul class="grid grid-cols-4 gap-2">
      <li v-for="item in items" :key="item.to">
        <NuxtLink
          :to="item.to"
          class="neu-control neu-control-nav flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-yekan-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-teen-violet-600"
          :class="
            isActive(item.to)
              ? 'bg-x-teen-violet-300/45 text-x-teen-900'
              : 'bg-white text-x-text-subtitle'
          "
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <UIcon :name="item.icon" size="22" />
          {{ item.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
  </template>
</template>
