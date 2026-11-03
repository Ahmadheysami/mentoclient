<script lang="ts">
/**
 * One row of the table menu.
 *
 * Exported from this file (an SFC needs the plain `<script>` block for a named
 * export) rather than from `app/types/cafe.ts`, because it is a shape this
 * component invents — the same split `MessageMenu.vue` and `AttachSheet.vue`
 * use.
 */

/** What the header's `⋯` asks the page to do. The page performs both. */
export type CafeTableIntent = "report" | "leave";
</script>

<script setup lang="ts">
/**
 * The header's `⋯` — the ONE overflow affordance a conversation has, and the
 * only place §7's table-level report is reachable from.
 *
 * ## WHY THIS IS A SLIDEOVER AND NOT A POPOVER
 *
 * Same reason as `CafeMessageMenu`, for the same reason: a phone has no
 * right-click, and the menu's actions are two rows of Persian text with icons
 * that a thumb at the bottom of the screen can actually hit at 44px. A popover
 * anchored to a 44px button in the header puts its rows under the header on a
 * 360px phone, which is neither reachable nor reachable-one-handed.
 *
 * ## ⚠️ «خروج از میز» IS NOT CONFIRMED HERE, AND THAT IS A DELIBERATE CHOICE
 *
 * Leaving is a SOFT membership write (§6 sets `status: "left"`), it is not a
 * deletion of anything, and it is undone by one tap — «عضویت در میز» on the join
 * bar below the thread, which `POST /table/subscribe` reactivates. A
 * confirmation gate on top of that would be a second modal for an action with a
 * one-tap inverse, on the one screen that is deliberately a column of space. The
 * destructive emphasis (red ink, a leave icon) carries the weight instead.
 *
 * The message **delete** is the opposite case and does get a confirmation —
 * `CafeConfirmDelete` — because a soft delete replaces the body for everyone in
 * the room and re-posting the words is not guaranteed.
 *
 * ## IT CALLS NOTHING
 *
 * `leaving` and `disabled` come in as props and the chosen intent goes out as an
 * event, exactly like `Goal/CreateSheet` documents: a component that also
 * mutated would have to be re-mounted to forget a failed attempt.
 */

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** A leave is in the air — the row shows it and refuses a second press. */
    leaving?: boolean;
    /** The reader may leave at all. A non-member has nothing to leave. */
    canLeave?: boolean;
    /** The table's name, so the sheet can say WHICH table is being reported. */
    tableName?: string;
  }>(),
  { leaving: false, canLeave: true, tableName: "" },
);

const emit = defineEmits<{
  "update:open": [boolean];
  select: [intent: CafeTableIntent];
}>();

/** The sheet's accessible name. A nameless table would print «گفتگو» twice. */
const title = computed(() => "گزینه‌های گفتگو");

const description = computed(() =>
  props.tableName === ""
    ? "گزارش این میز یا خروج از آن."
    : `${props.tableName} — گزارش این میز یا خروج از آن.`,
);

const rows = computed<Array<{ intent: CafeTableIntent; label: string; icon: string; destructive?: boolean }>>(
  () => [
    {
      intent: "report",
      label: "گزارش میز",
      icon: "solar:danger-triangle-linear",
    },
    ...(props.canLeave
      ? [
          {
            intent: "leave" as const,
            label: "خروج از میز",
            icon: "solar:logout-2-linear",
            destructive: true,
          },
        ]
      : []),
  ],
);

/** A leave already in the air is not a second intent to press. */
function choose(intent: CafeTableIntent): void {
  if (intent === "leave" && props.leaving) return;

  emit("update:open", false);
  emit("select", intent);
}
</script>

<template>
  <USlideover
    :open="open"
    side="bottom"
    :title="title"
    :description="description"
    :ui="{
      /*
        The same geometry as the two sheets above it: full phone column, rounded
        top, no ring — a sheet that spans edge to edge with an outline around it
        reads as a floating card rather than as a sheet.
      */
      content:
        'mx-auto max-w-md divide-y-0 rounded-t-3xl ring-0 sm:ring-0 border-t border-slate-200',
      header: 'p-4 sm:p-4',
      body: 'p-0 sm:p-0',
      title: 'text-base font-bold text-x-text-title',
      description: 'text-xs leading-6 text-x-text-subtitle',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        role="menu"
        aria-label="گزینه‌های گفتگو"
        class="pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
      >
        <!--
          `min-h-11`, `not-last:border-b` and the row padding are copied from
          `CafeMessageMenu` deliberately: two menus in one feature that measure
          differently is how a design system starts drifting. Arrow-key movement
          is reka's focus trap plus the rows being real buttons, so Tab and the
          arrow keys both reach every row without roving `tabindex` here.
        -->
        <button
          v-for="row in rows"
          :key="row.intent"
          type="button"
          role="menuitem"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-x-primary-content-200 focus-visible:bg-x-primary-content-200 not-last:border-b border-slate-100"
          :class="row.destructive ? 'text-red-600' : 'text-x-text-title'"
          @click="choose(row.intent)"
        >
          <UIcon :name="row.icon" size="20" aria-hidden="true" />

          <span class="text-[15px]">{{ row.label }}</span>
        </button>
      </div>
    </template>
  </USlideover>
</template>
