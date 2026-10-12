<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * Vertical step indicator for the goal detail page. Pure presentation: the
 * parent page decides each step's status, this only draws it. Kid follows a
 * dotted playful trail; teen a refined continuous line.
 */
type StepStatus = "done" | "active" | "pending-parent" | "locked";

const props = defineProps<{
  steps: Array<{ status: StepStatus }>;
  variant: "child" | "teen";
}>();

interface Marker {
  icon: string;
  chipClass: string;
  label: string;
}

const markers: Record<StepStatus, Marker> = {
  done: {
    icon: "solar:check-circle-bold",
    chipClass: "bg-x-kid-mint-100 text-x-kid-mint-700",
    label: "انجام‌شده",
  },
  active: {
    icon: "solar:play-circle-bold",
    chipClass: "bg-x-kid-sun-100 text-x-kid-sun-700",
    label: "در حال انجام",
  },
  "pending-parent": {
    icon: "solar:hourglass-linear",
    chipClass: "bg-x-kid-berry-100 text-x-kid-berry-700",
    label: "منتظر تأیید والد",
  },
  locked: {
    icon: "solar:lock-linear",
    chipClass: "bg-slate-100 text-slate-500",
    label: "قفل",
  },
};

/** Teen uses the same semantics, quieter colours. */
const teenMarkers: Record<StepStatus, Marker> = {
  done: {
    icon: "solar:check-circle-bold",
    chipClass: "bg-x-teen-mint-300/50 text-x-teen-mint-700",
    label: "انجام‌شده",
  },
  active: {
    icon: "solar:play-circle-bold",
    chipClass: "bg-x-teen-violet-300/45 text-x-teen-violet-600",
    label: "در حال انجام",
  },
  "pending-parent": {
    icon: "solar:hourglass-linear",
    chipClass: "bg-x-teen-coral-300/50 text-x-teen-coral-500",
    label: "منتظر تأیید والد",
  },
  locked: {
    icon: "solar:lock-linear",
    chipClass: "bg-slate-100 text-slate-500",
    label: "قفل",
  },
};

const current = computed(() =>
  props.variant === "child" ? markers : teenMarkers,
);
</script>

<template>
  <ol class="grid gap-0">
    <li
      v-for="(step, index) in steps"
      :key="index"
      class="relative flex gap-3 pb-5 last:pb-0"
    >
      <!-- Connector: dotted trail for kid, refined line for teen -->
      <span
        v-if="index < steps.length - 1"
        aria-hidden="true"
        class="absolute top-8 bottom-0 start-[15px] w-0 border-s-2"
        :class="
          variant === 'child'
            ? step.status === 'done'
              ? 'border-dotted border-x-kid-sun-500'
              : 'border-dotted border-x-kid-100'
            : step.status === 'done'
              ? 'border-x-teen-teal-500'
              : 'border-x-teen-200'
        "
      />

      <span
        class="relative z-10 grid size-8 shrink-0 place-items-center rounded-full"
        :class="current[step.status].chipClass"
        :aria-label="`مرحلهٔ ${faNumber(index + 1)}: ${current[step.status].label}`"
      >
        <UIcon :name="current[step.status].icon" size="16" aria-hidden="true" />
      </span>

      <div class="min-w-0 flex-1 pt-1">
        <span
          class="text-xs font-yekan-bold"
          :class="variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-700'"
        >
          مرحلهٔ {{ faNumber(index + 1) }}
        </span>
        <span
          class="ms-1 rounded-full px-2 py-0.5 text-[11px] font-yekan-bold"
          :class="current[step.status].chipClass"
        >
          {{ current[step.status].label }}
        </span>
      </div>
    </li>
  </ol>
</template>
