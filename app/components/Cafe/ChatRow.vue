<script setup lang="ts">
import type { ICafeChannel } from "~/types/cafe";

/**
 * One row of the conversation list (Screen A): avatar, name, last message, time,
 * unread badge — the shape both `/cafe` and the search results are built from.
 *
 * ## WHY IT REPLACES THE `#left` HACK RATHER THAN THE OTHER WAY ROUND
 *
 * The old `CafeChatItem` exposed only `#left`, which it rendered *after* the
 * body — so on an RTL screen the slot the name promises is physically the left
 * one, and a caller wiring `#right` had nowhere to put it. The names are kept
 * (`#left`, `#right`) so existing call sites keep working, and both are
 * documented below by what they mean in reading order:
 *
 * - `#left` — the **inline-end** column: after the time and the badge. Where a
 *   «ورود» button goes, exactly where `CafeChatItem` put it.
 * - `#right` — the **inline-start** edge, before the avatar. Rarely needed.
 *
 * ## WHY `#preview` IS A SLOT
 *
 * The reference's second line is not always a message. Screen A draws a
 * «✓✓» read receipt in the **accent** colour tight against the reader's own last
 * message, and a missed-call line in **red** with a phone-off glyph — and both
 * are ink on that line, not text appended to it. A caller cannot produce either
 * by writing into `lastMessage.text`, because whatever it writes lands in the
 * row's own `x-text-subtitle` and comes out gray, which is what `/cafe/chat`
 * had to accept before this slot existed.
 *
 * `#preview` replaces the whole paragraph and is handed `text`, so a caller
 * keeps the default truncation and only changes what is inside the line. `own`
 * is deliberately **not** a slot prop: this row has no notion of the reader —
 * `ICafeChannel` carries no `senderId` on its preview — so a caller that knows
 * a line is its own declares it, which is one honest line in the page and a
 * wrong `aria-live` on every row otherwise.
 *
 * ## WHY THE DIVIDER IS `not-last:` ON THIS ELEMENT
 *
 * The row *is* the last child when it is the last row, so `not-last:` is the
 * only way to drop the hairline without the list having to wrap itself in a
 * `:not(:last-child)`-aware container. It only behaves if rows are siblings,
 * which is why this component is a row and not a wrapper around one.
 */
const props = withDefaults(
  defineProps<{
    channel: ICafeChannel;
    /** Route of the conversation. Omit to render an inert row (pickers, previews). */
    to?: string;
    /** The row of the conversation currently open. */
    active?: boolean;
    /** Epoch ms of "now" for the time label. Omit for a static date. */
    now?: number;
    avatarSize?: "sm" | "md" | "lg" | "xl";
  }>(),
  { active: false, avatarSize: "lg" },
);

/**
 * The API puts no timestamp on `lastMessage`, so the row falls back to the
 * channel's own `updatedAt` — which is what the backend bumps on a new message.
 * `createdAt` is the floor: a table nobody has written in still has a date.
 */
const stamp = computed(
  () => props.channel.updatedAt || props.channel.createdAt,
);

const name = computed(() => props.channel.nikname?.trim() || "گفتگو");

const unread = computed(() =>
  Number.isFinite(props.channel.unreadMessages) ? props.channel.unreadMessages : 0,
);

/**
 * The same sentence the cafe list already shows for an untouched table, so a
 * brand-new channel reads identically here and on the page it replaces.
 */
const preview = computed(
  () =>
    props.channel.lastMessage?.text?.trim() ||
    "پیامی تا کنون در این میز ارسال نشده",
);

/**
 * One label for the whole row rather than letting a reader assemble the avatar
 * alt, the name, the preview and the badge into one sentence themselves. The
 * badge keeps its own label too — that one is read on its own everywhere else.
 */
const rowLabel = computed(() =>
  unread.value > 0
    ? `${name.value}، ${faNumber(unread.value)} پیام خوانده‌نشده`
    : name.value,
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
    :aria-label="to ? rowLabel : undefined"
    class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex items-center gap-3 border-slate-200 px-4 py-3 transition-colors not-last:border-b"
    :class="active ? 'bg-x-primary-50' : 'hover:bg-x-primary-50/60'"
  >
    <slot name="right" />

    <CafeAvatar
      :src="channel.profileImage ?? undefined"
      :name="name"
      :size="avatarSize"
    />

    <div class="min-w-0 flex-1">
      <p class="line-clamp-1 text-sm font-bold text-x-text-title">
        {{ name }}
      </p>
      <!--
        `x-text-subtitle`, not `x-text-muted`: the preview is the reason the row
        exists, and `#a1a1a1` on white is ~2.8:1 — unreadable for the reader who
        needs it most. The "secondary" is carried by size and weight.

        ⚠️ WHY THIS PARAGRAPH IS A SLOT — see "WHY `#preview` IS A SLOT" in the
        header. In short: the reference's second line is not always a message,
        and a caller cannot produce a coloured receipt or a red missed-call line
        by editing `lastMessage.text`, because whatever it writes lands in this
        paragraph's own `x-text-subtitle`.
      -->
      <slot name="preview" :text="preview">
        <p class="line-clamp-1 text-xs text-x-text-subtitle">
          {{ preview }}
        </p>
      </slot>
    </div>

    <div class="flex shrink-0 flex-col items-end gap-1.5">
      <CafeMessageTimestamp :value="stamp" :now="now" variant="row" />
      <CafeUnreadBadge :count="unread" />
    </div>

    <slot name="left" />
  </component>
</template>