<script setup lang="ts">
import type { CafeStatus, ICafeTable, MessageType } from "~/types/cafe";

/**
 * One table (channel) in a café's table list — the row that opens a conversation.
 *
 * ## WHY THIS IS SEPARATE FROM `CafeChatRow` TOO
 *
 * `ChatRow` draws a **joined** channel: it is reached from `/cafe/joined`, the
 * reader is already in it, and the only thing it has to say beyond the name is
 * the last message and how many are unread. This row is reached from *inside* a
 * café, where the reader is choosing whether to join — so it has to carry the
 * things that make a choice: is this a voice room or a text room, is it private,
 * does it cost. Those are the status chips below.
 *
 * The two rows share `CafeAvatar`, `CafeMessageTimestamp` and `CafeUnreadBadge`
 * and nothing else, which is the point: the shared parts are the shared parts.
 *
 * ## WHY THE CHIPS ARE QUIET
 *
 * Three conditions can be true at once — a voice room, private, and paid — and a
 * row that gives each one a coloured pill becomes a wall of badges where the
 * name should be the loudest thing. So:
 *
 * - they are `text-[11px]` on a `x-primary-content-200` neutral, not filled
 *   pills, except the lock, which is a bare glyph with no background at all;
 * - at most **two** of them render at once: a voice room never shows the paid
 *   chip, because a `club-voice` table's `free` flag is not what the reader is
 *   deciding about — whether it takes audio is;
 * - a private table's lock replaces the «خصوصی» word entirely.
 *
 * A reader can therefore still read every condition, and the row still reads as
 * a name with a preview.
 */

/**
 * A small glyph in front of the preview when the last message is not text.
 *
 * It is a *type* marker, not a status marker: it says «this was a voice note» so
 * a reader does not tap in expecting text and find a player. `text` draws no
 * glyph — the marker's whole job is to be absent in the common case.
 */
const TYPE_GLYPHS: Partial<Record<MessageType, string>> = {
  voice: "solar:play-circle-linear",
  audio: "solar:play-circle-linear",
  video: "solar:clapperboard-play-linear",
  image: "solar:document-text-linear",
  file: "solar:clipboard-list-linear",
};

/** ⚠️ `privite` is misspelled in the backend model. See `app/types/cafe.ts`. */
function isPrivate(status?: CafeStatus): boolean {
  return status === "privite";
}

const props = withDefaults(
  defineProps<{
    table: ICafeTable;
    /** Route. Omit to render an inert row. */
    to?: string;
    /** The reader is already a member of this table. */
    joined?: boolean;
    /** Unread count. `0` hides the badge entirely — see `CafeUnreadBadge`. */
    unread?: number;
    /** Epoch ms of "now" for the time label. Omit for a static Jalali date. */
    now?: number;
  }>(),
  { joined: false, unread: 0 },
);

const name = computed(() => props.table.nikname?.trim() || "میز");

/** ⚠️ `tableType` decides whether this row may offer a composer at all. */
const isVoiceRoom = computed(() => props.table.tableType === "club-voice");

const isPrivateTable = computed(() => isPrivate(props.table.status));

/**
 * `free: false` means subscription-only. ⚠️ `free` is **optional** on
 * `ICafeTable`, so this tests for `=== false` and never for falsiness: an absent
 * flag means the backend did not say, and «not said» is not «paid». A row that
 * inferred «اشتراکی» from `undefined` would put a price on tables nobody has
 * priced.
 */
const isPaid = computed(() => props.table.free === false);

/**
 * The same sentence `CafeChatRow` uses for an untouched table, so a brand-new
 * channel reads identically in both lists — and `lastMessage` is checked against
 * `null` explicitly, because the backend really does answer `null` for a table
 * nobody has written in.
 */
const preview = computed(
  () =>
    props.table.lastMessage?.text?.trim() ||
    "پیامی تا کنون در این میز ارسال نشده",
);

const glyph = computed(() =>
  props.table.lastMessage?.type
    ? TYPE_GLYPHS[props.table.lastMessage.type]
    : undefined,
);

/**
 * A voice room is not sold and not private — it is a different *kind* of thing.
 * Letting it also wear the paid chip would be a second badge saying nothing the
 * «صوتی» chip has not already said.
 */
const showsPaidChip = computed(() => isPaid.value && !isVoiceRoom.value);

/**
 * One sentence for the whole row. The badge keeps its own label — that one is
 * read on its own everywhere else — but the row name needs to say *which* table
 * has three unread messages, not just that some row does.
 */
const accessibleLabel = computed(() => {
  const parts = [name.value];

  if (props.unread > 0) parts.push(`${faNumber(props.unread)} پیام خوانده‌نشده`);
  if (isVoiceRoom.value) parts.push("میز صوتی");
  if (isPrivateTable.value) parts.push("خصوصی");

  return parts.join("، ");
});

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
    class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-16 w-full items-center gap-3 py-3 pe-4 ps-5 transition-colors not-last:border-b border-slate-200 hover:bg-x-primary-content-200/60"
  >
    <CafeAvatar
      :src="table.profileImage ?? undefined"
      :name="name"
      size="lg"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <p class="line-clamp-1 text-[15px] font-bold text-x-text-title">
          {{ name }}
        </p>

        <span
          v-if="isVoiceRoom"
          class="shrink-0 rounded-full bg-x-primary-content-200 px-2 py-0.5 text-[11px] font-bold text-x-text-subtitle"
        >
          صوتی
        </span>

        <span
          v-if="showsPaidChip"
          class="shrink-0 rounded-full bg-x-primary-content-200 px-2 py-0.5 text-[11px] font-bold text-x-text-subtitle"
        >
          اشتراکی
        </span>

        <!-- A lock needs no background: the glyph IS the word. -->
        <UIcon
          v-if="isPrivateTable"
          name="solar:lock-keyhole-minimalistic-linear"
          size="14"
          class="shrink-0 opacity-50"
          aria-hidden="true"
        />
      </div>

      <p class="flex items-center gap-1 text-[13px] text-x-text-subtitle">
        <UIcon
          v-if="glyph"
          :name="glyph"
          size="14"
          class="shrink-0 opacity-60"
          aria-hidden="true"
        />

        <span class="line-clamp-1">{{ preview }}</span>
      </p>
    </div>

    <div class="flex shrink-0 flex-col items-end gap-1.5">
      <CafeMessageTimestamp
        :value="table.updatedAt ?? table.createdAt"
        :now="now"
        variant="row"
      />

      <CafeUnreadBadge :count="unread" />
    </div>
  </component>
</template>