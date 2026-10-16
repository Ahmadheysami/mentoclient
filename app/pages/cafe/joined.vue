<script setup lang="ts">
import type { ICafeChannel } from "~/types/cafe";
import type { ICafeFabMenuItem } from "~/components/Cafe/FabMenu.vue";

/**
 * `/cafe/joined` — the tables the reader is already a member of.
 *
 * A tab root, like `/cafe` and `/cafe/chat`: it is one of the four destinations
 * in `CafeBottomMenu`, so there is no screen above it to go back to, and the
 * reference draws its big title with no arrow for the same reason.
 *
 * ## WHY THESE ARE `CafeTableCard` ROWS AND NOT `CafeChatRow` ONES
 *
 * `ChatRow` is a **conversation** row: it answers "what is the latest thing
 * said in a room I am in". This list is a café-side list whose entries happen
 * to include rooms the reader has joined — so a row still has to say whether
 * the table is a voice room, private or paid before it is opened, which is what
 * `CafeTableCard` adds. The two rows share `CafeAvatar`,
 * `CafeMessageTimestamp` and `CafeUnreadBadge`; the difference is the chips.
 *
 * ## WHERE THE ROWS COME FROM
 *
 * `GET /table/subscribed`, which `fetchSubscribed()` reads — awaited here in the
 * setup body so the server's HTML carries the list and the Pinia payload carries
 * it to the client's first paint. `onMounted` would flash «هنوز در هیچ میزی عضو
 * نیستید» at every reader whose script has not run, which on this screen is the
 * one thing it must never claim: **not being a member anywhere** is a fact about
 * the reader, and a fact that arrives late is a lie told with a button under it.
 *
 * ⚠️ The endpoint's own paging is broken (`$limit` before `$skip`, and `$skip`
 * fed the page NUMBER), so the store asks for one large page and there is no
 * client paging here — the same reason `ICafeChannel` says it. The unread badge
 * is clamped at zero in the store, because `messageSecunce - lastReadSequence`
 * goes negative for a message deleted after it was counted, and a negative badge
 * is truthy and would draw «‎-۳» on a row with nothing unread.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "میزهای پیوسته",
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
 * `CafeTableCard` prints a `CafeMessageTimestamp`, and «۳ دقیقه پیش» is a
 * question about *now*: answered from the server's clock and again from the
 * phone's it is a hydration mismatch on the first paint, and the row visibly
 * changes its mind. Undefined until mount, so the server and the client's first
 * paint agree and only a mounted client may say «همین الآن».
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/* ------------------------------------------------------------- tab switching -- */

type TabKey = "all" | "unread";

const TABS: { key: TabKey; label: string; match: (channel: ICafeChannel) => boolean }[] = [
  { key: "all", label: "همه", match: () => true },
  { key: "unread", label: "خوانده‌نشده", match: (channel) => channel.unreadMessages > 0 },
];

const activeTab = ref<TabKey>("all");

/**
 * The badge on «خوانده‌نشده».
 *
 * Counted over the **whole** list, not over the visible one: the badge answers
 * "is there anything to read?", and a count that changes as you filter it would
 * answer a question the reader did not ask. It is also the only number on this
 * screen that stays on a tab while a search is narrowing the rows underneath.
 */
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
 * The same Arabic→Persian fold `/cafe` uses, and for the same reason: the reader
 * types on a Persian keyboard while the text may arrive with ي (U+064A) and ك
 * (U+0643), which look identical to ی and ک and are not the same code points.
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
      match(channel) && (term === "" || fold(channel.nikname).includes(term)),
  );
});

/**
 * Three empty states, checked most-specific-first. «You are in no tables at
 * all», «your search matched nothing» and «nothing here is unread» are three
 * different answers, and the third in particular must not suggest searching —
 * there is nothing to find.
 *
 * ⚠️ `loaded.joined` gates them: a list that is still in flight is momentarily
 * empty, and «you are in no tables at all» drawn over a request nobody has
 * answered is the screen guessing about the reader's own account. `pending.joined`
 * and `errors.joined` are in front of them in the template for the same reason.
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
 * This handler is written out again on `/cafe/chat` and on the café's table
 * list. It cannot be a shared component: extracting a third file for fifteen
 * lines would be the one new abstraction this wave is not allowed to make, and
 * each copy is already tuned to its own segment list.
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

  // `nextTick` because `aria-selected` changes the panel, not the focus — only
  // the browser moves focus, and only in answer to a real key press.
  nextTick(() => {
    tablist.value?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  });
}

/* --------------------------------------------------------------------- links -- */

/**
 * Where a row goes.
 *
 * The route carries `[cafeId]` and `[tableId]`, and the two are **not**
 * interchangeable: `ICafeTable.id` is the uniqid the socket's
 * `table_{tableId}_room` is built from, while `tableId` is the public `ch_…` /
 * `cv_…` / `tb_…` handle a URL can carry. The public one is used, with the
 * uniqid as the fallback so a channel that arrives without one still resolves.
 */
const channelTo = (channel: ICafeChannel) =>
  `/cafe/${channel.cafe.id}/table/${channel.tableId ?? channel.id}`;

/* --------------------------------------------------------------------- fab -- */

/**
 * Two navigable rows and one that is not built yet.
 *
 * «میز تازه» is `disabled` with a «به‌زودی» badge rather than a label that says
 * «به‌زودی» and a button that closes the menu. See `/cafe/chat`'s own copy of
 * this note.
 */
const FAB_ITEMS: ICafeFabMenuItem[] = [
  { label: "همه کافه‌ها", icon: "solar:cup-hot-linear", to: "/cafe" },
  { label: "گفتگوها", icon: "solar:dialog-2-linear", to: "/cafe/chat" },
  { label: "میز تازه", icon: "solar:add-circle-linear", disabled: true, badge: "به‌زودی" },
];
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="large"
      title="میزهای پیوسته"
      subtitle="میزهایی که در آن‌ها عضو هستید"
    >
      <template #below>
        <div class="px-4 pb-3">
          <CafeSearchPill
            v-model="query"
            placeholder="جستجو در میزهای پیوسته"
          />
        </div>

        <!--
          The switch. It is a `tablist` rather than a pair of buttons because it
          swaps which rows are on screen and that is exactly what a tab is: the
          panel below carries `aria-labelledby` back to its tab, so a screen
          reader announces «خوانده‌نشده, selected, tab 2 of 2» rather than an
          unlabelled toggle.
        -->
        <div
          id="cafe-joined-tabs"
          ref="tablist"
          role="tablist"
          aria-label="فیلتر میزهای پیوسته"
          class="mx-4 mb-3 flex gap-1 rounded-full bg-x-primary-content-200 p-1"
          @keydown="onTabKeydown"
        >
          <button
            v-for="tab in TABS"
            :id="`cafe-joined-tab-${tab.key}`"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-controls="`cafe-joined-panel-${tab.key}`"
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

            <!--
              The count, on the tab and not beside the list: it is a property of
              the *filter*, not of the rows currently shown, so it survives a
              search narrowing them.
            -->
            <span
              v-if="tab.key === 'unread' && unreadCount > 0"
              class="grid size-5 shrink-0 place-items-center rounded-full bg-x-text-title text-[11px] font-bold text-x-primary-content-50 tabular-nums"
            >
              <span class="sr-only">میز </span>{{ faNumber(unreadCount) }}
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
        :id="`cafe-joined-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`cafe-joined-tab-${activeTab}`"
      >
        <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

        <CafeStateBlock
          v-else-if="loadError"
          state="error"
          title="میزهای پیوسته بارگذاری نشد"
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
          title="هنوز در هیچ میزی عضو نیستید"
          description="یک کافه باز کنید و به میز دلخواهتان بپیوندید"
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
          title="میزی با این جستجو پیدا نشد"
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
          title="همه‌ی میزهای شما خوانده شده‌اند"
          description="هیچ پیام خوانده‌نشده‌ای در میزهای پیوسته ندارید"
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
          A `<div>`, not `<li>`s. `TableCard`'s hairline is `not-last:border-b`
          (`&:not(:last-child)`), a **DOM** relationship: an `<li>` wrapper makes
          every card the only and therefore last child of its own parent, and every
          divider disappears. The rows are links, so a plain container of anchors
          is valid markup.
        -->
        <div v-else>
          <CafeTableCard
            v-for="channel in visibleChannels"
            :key="channel.roomId ?? channel.id"
            :table="channel"
            :to="channelTo(channel)"
            joined
            :unread="channel.unreadMessages"
            :now="now"
          />
        </div>
      </div>
    </div>

    <CafeFabMenu :items="FAB_ITEMS" label="ساختن میز" />
  </div>
</template>
