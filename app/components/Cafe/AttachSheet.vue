<script lang="ts">
/**
 * One tile of the sheet.
 *
 * Exported from this file (an SFC needs the plain `<script>` block for a named
 * export) rather than from `app/types/cafe.ts`, because it is a shape this
 * component invents, not one the backend sends — the same split
 * `MessageBubble.vue` uses for its poll types.
 */
export interface ICafeAttachOption {
  /** Stable identifier the page acts on. Persian labels are not keys. */
  key: string;
  label: string;
  icon: string;
  /** `"accent"` for `x-primary-*`, `"neutral"` for `x-primary-content-200`. */
  tone?: "accent" | "neutral";
}
</script>

<script setup lang="ts">
/**
 * The composer's `+` sheet — what you can attach to a message.
 *
 * ## WHY `USlideover` AND NOT `UModal`
 *
 * The repo's precedent is `UModal` everywhere (`Goal/CreateSheet.vue`,
 * `Plan/BuyModal.vue`, `Ui/Modal.vue`), and all of them are **forms**: a sheet
 * that owns a title, a body of fields and a footer of two buttons. This is none
 * of those things — it is a 3×2 grid of eight icon buttons with no field
 * anywhere and no footer, and `UModal`'s centre-of-the-screen geometry would
 * turn a picker into a dialog you have to dismiss before you can see the thread
 * behind it.
 *
 * `USlideover side="bottom"` is the Nuxt UI v4 primitive for exactly this
 * geometry, it takes the same `open` / `update:open` contract as `UModal` (so a
 * page that later swaps one for the other changes nothing else), and it hands us
 * `role="dialog"` + `aria-modal` + focus trapping + Escape-to-close from
 * `reka-ui` through the primitive — **none of which is re-declared here.**
 * Adding `role="dialog"` to the body of an overlay that already has one produces
 * two nested dialogs and breaks the focus trap.
 *
 * ## WHY THE GRID IS NOT A WALL OF BLUE
 *
 * Six identical `x-primary-50` squares read as one big button. The accent
 * carries *emphasis*, so it is spent on the two rows the reader reaches for
 * first (camera, image) and the rest fall back to the neutral
 * `x-primary-content-200` the thread itself is drawn on. The result is a grid
 * that has a beginning and an end instead of a wall.
 *
 * Neutral squares take `text-x-text-title` ink and accent squares take
 * `text-x-primary-800` — both are body-ink tokens, not `text-white` on a pale
 * fill, which would be the worst contrast pair available.
 *
 * ## WHY IT RENDERS NOTHING THIS PHASE CAN DO
 *
 * Each tile is a real `<button>` that emits `select` with its key and closes.
 * Phase 1 wires no upload, no camera and no `MediaRecorder` — those are Wave 2's
 * job with the socket. A tile that pretended to open a file picker would either
 * do nothing or pick a file with nowhere to send it, and both are worse than a
 * key the page is waiting for. The precedent is `MessageBubble`'s disabled play
 * button and `CafeFabMenu`'s default rows.
 *
 * ## THE CLOSE IS HANDED BACK TO THE CALLER
 *
 * `v-model:open` is two-way, so the page closes it; the tile ALSO closes itself
 * on `select`. That is not redundant — a caller that has to close the sheet in
 * its own handler will eventually forget, and a sheet that stays open over a
 * composer the reader is now typing into is a bug nobody reproduces on purpose.
 *
 * ## ONE THING TO KNOW ABOUT SSR — IT IS THE LIBRARY'S, NOT OURS
 *
 * `reka-ui`'s `Teleport` wrapper (the one under `DialogPortal`) renders
 * `isMounted || forceMount ? <Teleport> : comment`, so **an overlay open during
 * SSR contributes nothing to the server HTML** — the `#teleports` bucket Nuxt
 * serialises comes back empty, and the sheet appears at hydration.
 *
 * Verified here rather than assumed, and it is harmless for this component: a
 * sheet is opened by a tap, so `open` is `false` for the whole server render and
 * there is nothing to reconcile. It would only matter if a screen ever rendered
 * this sheet already open on first paint. The same is true of every `UModal` in
 * this repo (`Goal/CreateSheet`, `Plan/BuyModal`, `Ui/Modal`) — it is a property
 * of the overlay primitive, not of anything written here.
 */

/**
 * Six rows, chosen from the message types the backend actually accepts
 * (`ICafeTableMessage.type`): `image`, `video`, `file`, `poll` and `challange`.
 * Camera is the one that is a *mode* of `image` rather than a type of its own —
 * it is first because on a phone it is what «+» most often means.
 */
const DEFAULT_OPTIONS: ICafeAttachOption[] = [
  { key: "camera", label: "دوربین", icon: "solar:camera-linear", tone: "accent" },
  { key: "image", label: "گالری تصاویر", icon: "solar:gallery-linear", tone: "accent" },
  { key: "video", label: "ویدیو", icon: "solar:clapperboard-play-linear", tone: "accent" },
  { key: "file", label: "فایل", icon: "solar:folder-with-files-linear", tone: "neutral" },
  { key: "poll", label: "نظرسنجی", icon: "solar:clipboard-list-linear", tone: "neutral" },
  { key: "challange", label: "چالش", icon: "solar:target-linear", tone: "neutral" },
];

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** Replaces the six defaults. */
    options?: ICafeAttachOption[];
    title?: string;
    description?: string;
  }>(),
  { title: "پیوست" },
);

const emit = defineEmits<{
  "update:open": [boolean];
  /** The chosen key. The sheet is already closing by the time this lands. */
  select: [string];
}>();

const options = computed(() => props.options ?? DEFAULT_OPTIONS);

function choose(option: ICafeAttachOption) {
  emit("select", option.key);
  emit("update:open", false);
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
        The `sm:` variants are answered too, not just the base ones. Nuxt UI
        ships `sm:ring sm:shadow-lg` on the content, and the **ring** has to go:
        a sheet that spans the phone column edge to edge with a rounded outline
        around it reads as a floating card rather than as a sheet rising from the
        bottom. The **shadow** stays — on a content-lighter sheet it is the only
        thing separating the sheet from the thread behind it, which is exactly
        the job the shadow is for.

        `divide-y-0` cancels the divider Nuxt UI puts between header and body:
        this sheet has one title and one grid, and a rule between them would
        bisect the only whitespace on the sheet.
      */
      content:
        'mx-auto max-w-md divide-y-0 rounded-t-3xl ring-0 sm:ring-0 border-t border-slate-200',
      header: 'p-4 sm:p-4',
      body: 'p-4 sm:p-4 pt-1',
      title: 'text-base font-bold text-x-text-title',
      description: 'text-xs text-x-text-subtitle',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!--
        The drag handle. `aria-hidden` because it is a gesture affordance, not a
        control: there is no drag behaviour wired in this phase, and announcing
        a grabber that cannot be grabbed would be a promise the sheet does not
        keep.
      -->
      <span
        class="bg-x-primary-content-300 mx-auto mb-4 block h-1 w-10 rounded-full"
        aria-hidden="true"
      />

      <!--
        `min-w-0` on each cell is what lets «گالری تصاویر» wrap or ellipsise on a
        320px phone instead of forcing the grid wider than the sheet. Three
        columns at `minmax(0, 1fr)` is the floor this grid can take: two columns
        would need two rows of scrolling for six items, and four would put each
        label at 11 characters or fewer on a 360px screen.
      -->
      <ul class="grid grid-cols-3 gap-4">
        <li
          v-for="option in options"
          :key="option.key"
          class="flex min-w-0 flex-col items-center gap-2"
        >
          <button
            type="button"
            class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-500 grid size-16 place-items-center rounded-2xl transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            :class="
              option.tone === 'accent'
                ? 'bg-x-primary-50 text-x-primary-800 hover:bg-x-primary-100'
                : 'bg-x-primary-content-200 text-x-text-title hover:bg-x-primary-content-300'
            "
            :aria-label="option.label"
            @click="choose(option)"
          >
            <UIcon :name="option.icon" size="26" aria-hidden="true" />
          </button>

          <span class="line-clamp-2 text-center text-xs leading-5 text-x-text-subtitle">
            {{ option.label }}
          </span>
        </li>
      </ul>

      <!--
        `pb-[max(0.75rem,env(safe-area-inset-bottom))]` on the sheet's last row:
        on a home-indicator phone the bottom label would otherwise sit under the
        bar the OS draws. The same `max(…)` recipe as `CafeComposerShell`.
      -->
      <div class="h-[max(0.75rem,env(safe-area-inset-bottom))]" aria-hidden="true" />
    </template>
  </USlideover>
</template>