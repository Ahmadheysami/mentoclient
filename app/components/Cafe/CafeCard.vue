<script setup lang="ts">
import type { ICafe } from "~/types/cafe";

/**
 * One café in the cafés list — Screen A's row, adapted from a conversation row to
 * a *group* row.
 *
 * ## WHY THIS IS NOT `CafeChatRow`
 *
 * `ChatRow` is the shape of a **conversation**: avatar, a name, the last message
 * someone wrote, a time and an unread badge. A café has no last message and no
 * unread count — it has a one-line **description** and a VIP flag. Reusing
 * `ChatRow` for both would mean a prop per difference (`previewSource`,
 * `showBadge`), and every one of those props is a question the row is being
 * asked about something it should already know. So the two rows stay separate
 * and share only `CafeAvatar` and `CafeMessageTimestamp`.
 *
 * ## THE PREVIEW LINE IS `description ?? title`, NEVER `x-text-muted`
 *
 * `x-text-muted` (`#a1a1a1`) is about 2.8:1 on white and fails AA at this size.
 * The line is the reason the row exists — it is what tells two cafés with
 * similar Persian names apart — so it is `x-text-subtitle` (`#404040`), the same
 * decision and the same reasoning as `ChatRow`'s preview.
 *
 * ## WHY THE WHOLE ROW IS THE TOUCH TARGET
 *
 * A row is a link, not a card with a link in it. The hit area is `min-h-16` plus
 * `py-3` on every axis, which puts it at 64px — well over the 44px floor — and
 * it is the only focusable thing on the row, so the focus ring is drawn around
 * the whole row rather than around a 20px target in its corner.
 *
 * `not-last:border-b` draws the divider, and `ps-4` indents it past the avatar
 * exactly as the reference does: a full-bleed rule under a 48px circle reads as
 * the circle being cut off.
 */
const props = withDefaults(
  defineProps<{
    cafe: ICafe;
    /** Route. Omit to render an inert row (a preview, a picker entry). */
    to?: string;
    /** The café whose tables are open. */
    active?: boolean;
    /** Epoch ms of "now" for the time label. Omit for a static Jalali date. */
    now?: number;
  }>(),
  { active: false },
);

/** `ICafe` requires `label`; it is the name every route and header is keyed by. */
const name = computed(() => props.cafe.label?.trim() || "کافه");

/**
 * `description` first, `title` second. The backend fills `title` on most cafés and
 * `description` on some, and neither is guaranteed — so the row falls through
 * both and then to a sentence that says the same thing as «no description»,
 * which is more honest than an empty line that leaves the row looking broken.
 */
const preview = computed(
  () =>
    props.cafe.description?.trim() ||
    props.cafe.title?.trim() ||
    "توضیحی برای این کافه ثبت نشده است",
);

/**
 * ⚠️ `privite` — misspelled in the backend model (`app/types/cafe.ts`, rule 2).
 * Only the Persian label is corrected, never the spelling.
 *
 * A private café the reader cannot open is not a row that opens: it is a row that
 * explains itself. `describeCafe` gives the whole link one sentence instead of
 * making the reader assemble avatar, name, VIP and lock themselves.
 */
const isPrivate = computed(() => props.cafe.status === "privite");

const accessibleLabel = computed(() =>
  [name.value, props.cafe.vip ? "ویژه" : "", isPrivate.value ? "خصوصی" : ""]
    .filter(Boolean)
    .join("، "),
);

/**
 * `NuxtLink` must be passed to `:is` as the **component**, never as its name.
 *
 * NuxtLink is a compile-time auto-import rather than a globally registered
 * component, so the string `'NuxtLink'` falls through `<component>`'s
 * native-element branch and SSR emits a literal `<NuxtLink to="…">` custom
 * element — an inert element with no `href`, not a row anybody can open.
 * `resolveComponent()` must run in setup, so it cannot be written inline.
 */
const NuxtLinkComponent = resolveComponent("NuxtLink");
</script>

<template>
  <component
    :is="to ? NuxtLinkComponent : 'div'"
    :to="to"
    :aria-label="to ? accessibleLabel : undefined"
    class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-16 w-full items-center gap-3 py-3 pe-4 ps-5 transition-colors not-last:border-b border-slate-200"
    :class="active ? 'bg-x-primary-50' : 'hover:bg-x-primary-content-200/60'"
  >
    <CafeAvatar
      :src="cafe.profileImage ?? undefined"
      :name="name"
      size="lg"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p class="line-clamp-1 text-[15px] font-bold text-x-text-title">
          {{ name }}
        </p>

        <!--
          «ویژه» in the accent tint, not a colour of its own: the app already
          owns `x-primary-50` / `x-primary-800` for "this is the paid thing" and
          a gold pill would be a sixth meaning for the same word.
        -->
        <span
          v-if="cafe.vip"
          class="shrink-0 rounded-full bg-x-primary-50 px-2 py-0.5 text-[11px] font-bold text-x-primary-800"
        >
          ویژه
        </span>

        <UIcon
          v-if="isPrivate"
          name="solar:lock-keyhole-minimalistic-linear"
          size="14"
          class="shrink-0 opacity-50"
          aria-hidden="true"
        />
      </div>

      <p class="line-clamp-1 text-[13px] text-x-text-subtitle">
        {{ preview }}
      </p>
    </div>

    <div class="flex shrink-0 flex-col items-end gap-1.5">
      <CafeMessageTimestamp
        :value="cafe.updatedAt ?? cafe.createdAt"
        :now="now"
        variant="row"
      />
    </div>
  </component>
</template>