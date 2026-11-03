<script lang="ts">
/**
 * One row of the message context menu.
 *
 * Exported from this file (an SFC needs the plain `<script>` block for a named
 * export) rather than from `app/types/cafe.ts`, because it is a shape this
 * component invents — not one the backend sends. Same split `MessageBubble.vue`
 * uses for its poll types and `AttachSheet.vue` for its tiles.
 */

/**
 * What the menu asks the page to DO — never what it does itself.
 *
 * ⚠️ The menu performs no request and touches no store. Every row collapses to
 * one of these six intents and the parent carries it out, so the sheet can be
 * rendered from anywhere (the transcript, a test, a future list row) and still
 * never owns a mutation.
 */
export type CafeMessageIntent = "reply" | "copy" | "like" | "report" | "edit" | "delete";

/** A row as the menu draws it: its intent, its Persian label, its glyph. */
export interface ICafeMessageMenuRow {
  intent: CafeMessageIntent;
  label: string;
  icon: string;
  /** Red ink. Used by `delete` — the one row that removes something. */
  destructive?: boolean;
}
</script>

<script setup lang="ts">
import type { ICafeThreadMessage } from "~/types/cafe";

/**
 * The per-message context menu, as a bottom `USlideover`.
 *
 * ## WHY A SHEET AND NOT A POPOVER
 *
 * Doc §7 calls this a "right-click context menu", and on a desktop that is a
 * popover at the pointer. A phone has no right-click, so the only gesture that
 * works one-handed is a long press — and a long press has nowhere to put a
 * popover except under the finger that is holding it. `USlideover side="bottom"`
 * is what the reference platform (Telegram) does for exactly this reason: the
 * actions are a list, the list is one-thumb reachable, and dismissing it is a
 * tap anywhere rather than a precise hit on a small target. The doc specifies
 * *which* commands exist and who may see them; it does not specify a geometry,
 * and mobile-first is this app's rule.
 *
 * ## ⚠️ THE VISIBILITY MATRIX IS THE DOC'S, VERBATIM
 *
 * `docs/X123ApiDocs.md` §7 states one visibility per command, and this file
 * implements exactly that — including the part that is a **superset** of
 * «managers only»:
 *
 * | row     | shown when                                                              |
 * |---------|-------------------------------------------------------------------------|
 * | پاسخ     | the reader is allowed to send in this table                            |
 * | کپی متن  | always                                                                  |
 * | پسندیدن | always, and it reads the message's CURRENT like state                   |
 * | گزارش    | always                                                                  |
 * | ویرایش   | `isManager === true` OR (`senderId === me` AND `status === "active"`)    |
 * | حذف     | `isManager === true` OR (`senderId === me`)                             |
 *
 * A manager therefore sees all six, and an ordinary member additionally sees
 * edit/delete on their **own** messages — which §11 and §12 back on the server
 * side. Narrowing this to «managers only» would remove two actions the backend
 * explicitly allows, so the matrix is written out rather than summarised.
 *
 * ## ⚠️ «پسندیدن / نپسندیدن» IS ONE ROW, AND IT READS THE STATE
 *
 * §9 is a single TOGGLE with no intent parameter and no dislike endpoint:
 * «disliking» is un-liking. So there is no «نپسندیدن» command — there is one
 * command whose LABEL follows the message's current state, which is what
 * `liked` is for. Two rows would promise a choice the API does not take.
 *
 * ## FOCUS IS THE PARENT'S TO GIVE BACK
 *
 * The menu takes focus when it opens (below) and the page returns it to the
 * message that opened the menu when it closes. This component cannot: the
 * element that was long-pressed is the parent's, and a menu that closed and
 * dropped the caret on `<body>` strands a keyboard reader at the top of the
 * document.
 *
 * ## `role="menu"` IS NOT DECORATIVE
 *
 * The container is `role="menu"` and every row is `role="menuitem"`, which is
 * what tells an assistive technology this is a popup of commands rather than a
 * list of links — and, with them, that arrow keys are **expected**. They are
 * implemented below (`onKeydown`): Home/End jump to the ends, ArrowDown/ArrowUp
 * and the RTL-correct ArrowLeft/ArrowRight move by one, and every move wraps.
 * `Escape` is reka's own (`escapeKeyDown`) and comes out as `update:open`.
 *
 * The rows are real `<button>`s, so a pointer, a keyboard and a screen reader
 * all activate the same element, and `aria-expanded`/`aria-haspopup` live on the
 * control that opens the menu — which is `CafeMessageList`'s row.
 */

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** The message every command is about. Only `id` / `status` are read. */
    message: ICafeThreadMessage;
    /** True when the reader sent it — resolved by the list, like `own` on a bubble. */
    own: boolean;
    /** The reader may post in this table: membership AND the sending window. */
    canSend: boolean;
    /** `GET …/single`'s `isManager`. §7's manager arm on edit and delete. */
    isManager: boolean;
    /** Whether THIS reader is already in the message's `like` array. */
    liked: boolean;
  }>(),
  { own: false, canSend: false, isManager: false, liked: false },
);

const emit = defineEmits<{
  "update:open": [boolean];
  select: [intent: CafeMessageIntent];
}>();

/**
 * Every row, once, in the order a messenger draws them: answer the message,
 * then the harmless commands, then the two that change it.
 *
 * ⚠️ ONE TABLE, NOT SIX SCATTERED LABELS. The like row's label is a function of
 * `liked`, so the label lives next to the intent rather than being retyped at
 * each call site — and there is exactly one place left to change if a row is
 * renamed.
 */
const ROWS: readonly ICafeMessageMenuRow[] = [
  { intent: "reply", label: "پاسخ", icon: "solar:reply-linear" },
  { intent: "copy", label: "کپی متن", icon: "solar:copy-linear" },
  { intent: "like", label: "پسندیدن", icon: "solar:heart-linear" },
  { intent: "report", label: "گزارش", icon: "solar:danger-triangle-linear" },
  { intent: "edit", label: "ویرایش", icon: "solar:notes-minimalistic-linear" },
  { intent: "delete", label: "حذف", icon: "solar:trash-bin-trash-linear", destructive: true },
];

/**
 * §7's matrix, as one predicate per intent.
 *
 * ⚠️ `status === "active"` IS READ FOR EDIT AND **NOT** FOR DELETE, and that is
 * the document's own asymmetry: a soft-moderated message (`submitted-for-review`,
 * `suspended`) may not be edited but may still be removed by its author. Copying
 * the edit arm into delete would take away an action the API allows.
 */
function visible(intent: CafeMessageIntent): boolean {
  const status = props.message.status;

  switch (intent) {
    case "reply":
      return props.canSend;
    case "copy":
    case "like":
    case "report":
      return true;
    case "edit":
      return props.isManager || (props.own && status === "active");
    case "delete":
      return props.isManager || props.own;
  }
}

const rows = computed<ICafeMessageMenuRow[]>(() =>
  ROWS.filter((row) => visible(row.intent)).map((row) => {
    // The one row whose LABEL is its state: §9 has a single toggle, so the menu
    // says «نپسندیدن» exactly when this reader's like is currently on.
    if (row.intent !== "like") return row;

    return props.liked
      ? { ...row, label: "نپسندیدن", icon: "solar:heart-bold" }
      : row;
  }),
);

/** The name of the message this menu is about, for the sheet's accessible name. */
const title = computed(() => (props.own ? "پیام شما" : "این پیام"));

/* ------------------------------------------------------------------- focus -- */

const container = useTemplateRef<HTMLElement>("container");

/** Every row, in DOM order. An empty array before the sheet has portalled in. */
function items(): HTMLElement[] {
  const found = container.value?.querySelectorAll<HTMLElement>('[role="menuitem"]');

  return found === undefined ? [] : [...found];
}

/**
 * Move the caret by `step` rows, wrapping, and land on a real one.
 *
 * ⚠️ A menu drawn at the BOTTOM of the screen has to read top-to-bottom for the
 * first item, which is `ArrowDown`, and that is the same in RTL — `ArrowDown`
 * means "later in the list", never "later in the reading direction". `ArrowLeft`
 * / `ArrowRight` are accepted too because in this app's hard-coded `dir="rtl"`
 * they are the two keys a reader's thumb is already on, and treating them as
 * previous/next is what a menu does everywhere on a phone.
 */
function move(step: number): void {
  const list = items();
  if (list.length === 0) return;

  const active = document.activeElement;
  const from = list.findIndex((node) => node === active);

  const next = list[(from + step + list.length) % list.length];

  next?.focus();
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case "ArrowDown":
    case "ArrowRight":
      event.preventDefault();
      move(1);
      break;
    case "ArrowUp":
    case "ArrowLeft":
      event.preventDefault();
      move(-1);
      break;
    case "Home":
      event.preventDefault();
      items()[0]?.focus();
      break;
    case "End": {
      event.preventDefault();
      const list = items();
      list[list.length - 1]?.focus();
      break;
    }
  }
}

/**
 * Focus the FIRST row when the sheet opens, so a keyboard reader is inside the
 * menu rather than having to guess where in the sheet it landed.
 *
 * `nextTick` because the rows do not exist until reka has portalled the content
 * in. ⚠️ The composable never reads `document` off the server path: this runs
 * from a `watch` on `open`, which only changes from a tap or a keyboard press.
 */
watch(
  () => props.open,
  (open) => {
    if (!open) return;

    void nextTick(() => {
      items()[0]?.focus();
    });
  },
);

/* ------------------------------------------------------------------ select -- */

/**
 * Close, then emit — in that order.
 *
 * A menu left open under a sheet the reader is about to type into is a bug, and
 * `ReportSheet` in particular opens OVER this one. The page owns focus
 * restoration and acts on the intent.
 */
function choose(row: ICafeMessageMenuRow): void {
  emit("update:open", false);
  emit("select", row.intent);
}
</script>

<template>
  <USlideover
    :open="open"
    side="bottom"
    :title="title"
    :description="'یکی از گزینه‌های زیر را انتخاب کنید.'"
    :ui="{
      /*
        Same geometry `CafeAttachSheet` uses, for the same reason: a sheet that
        spans the phone column edge to edge with a ring around it reads as a
        floating card rather than as a sheet rising from the bottom.
      */
      content:
        'mx-auto max-w-md divide-y-0 rounded-t-3xl ring-0 sm:ring-0 border-t border-slate-200',
      header: 'p-4 sm:p-4',
      body: 'p-0 sm:p-0',
      title: 'text-base font-bold text-x-text-title',
      description: 'text-xs text-x-text-subtitle',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        ref="container"
        role="menu"
        aria-label="گزینه‌های پیام"
        class="pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1"
        @keydown="onKeydown"
      >
        <!--
          `min-h-11` on every row: this is a one-handed menu reached by a thumb
          at the bottom of the screen, and 44px is the floor below which a target
          is hard to hit. `not-last:border-b` matches `CafeFabMenu`'s rows so the
          two menus in this feature read as one vocabulary.
        -->
        <button
          v-for="row in rows"
          :key="row.intent"
          type="button"
          role="menuitem"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-x-primary-content-200 focus-visible:bg-x-primary-content-200 not-last:border-b border-slate-100"
          :class="row.destructive ? 'text-red-600' : 'text-x-text-title'"
          @click="choose(row)"
        >
          <UIcon :name="row.icon" size="20" aria-hidden="true" />

          <span class="text-[15px]">{{ row.label }}</span>
        </button>
      </div>
    </template>
  </USlideover>
</template>
