<script setup lang="ts">
import type { ICafeChannel } from "~/types/cafe";
import type { ICafeFabMenuItem } from "~/components/Cafe/FabMenu.vue";

/**
 * `/cafe/chat` — the direct-conversation list, which is Screen A of
 * `docs/design/cafe-ui.webp` almost exactly.
 *
 * A tab root, like `/cafe` and `/cafe/joined`: one of the four destinations in
 * `CafeBottomMenu`, with no screen above it, so — as the reference's own
 * Messages screen does — the big title takes the space a chevron would have
 * used.
 *
 * ## WHY THE REFERENCE'S TWO MARKERS ARE DRAWN THE WAY THEY ARE
 *
 * Screen A has two details that are not in `CafeChatRow`'s own vocabulary, and
 * both are reproduced here through the `#preview` slot it exposes rather than by
 * re-drawing the row:
 *
 * - **the double-check «✓✓»** the reference puts tight against the preview of
 *   the reader's *own* last message, in the accent colour, and
 * - **the red missed-call line** with a phone-cut glyph, in place of a preview.
 *
 * Both are *ink on the second line*. Writing them into `lastMessage.text`
 * — which is what this page used to do — could only ever produce them in the
 * row's own `x-text-subtitle`, because that is the paragraph the component
 * renders them in; a `<span>` cannot survive a `String` and neither can a
 * colour. So the markers are slot content here, and the payload is left exactly
 * as the API hands it over: nothing is written into the channel list, and
 * nothing has to be copied out of it.
 *
 * `red-600`, and not `red-500` which the rest of this feature reaches for: at
 * 12px on the white row, `red-500` measures 3.82:1 and fails AA, while `red-600`
 * measures 4.76:1 and passes. It is also the red `CafeSettingRow` already uses
 * for its `danger` tone, so the feature keeps one.
 *
 * ## WHERE THE ROWS COME FROM
 *
 * `GET /table/subscribed`, read by `fetchSubscribed()` and awaited in the setup
 * body so the server's HTML carries the list and the Pinia payload carries it to
 * the client's first paint. `onMounted` would draw «هنوز گفتگویی ندارید» over a
 * reader who has both — the empty state here is a statement about the reader's
 * own account, and a statement that arrives late is the worst kind of wrong this
 * screen can be.
 *
 * ⚠️ It is the SAME endpoint as `/cafe/joined`, and deliberately: the backend has
 * one membership list, and a conversation is a table the reader is in. The two
 * screens differ in the row they draw — `CafeChatRow` for a conversation the
 * reader is already in, `CafeTableCard` for one they are choosing — not in the
 * data behind them, so they share the store's `joined` resource and the second of
 * the two to open is instant.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "گفتگوها",
});

const cafe = useCafe();

await cafe.fetchSubscribed();

/**
 * Three answers off the store's own per-resource flags: the skeleton while the
 * request is open, the Persian sentence `parseCafeFailure` already wrote when it
 * was refused, and the design wave's empty block when it arrived with nothing.
 *
 * `errors` and not `loaded`, because a refusal sets `loaded` too — it is a known
 * answer — and only the sentence tells the two apart.
 */
const isLoading = computed(() => cafe.pending.joined);
const loadError = computed(() => cafe.errors.joined);

/**
 * The `#action` of the refusal block: drop the answer and the sentence, then ask
 * again, so the screen leaves the error for the skeleton instead of showing the
 * refusal next to a request that is already on its way.
 */
function retry() {
  cafe.reset("joined");

  void cafe.fetchSubscribed();
}

/**
 * The screen's one clock reading, taken once on mount.
 *
 * `CafeChatRow` prints a `CafeMessageTimestamp`, and «۳ دقیقه پیش» is a question
 * about *now*: answered from the server's clock and again from the phone's it
 * is a hydration mismatch on the very first paint, and the row visibly changes
 * its mind. Undefined until mount, so the server and the client's first paint
 * agree and only a mounted client may say «همین الآن».
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/* -------------------------------------------------------------- the two rows -- */

/**
 * The two rows the reference makes an exception of, chosen by id and not by
 * index — a reorder of the list must not silently move the marker onto somebody
 * else's conversation.
 *
 * ⚠️ **THEY CANNOT MATCH TODAY, AND SAYING SO IS THE POINT.** `ICafeChannel`
 * carries no `senderId` on its preview and no call event at all, so «my own last
 * message» and «there was a missed call here» are not facts the payload states —
 * they are two ids from the fixture, and a `channel.id` the backend generated
 * never equals either of them. The conditions are kept rather than deleted
 * because the UI is not being redesigned in this wave, and a `#preview` that
 * renders the plain text it is handed is indistinguishable from the design's
 * third case; what replaces the constants is the socket's `lastMessage` shape
 * carrying a real `senderId === myId`, which is the thread's wave, not this one's.
 */
const SENT_ROW = "tb_01H8ZM8E3BOT00001";
const MISSED_CALL_ROW = "tb_01H8ZM8F4FAM00001";

/* ------------------------------------------------------------- tab switching -- */

type TabKey = "all" | "unread";

const TABS: { key: TabKey; label: string; match: (channel: ICafeChannel) => boolean }[] = [
  { key: "all", label: "همه", match: () => true },
  { key: "unread", label: "خوانده‌نشده", match: (channel) => channel.unreadMessages > 0 },
];

const activeTab = ref<TabKey>("all");

/** Counted over the whole list, not the visible one: it is a property of the filter. */
const unreadCount = computed(
  () => cafe.joined.filter((channel) => channel.unreadMessages > 0).length,
);

const query = ref("");

/**
 * A named handler rather than an inline `@click="query = ''"`: an inline
 * assignment is an *expression* that evaluates to the assigned string, and Vue
 * types a template listener as `(event) => void`.
 */
function clearSearch() {
  query.value = "";
}

/** The «نمایش همه» action on the empty-tab block. Named for the same reason as `clearSearch`. */
function showAllTabs() {
  activeTab.value = "all";
}

/**
 * The same Arabic→Persian fold the other four list screens use, and for the
 * same reason: the reader types on a Persian keyboard while text may arrive with
 * ي (U+064A) and ك (U+0643), which look identical to ی and ک and are not the
 * same code points. A café's name is searched here too, because a reader who
 * remembers «کافه آرامش» searches for it, not for a table handle.
 */
function fold(value: string | undefined | null): string {
  return faNormalize((value ?? "").toLocaleLowerCase("fa")).trim();
}

const queryTerm = computed(() => fold(query.value));

const visibleChannels = computed(() => {
  const term = queryTerm.value;
  const match = TABS.find((tab) => tab.key === activeTab.value)?.match ?? (() => true);

  return cafe.joined.filter(
    (channel) =>
      match(channel) &&
      (term === "" ||
        fold(channel.nikname).includes(term) ||
        fold(channel.lastMessage?.text).includes(term)),
  );
});

/**
 * Three empty states, most-specific-first, all of them gated on `loaded.joined`:
 * a list still in flight is momentarily empty, and «you have no conversations»
 * drawn over a request nobody has answered is the screen guessing about the
 * reader's own account. `pending.joined` and `errors.joined` sit in front of them
 * in the template for the same reason.
 */
const isSourceEmpty = computed(() => cafe.loaded.joined && cafe.joined.length === 0);
const isSearchEmpty = computed(
  () => queryTerm.value !== "" && visibleChannels.value.length === 0,
);
const isTabEmpty = computed(
  () => !isSourceEmpty.value && !isSearchEmpty.value && visibleChannels.value.length === 0,
);

/* --------------------------------------------------------- tablist keyboard -- */

const tablist = useTemplateRef<HTMLElement>("tablist");

/**
 * ## THE ARROWS, AND WHY THEY ARE MIRRORED
 *
 * A horizontal tablist takes arrow keys, and which arrow means "next" follows
 * the *visual* order, not the array order. This app is hard-coded
 * `dir="rtl"` (see `nuxt.config.ts`), so the visually next tab is the one to
 * the **left**: `ArrowLeft` advances, `ArrowRight` goes back. Writing it the
 * other way round would move the highlight against the direction the caret is
 * travelling, which on a screen whose every other row mirrors is the most
 * disorienting bug this control could have.
 *
 * Roving `tabindex` below makes the tablist **one** stop in the tab order with
 * the arrows moving within it — which is what `role="tablist"` promises. A plain
 * row of buttons would put two stops on a control that reads as one.
 *
 * Written out a third time here, after `/cafe/joined` and the café's table
 * list: a shared component would be a new file for fifteen lines, and each copy
 * is already tuned to its own segment list.
 */
function onTabKeydown(event: KeyboardEvent) {
  const count = TABS.length;
  const current = TABS.findIndex((tab) => tab.key === activeTab.value);

  let next = -1;

  if (event.key === "ArrowLeft") next = (current + 1) % count;
  else if (event.key === "ArrowRight") next = (current - 1 + count) % count;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = count - 1;

  if (next < 0) return;

  event.preventDefault();
  activeTab.value = TABS[next]!.key;

  nextTick(() => {
    tablist.value?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  });
}

/* ------------------------------------------------------------------- links -- */

/**
 * Where a row goes.
 *
 * There is no per-conversation route in this feature's route map: the six
 * screens are `/cafe`, `/cafe/[cafeId]/table`, `/cafe/[cafeId]/table/[tableId]`,
 * `/cafe/joined`, `/cafe/settings` and `/cafe/chat` — and `/cafe/chat` is the
 * tab root this row is *on*, so linking a row to it would be a link to the page
 * the reader is already reading. The screen that actually opens a conversation
 * is the thread, so that is where the row goes, with the channel's own café and
 * public table handle — the two identifiers `app/types/cafe.ts` rule 3 says are
 * **not** interchangeable.
 */
const channelTo = (channel: ICafeChannel) =>
  `/cafe/${channel.cafe.id}/table/${channel.tableId ?? channel.id}`;

/* --------------------------------------------------------------------- fab -- */

/**
 * Two navigable rows and one destination this phase does not build.
 *
 * «گفتگوی تازه» is `disabled` with a «به‌زودی» badge rather than a label that
 * says «به‌زودی» and a button that closes the menu: a press on a live-looking row
 * that does nothing but dismiss the popup is the one behaviour this menu must
 * not have. `disabled` also takes the row out of the tab order and announces it
 * as disabled, so a screen-reader user is told the truth too.
 */
const FAB_ITEMS: ICafeFabMenuItem[] = [
  { label: "میزهای پیوسته", icon: "solar:chat-dots-linear", to: "/cafe/joined" },
  { label: "همه کافه‌ها", icon: "solar:cup-hot-linear", to: "/cafe" },
  {
    label: "گفتگوی تازه",
    icon: "solar:add-circle-linear",
    disabled: true,
    badge: "به‌زودی",
  },
];
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="large"
      title="گفتگوها"
      subtitle="گفت‌وگوهای مستقیم شما"
    >
      <template #below>
        <div class="px-4 pb-3">
          <CafeSearchPill
            v-model="query"
            placeholder="جستجو در گفتگوها"
          />
        </div>

        <div
          id="cafe-chat-tabs"
          ref="tablist"
          role="tablist"
          aria-label="فیلتر گفتگوها"
          class="mx-4 mb-3 flex gap-1 rounded-full bg-x-primary-content-200 p-1"
          @keydown="onTabKeydown"
        >
          <button
            v-for="tab in TABS"
            :id="`cafe-chat-tab-${tab.key}`"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-controls="`cafe-chat-panel-${tab.key}`"
            :tabindex="activeTab === tab.key ? 0 : -1"
            class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-sm transition-colors"
            :class="
              activeTab === tab.key
                ? 'bg-x-primary-content-50 font-bold text-x-text-title'
                : 'text-x-text-subtitle hover:text-x-text-title'
            "
            @click="activeTab = tab.key"
          >
            <span class="truncate">{{ tab.label }}</span>

            <span
              v-if="tab.key === 'unread' && unreadCount > 0"
              class="grid size-5 shrink-0 place-items-center rounded-full bg-x-text-title text-[11px] font-bold text-x-primary-content-50 tabular-nums"
            >
              <span class="sr-only">گفتگوی </span>{{ faNumber(unreadCount) }}
            </span>
          </button>
        </div>
      </template>
    </CafeScreenHeader>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-32">
      <!--
        ⚠️ THE PANEL WRAPS EVERY STATE, NOT ONLY THE ROWS — see
        `/cafe/[cafeId]/table`'s copy of this note. Each tab's `aria-controls`
        names the element below, so a panel that existed only in the last
        `v-else` would leave every tab pointing at nothing on a skeleton, a
        refusal or an empty block.

        The skeleton and the refusal come first, for the reason `CafeStateBlock`
        itself exists: «the rows did not arrive» and «the rows arrived and there
        are none» are different answers, and a list that swaps between them looks
        like a fault rather than like a fact.
      -->
      <div
        :id="`cafe-chat-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`cafe-chat-tab-${activeTab}`"
      >
        <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

        <CafeStateBlock
          v-else-if="loadError"
          state="error"
          title="گفتگوها بارگذاری نشد"
          :description="loadError"
        >
          <template #action>
            <UButton
              type="button"
              variant="soft"
              color="x-primary"
              label="تلاش دوباره"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
              :loading="isLoading"
              @click="retry"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock
          v-else-if="isSourceEmpty"
          state="empty"
          icon="solar:chat-round-linear"
          title="هنوز گفتگویی ندارید"
          description="به یکی از میزهای کافه‌ها بپیوندید تا گفتگو شروع شود"
        >
          <template #action>
            <UButton
              to="/cafe"
              variant="soft"
              color="x-primary"
              label="مرور کافه‌ها"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock
          v-else-if="isSearchEmpty"
          state="empty"
          icon="solar:magnifer-linear"
          title="گفتگویی با این جستجو پیدا نشد"
          description="نام دیگری را امتحان کنید یا فیلتر را روی «همه» بگذارید"
        >
          <template #action>
            <UButton
              type="button"
              variant="soft"
              color="x-primary"
              label="پاک کردن جستجو"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
              @click="clearSearch"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock
          v-else-if="isTabEmpty"
          state="empty"
          icon="solar:chat-round-check-linear"
          title="همه گفتگوها خوانده شده‌اند"
          description="هیچ پیام خوانده‌نشده‌ای ندارید"
        >
          <template #action>
            <UButton
              type="button"
              variant="soft"
              color="x-primary"
              label="نمایش همه"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
              @click="showAllTabs"
            />
          </template>
        </CafeStateBlock>

        <!--
          A `<div>`, not `<li>`s. `CafeChatRow`'s hairline is `not-last:border-b`
          (`&:not(:last-child)`), a **DOM** relationship: an `<li>` wrapper makes
          every row the only and therefore last child of its own parent, and every
          divider disappears. The rows are links, so a plain container of anchors
          is valid markup.
        -->
        <div v-else>
          <CafeChatRow
            v-for="channel in visibleChannels"
            :key="channel.roomId ?? channel.id"
            :channel="channel"
            :to="channelTo(channel)"
            :now="now"
          >
            <!--
              The missed call's glyph, in `#left` — the inline-end column, which
              is the row's far side in this app's hard-coded RTL. Red ink lives
              next to it on the `#preview` line below, not here.
            -->
            <template v-if="channel.id === MISSED_CALL_ROW" #left>
              <UIcon name="solar:call-cancel-linear" size="16" aria-hidden="true" class="shrink-0 text-red-600" />
            </template>

            <!--
              `#preview` carries the reference's two markers in the ink they need
              rather than in the row's own muted body colour. `text` is the
              channel's preview (fallback to «پیامی تا کنون…») and is kept quiet
              on the unread rows; only the two cases named in the brief break the
              rule.
            -->
            <template #preview="{ text }">
              <p v-if="channel.id === MISSED_CALL_ROW" class="flex items-center gap-1 text-xs text-red-600">
                تماس بی‌پاسخ
              </p>
              <p
                v-else-if="channel.id === SENT_ROW"
                class="line-clamp-1 text-xs text-x-text-subtitle"
              >
                <span class="me-1 inline-block font-bold text-x-primary-600">✓✓</span>{{ text }}
              </p>
              <p v-else class="line-clamp-1 text-xs text-x-text-subtitle">
                {{ text }}
              </p>
            </template>
          </CafeChatRow>
        </div>
      </div>
    </div>

    <CafeFabMenu :items="FAB_ITEMS" label="ساختن گفتگوی تازه" />
  </div>
</template>
