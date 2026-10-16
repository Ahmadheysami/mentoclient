<script lang="ts">
/**
 * One row of the popup.
 *
 * Exported from this file (an SFC needs the plain `<script>` block for a named
 * export) rather than from `app/types/cafe.ts`, because it is not a shape the
 * backend sends — it is a shape this component invents, and it belongs next to
 * the only component that reads it. Same split `MessageBubble.vue` uses for its
 * poll types.
 */
export interface ICafeFabMenuItem {
  label: string;
  icon: string;
  /** Route. Omit for an item Phase 1 does not navigate to yet. */
  to?: string;
  /** Called after the menu has closed. */
  onSelect?: () => void;
  /**
   * A destination this phase deliberately does not wire.
   *
   * The row keeps its shape and its badge but drops every affordance that
   * promises an action: it greys, it leaves the tab order, it is announced as
   * disabled and — importantly — pressing it does **not** close the menu, so it
   * cannot be mistaken for a button whose only job happens to be a no-op.
   */
  disabled?: boolean;
  /** Short reason for `disabled`, on the row's inline-end. e.g. «به‌زودی». */
  badge?: string;
}
</script>

<script setup lang="ts">
import { useEventListener } from "@vueuse/core";

/**
 * The floating action button and the popup menu above it — the signature detail
 * of Screen A in `docs/design/cafe-ui.webp`, and the one piece of this feature
 * with motion, focus and outside-click behaviour of its own.
 *
 * ## GEOMETRY
 *
 * The whole component is `fixed` so it escapes the `h-dvh` column's own layout
 * and stays reachable from every scroll position — and `inset-x-0 mx-auto
 * max-w-md` makes it resolve against **the phone column**, not the viewport. A
 * bare `fixed end-4` would be glued to the right-hand edge of a desktop browser
 * window, hundreds of pixels from the screen it belongs to. The wrapper is
 * `pointer-events-none` with no height of its own; the two children opt back in.
 *
 * The FAB sits at `bottom-24` (96px). `CafeBottomMenu` is 72px of pill plus
 * `max(1rem, env(safe-area-inset-bottom))` of clearance, so 96px clears it on
 * every device including a home-indicator one. The menu sits at `bottom-40`
 * (160px), which is the FAB's own top edge (96 + 56 = 152) plus an 8px gap —
 * the menu therefore appears to grow straight out of the button.
 *
 * ## WHY `origin-bottom-left` AND NOT A LOGICAL KEYWORD
 *
 * `transform-origin` is a **physical** property with no logical keyword: there is
 * no `origin-bottom-inline-end`. The menu is anchored to the FAB's inline-end
 * edge, and because the app is hard-coded `dir="rtl"`, inline-end is the physical
 * **left**. `origin-bottom-left` is therefore not a hard-coded direction here —
 * it is the one place where the mirroring has to be spelled out, because CSS
 * cannot express it. Everything else about the menu (its `end-4` offset, the
 * FAB's `end-4`, the item text, the chevrons) uses logical utilities and mirrors
 * itself.
 *
 * The menu and the FAB share the same `end-4`, so their inline-end edges line up
 * and the menu looks hinged to the button rather than merely near it.
 *
 * ## THE ICON BECOMES AN ✕
 *
 * The FAB's glyph rotates 45° into an X while the menu is open, because that is
 * the affordance iOS — the platform this design is taken from — uses, and a
 * reader who has seen it anywhere will expect it here. Only the **icon**
 * rotates: rotating the button itself would rotate its black circle into a
 * visible gap in the pill's silhouette.
 *
 * ## REDUCED MOTION — TWO PLACES, NO JAVASCRIPT
 *
 * There is no `matchMedia` here and no `prefers-reduced-motion` watcher, for two
 * independent reasons:
 *
 * 1. The project's global block in `app/assets/css/main.css` already flattens
 *    every `transition-duration` and `animation-duration` to `1ms` under
 *    `html[data-motion="reduced"]`, **unlayered and `!important`** — precisely
 *    so it outranks a Tailwind `transition-*` on the same element. This
 *    component's transitions are ordinary Tailwind `transition-*` utilities, so
 *    they are already covered.
 * 2. `motion-reduce:*` on the classes below covers the reader whose OS asks for
 *    reduced motion but whose in-app setting is `system` — the one gap
 *    `main.css` documents as its own KNOWN LIMIT.
 *
 * Two mechanisms that both resolve to "do not move", neither of which needs a
 * listener, a reflow or a re-render. Note what this costs: the menu still
 * **appears and disappears**, it simply does not travel. That is the correct
 * trade — `v-if`/`v-show` on a popup is an existence change, not an animation,
 * and a reduced-motion reader still needs the menu to open.
 *
 * ## CONTROLLED-OR-NOT
 *
 * `open` may be bound (`v-model:open`) or not. With no binding the component
 * owns its state; with one it becomes a pure function of the parent and emits
 * every change so the parent can veto or mirror it. A FAB that can only open
 * itself forces every screen that needs to close it on a route change to reach
 * inside it with a template ref.
 *
 * ## DISMISSAL
 *
 * Outside `pointerdown` (not `click`: a pointer that goes down on the list behind
 * the menu and up somewhere else must still dismiss) and `Escape`, which also
 * returns focus to the FAB — a menu that closes and drops the caret on `<body>`
 * strands a keyboard reader at the top of the document.
 *
 * Both listeners go through VueUse's `useEventListener`, which registers only
 * while the menu is open and disposes with the component: no `onMounted` /
 * `onBeforeUnmount` pair to forget, and no window listener left behind by a
 * screen that was navigated away from mid-press. `passive: true` because nothing
 * here calls `preventDefault`.
 *
 * ## CONTROLLED-OR-NOT
 *
 * `open` may be bound (`v-model:open`) or not. With no binding the component owns
 * its own state; with one it becomes a pure function of the parent and still
 * emits every change so the parent can veto or mirror it. A FAB that can only
 * open itself forces every screen that needs to close it on a route change to
 * reach inside it with a template ref.
 */

const props = withDefaults(
  defineProps<{
    items?: ICafeFabMenuItem[];
    /**
     * The open state. **Omit it** and the component owns its own; bind it and it
     * becomes a pure function of the parent, still emitting every change.
     */
    open?: boolean;
    /** Persian label for the button itself. */
    label?: string;
  }>(),
  {
    label: "ساختن گفتگوی تازه",
    /*
     * ⚠️ `open: undefined` IS THE POINT and must not be "cleaned up".
     *
     * Vue's **boolean casting**: a prop whose type includes `Boolean` and which
     * the caller did not pass is cast to `false` — not left `undefined` — unless
     * the prop declares a default. This component's whole uncontrolled mode is
     * decided by `props.open !== undefined` below, so a silent `false` would
     * leave every unbound `CafeFabMenu` permanently closed and every
     * `v-model:open` binding starting out shut, with no error anywhere.
     * `default: undefined` is Vue's documented way to opt out of the cast.
     */
    open: undefined,
  },
);

const emit = defineEmits<{
  "update:open": [boolean];
  /** The label of whichever row was pressed, so a Phase 2 page can route on it. */
  select: [string];
}>();

/**
 * The mockup's five, restated in this feature's vocabulary.
 *
 * They carry **no `to`**: every one of those screens is Wave 2, and a link to a
 * route that does not exist yet is a 404 the reader has to be the first to find.
 * Without `to` they render as buttons that close the menu and emit `select` —
 * inert for now, and honest about being so rather than pretending to navigate.
 */
const DEFAULT_ITEMS: ICafeFabMenuItem[] = [
  { label: "پیام تازه", icon: "solar:chat-square-linear" },
  { label: "گروه تازه", icon: "solar:users-group-rounded-linear" },
  { label: "کانال تازه", icon: "solar:record-circle-linear" },
  { label: "پیوند دعوت", icon: "solar:link-linear" },
  { label: "جست‌وجوی کاربر", icon: "solar:magnifer-linear" },
];

const items = computed(() => props.items ?? DEFAULT_ITEMS);

/**
 * `NuxtLink` must be passed to `:is` as the **component**, never as its name.
 *
 * NuxtLink is a compile-time auto-import, not a globally registered component,
 * so the string `'NuxtLink'` falls through `<component>`'s native-element branch
 * and SSR emits a literal `<NuxtLink to="…">` custom element — a dead row with no
 * `href`, no router link and no click behaviour at all. `RouterLink` *is*
 * globally registered, which is why the string form works for it and silently
 * fails only for this one. `resolveComponent()` has to run in setup, so it
 * cannot be written inline in the template.
 */
const NuxtLinkComponent = resolveComponent("NuxtLink");

/* ------------------------------------------------------------- open state -- */

const internalOpen = ref(false);

/** A binding is present only if the parent passed the prop at all. */
const controlled = computed(() => props.open !== undefined);

const isOpen = computed({
  get: () => (controlled.value ? props.open === true : internalOpen.value),
  set: (value: boolean) => {
    if (!controlled.value) internalOpen.value = value;
    emit("update:open", value);
  },
});

/* ----------------------------------------------------------------- refs -- */

const root = useTemplateRef<HTMLElement>("root");
const fab = useTemplateRef<HTMLButtonElement>("fab");

/** Set while the pointer is going down *inside* the component, so the outside
 * handler can tell "tapped the FAB" from "tapped the page behind it". */
function contains(target: EventTarget | null): boolean {
  return target instanceof Node && root.value?.contains(target) === true;
}

/* ------------------------------------------------------------ dismissal -- */

/**
 * `pointerdown`, not `click`: a press that starts on the list behind the menu and
 * ends anywhere still counts as choosing the list, and waiting for `click` would
 * leave the menu open under the reader's finger.
 */
function onPointerdown(event: PointerEvent) {
  if (!isOpen.value) return;
  if (contains(event.target)) return;

  close();
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value || event.key !== "Escape") return;

  event.preventDefault();
  close();
}

/**
 * `useEventListener` registers only while the menu is open and disposes on
 * scope teardown, so there is no `onMounted`/`onBeforeUnmount` pair to keep in
 * step and no `window` listener surviving a navigation away mid-press.
 */
useEventListener(window, "pointerdown", onPointerdown, { passive: true });
useEventListener(window, "keydown", onKeydown);

/* ------------------------------------------------------------------- open -- */

async function open() {
  isOpen.value = true;

  // Focus the first row so a keyboard reader is inside the menu rather than
  // having to guess that it opened. `nextTick` because the rows do not exist
  // until the transition has mounted them.
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
    ?.focus();
}

function close() {
  isOpen.value = false;
  fab.value?.focus();
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function select(item: ICafeFabMenuItem) {
  // A `disabled` row is not an action, so it must not produce the one visible
  // effect an action has — closing the menu would tell the reader the press did
  // something, which is precisely the lie the flag exists to remove.
  if (item.disabled) return;

  // Close first: the menu is a navigation intent, and leaving it open over the
  // screen it just opened would be the worse of the two states.
  close();
  emit("select", item.label);
  item.onSelect?.();
}

/* --------------------------------------------------------------- motion -- */

/**
 * 170ms in / 120ms out. Faster out than in because a dismissal is usually
 * followed by movement elsewhere on the screen, and a reader who has committed
 * to an action should not wait to start it.
 */
const MENU_TRANSITION = {
  enterActiveClass:
    "transition-[opacity,transform] duration-[170ms] ease-out",
  enterFromClass: "opacity-0 scale-95",
  enterToClass: "opacity-100 scale-100",
  leaveActiveClass:
    "transition-[opacity,transform] duration-[120ms] ease-in",
  leaveFromClass: "opacity-100 scale-100",
  leaveToClass: "opacity-0 scale-95",
} as const;
</script>

<template>
  <div
    ref="root"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md"
  >
    <Transition v-bind="MENU_TRANSITION">
      <!--
        `role="menu"` on the container and `role="menuitem"` on each row is the
        ARIA menu pattern, which is what tells an assistive technology that this
        is a popup of commands rather than a list of links — and, importantly,
        that arrow keys are expected.

        They are not implemented, and that is written down rather than faked: this
        is a popup of at most five rows that are all ordinary `<button>`/
        `<NuxtLink>` elements, so Tab and Shift+Tab reach every one of them in
        DOM order and Escape returns focus to the FAB. Adding roving
        `tabindex` without the arrow-key handler that goes with it would make the
        menu *harder* to use from a keyboard than the plain focus behaviour that
        works today.

        `aria-controls`/`aria-expanded` on the FAB are the other half of the
        contract: without them the button says nothing about what it owns. The
        menu takes the SAME `label` as the FAB because it IS that button's
        popup — a hard-coded name here would say «ساختن گفتگوی تازه» on a screen
        whose button says «ساختن کافه», and the two are the same control.
      -->
      <div
        v-if="isOpen"
        id="cafe-fab-menu"
        role="menu"
        :aria-label="label"
        class="pointer-events-auto absolute end-4 bottom-40 w-56 overflow-hidden rounded-2xl bg-x-primary-content-50 ring-1 ring-slate-200 shadow-xl shadow-slate-900/10 origin-bottom-left"
      >
        <!--
          A `disabled` row is rendered as a `<button>` even if a `to` was passed:
          an anchor is navigable by the browser itself, so guarding the click
          handler would not have stopped it. `tabindex="-1"` is what takes it out
          of the tab order — a disabled row a keyboard reader can land on is a
          dead stop, and there is nothing on it to discover.
        -->
        <component
          :is="item.disabled || !item.to ? 'button' : NuxtLinkComponent"
          v-for="item in items"
          :key="item.label"
          :to="item.disabled ? undefined : item.to"
          :type="item.disabled || !item.to ? 'button' : undefined"
          role="menuitem"
          :tabindex="item.disabled ? -1 : undefined"
          :aria-disabled="item.disabled ? 'true' : undefined"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex w-full items-center gap-3 px-4 py-3.5 text-start text-x-text-title transition-colors not-last:border-b border-slate-200"
          :class="
            item.disabled
              ? 'cursor-default opacity-50'
              : 'hover:bg-x-primary-content-200 focus-visible:bg-x-primary-content-200'
          "
          @click="select(item)"
        >
          <UIcon :name="item.icon" size="20" aria-hidden="true" />
          <span class="text-[15px]">{{ item.label }}</span>

          <!--
            The reason, in the chip idiom `CafeTableCard`'s «صوتی»/«اشتراکی»
            already use rather than a colour of its own: a second red or gold for
            "not yet" would be a second meaning for a word this feature already
            spends its colours on. `ms-auto` puts it on the inline-end, opposite
            the icon, so the label never shifts when a badge appears or goes.
          -->
          <span
            v-if="item.badge"
            class="ms-auto shrink-0 rounded-full bg-x-primary-content-200 px-2 py-0.5 text-[11px] font-bold text-x-text-subtitle"
          >
            {{ item.badge }}
          </span>
        </component>
      </div>
    </Transition>

    <button
      ref="fab"
      type="button"
      :aria-label="label"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      aria-controls="cafe-fab-menu"
      class="pointer-events-auto absolute end-4 bottom-24 grid size-14 place-items-center rounded-full bg-x-text-title text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500 transition-[transform] duration-[170ms] ease-out motion-reduce:transition-none"
      @click="toggle"
    >
      <!--
        Only the glyph rotates. `motion-reduce:*` appears on both this and the
        menu's transition classes; see "REDUCED MOTION" in the header.

        `add-circle` rather than a bare `+`: Iconify's Solar set has no
        circle-less plus, and a circle is rotationally symmetric — so under the
        45° turn it does not visibly rotate at all while the plus inside it
        becomes an ×. It also matches the `*-circle-linear` idiom every other icon
        in this feature already uses (`ComposerShell`'s `+`, `MessageBubble`'s
        play button, `UnreadBadge`).
      -->
      <UIcon
        name="solar:add-circle-linear"
        size="26"
        aria-hidden="true"
        class="transition-transform duration-[170ms] ease-out motion-reduce:transition-none"
        :class="isOpen ? 'rotate-45' : 'rotate-0'"
      />
    </button>
  </div>
</template>