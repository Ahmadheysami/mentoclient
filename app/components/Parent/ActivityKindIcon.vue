<script setup lang="ts">
import type { ParentActivityKind } from "~/types/parent-panel";

const props = defineProps<{
  kind: ParentActivityKind;
}>();

/**
 * The icon ground for one account event.
 *
 * The keys are the five kinds `parentActivityKindOf` can answer — the ones the
 * backend actually writes — and NOT the prototype's `test | story | mood | goal`:
 * no `performanceModel` row a child taking a test produces could ever narrow to
 * those, so a clipboard for a fabricated «آزمون احساسات هفتگی» would be a fake
 * affordance on the screen a parent trusts most.
 *
 * Each kind keeps its own tone so a list is scannable at a glance.
 *
 * The tones are icon grounds, so the ink on each tile is a graphical object and
 * has to clear 3:1 (WCAG 1.4.11) — not merely look coloured. Every `-500` that
 * failed that was deepened into the same hue family rather than replaced with a
 * token from another panel, so each kind still reads as its own colour.
 */
const KIND_META: Record<ParentActivityKind, { icon: string; tone: string }> = {
  "child-created": {
    icon: "solar:users-group-rounded-linear",
    tone: "bg-x-parent-100 text-x-parent-700",
  },
  // `mint-500` measured 1.72:1 on `mint-100`; `mint-700` measures 4.07:1.
  "access-created": {
    icon: "solar:key-minimalistic-linear",
    tone: "bg-x-kid-mint-100 text-x-kid-mint-700",
  },
  "access-revoked": {
    icon: "solar:shield-cross-linear",
    tone: "bg-x-teen-100 text-x-teen-700",
  },
  "child-login": {
    icon: "solar:login-linear",
    tone: "bg-x-parent-100 text-x-parent-700",
  },
  // The teal tint carries the "something we do not have a name for" reading, in
  // the teen panel's 700 ink for the same reason `x-teen-teal-500` did in the
  // prototype: the accent itself is decorative and unreadable at this size.
  other: {
    icon: "solar:pulse-2-linear",
    tone: "bg-x-teen-teal-300/40 text-x-teen-700",
  },
};

const meta = computed(() => KIND_META[props.kind]);
</script>

<template>
  <span
    class="grid size-10 shrink-0 place-items-center rounded-2xl"
    :class="meta.tone"
    aria-hidden="true"
  >
    <UIcon :name="meta.icon" size="18" />
  </span>
</template>
