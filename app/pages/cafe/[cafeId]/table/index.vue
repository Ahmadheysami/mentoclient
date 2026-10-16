<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { ICafeTable, ICafeTableView } from "~/types/cafe";
import type { ICafeFabMenuItem } from "~/components/Cafe/FabMenu.vue";

/**
 * `/cafe/[cafeId]/table` — the tables (channels) of one café.
 *
 * The middle of the three-level navigation: **cafés → tables → conversation**.
 * This is the screen where the reader is *choosing* a conversation rather than
 * already being in one, which is why every row is `CafeTableCard` and not
 * `CafeChatRow`: a table has to say whether it is a voice room, private or paid
 * *before* it is opened, and a conversation the reader is already in has
 * answered those questions.
 *
 * ## WHY A BAD `cafeId` IS A DRAWN SCREEN AND NOT A CRASH
 *
 * `route.params.cafeId` is whatever is in the URL, and a link carried over from
 * a stale notification, a hand-typed handle or an edited address can hold an id
 * the API has never heard of. `GET /:id/single` has that shape at the API level:
 * an unknown café answers HTTP 200 with the `cafe` key **absent**, so it reads as
 * success — the store turns it into a refusal itself — and `activeCafe` stays
 * `null`. The template branches to `CafeStateBlock state="error"` on that `null`,
 * and the single action on it is the way back to a screen that does exist.
 *
 * ## WHERE THE ROWS COME FROM
 *
 * `GET /:id/single` for the header card, `GET /table/:cafeId/tables` for the
 * rows and `GET /table/subscribed` for «میزهای من» and the unread badges — the
 * three awaited in the setup body rather than in `onMounted`, so the server's
 * HTML carries the rows and the Pinia payload carries them to the client's first
 * paint. A list that renders empty for a frame and then fills is a list the
 * reader has already read. `GET /table/q` is the fourth and is NOT one of them:
 * a search is a question the reader asks, not state this route arrives with, so
 * it waits for a keystroke — see `runSearch`.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "میزهای کافه",
});

const route = useRoute();

/**
 * `route.params.x` is `string | string[]` in vue-router's types — an array for
 * a repeatable param. Nothing here repeats, so the first value is the only one
 * that can be right, and joining them would invent an id matching nothing.
 */
function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const cafeId = computed(() => param(route.params.cafeId));

const cafe = useCafe();

/**
 * The café this route names, under a name the header can read.
 *
 * An alias and not a second copy: `activeCafe` is the store's own field and this
 * is the only page whose template says «café» eight times, and `cafe.activeCafe`
 * in each of those places is the store's storage leaking into the markup. The
 * value is read, never cached.
 */
const currentCafe = computed(() => cafe.activeCafe);

/**
 * ⚠️ `GET /table/:cafeId/tables` PAGES AND ANSWERS **NO TOTAL** — the payload is
 * `{ success, tables }` and nothing that says how many there are in all. So the
 * «تعداد میزها» tile is the length of whatever page arrived, and the honest way
 * to make that number mean anything is to ask for a page large enough that no
 * café in this app plausibly overflows it. One large page rather than a walk of
 * pages, because there is no total to page against: a list paged blind is a list
 * that stops wherever the backend's order stopped.
 */
const TABLES_PAGE_LIMIT = 100;

/**
 * The three reads this route needs, run together.
 *
 * Together rather than one after another is safe for the same reason it is safe
 * in `cafe/index.vue`: each action takes its fetcher with `useRequestFetch()` on
 * its first line, which is reached synchronously from here, so a request started
 * in parallel still carries the incoming request's cookies during SSR.
 *
 * `fetchSubscribed()` is not this screen's list — it is the reader's own
 * membership, which is what «میزهای من» filters on and what the unread badges
 * count from. A reader who is in no table gets `[]`, not an error, so its refusal
 * costs this screen nothing and `errors.joined` is deliberately never read here.
 */
async function loadCafe() {
  await Promise.all([
    cafe.fetchCafe(cafeId.value),
    cafe.fetchTables(cafeId.value, { limit: TABLES_PAGE_LIMIT }),
    cafe.fetchSubscribed(),
  ]);
}

await loadCafe();

watch(
  () => route.params.cafeId,
  (next, previous) => {
    if (next === previous) return;

    // ⚠️ THE RESET IS THE POINT, NOT A BELT-AND-BRACES ONE.
    //
    // The store scopes `cafe` and `tables` by their id, so the new fetch is
    // never satisfied by the old café's answer — nothing can be served stale
    // here. What scope CANNOT do is clear the old rows while the new ones are in
    // flight: between this navigation and the response, `activeCafe` still holds
    // café A and `tables` still holds A's tables, so the header would print café
    // A's name, avatar and description under café B's URL. Forgetting both
    // resources first is what makes the skeleton the honest picture of that gap.
    cafe.reset("cafe");
    cafe.reset("tables");
    cafe.reset("search");

    // The query belongs to the café that was on screen, and its results are the
    // old café's — so it goes back to empty and the screen returns to that
    // café's own list rather than to a search of somebody else's tables.
    query.value = "";

    void loadCafe();
  },
);

/**
 * Loading, refusal and empty — three different pictures, off three different
 * flags, and none of them inferred from the length of the list. `pending` is the
 * request in flight, `errors` is the Persian sentence `parseCafeFailure` already
 * wrote (and `null` — not `""` — when there is no refusal, so the test is the
 * value itself), and «the answer arrived with nothing in it» is the design
 * wave's empty block.
 *
 * `cafe` and `tables` are ONE skeleton rather than two: they are two requests
 * for one screen, and a screen whose half is a skeleton and whose half is rows
 * is a screen that has failed at something.
 */
const isLoading = computed(() => cafe.pending.cafe || cafe.pending.tables);
const cafeError = computed(() => cafe.errors.cafe);
const tablesError = computed(() => cafe.errors.tables);

/**
 * The `#action` of the table-list refusal: drop the answer and the sentence,
 * then ask again, so the screen leaves the error for the skeleton instead of
 * showing a refusal next to a request already on its way.
 */
function retryTables() {
  cafe.reset("tables");

  void cafe.fetchTables(cafeId.value, { limit: TABLES_PAGE_LIMIT });
}

/**
 * The screen's one clock reading. `CafeTableCard` prints a
 * `CafeMessageTimestamp`, and «۳ دقیقه پیش» is a question about *now*: answered
 * from the server's clock and again from the phone's it is a hydration
 * mismatch on the very first paint, and the row visibly changes its mind.
 * Undefined until mount, so the server and the client's first paint agree and
 * only a mounted client is allowed to say «همین الان». The same rule
 * `app/pages/settings.vue` follows, for the same reason.
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/* ------------------------------------------------------------- café summary -- */

/**
 * ## THE THREE TILES, AND WHY TWO OF THEM PRINT AN EM DASH
 *
 * `value` is `string | null` and `null` draws `UNKNOWN_COUNT`. A number this
 * screen cannot back up must not be printed, and `0` is the worst of the
 * substitutes precisely because it is the one a reader cannot tell from a real
 * count of nothing.
 *
 * - **تعداد میزها** — `cafe.tables.length`, behind `loaded.tables` so the header
 *   does not print «۰» for the frame between the header arriving and the table
 *   list arriving. See `TABLES_PAGE_LIMIT` for the one thing this count cannot
 *   be.
 * - **اعضای فعال** — the roster with presence is `GET /table/:tableId/users`,
 *   which the store does not read and the thread wave owns.
 * - **پیام‌های امروز** — message history, that same wave. A count of today's
 *   messages is a claim about data this screen must not go and read.
 *
 * ⚠️ `fetchStats()` IS **NOT** CALLED, and that is a decision rather than an
 * omission. `docs/Cafe-Api-Docs.md` §15 lists `GET /stats` as «not for the end
 * user», so a reader's token has no answer to get — one refused request per
 * screen visit for a number that is never drawn. And none of its three fields
 * counts anything about **this** café: `cafesActive` and `cafesByStatus` are
 * `$group` rows over the WHOLE catalogue and must be read as
 * `stats.cafesByStatus?.find((row) => row._id === "public")?.count ?? null` —
 * never `.length`, which counts the GROUPS rather than the cafés and reports «۱»
 * for a catalogue split between two statuses — while `topPublicChannel` is the
 * ten most-viewed cafés in the app. Any of the three under this café's own name
 * would be a true number about somewhere else.
 */
const UNKNOWN_COUNT = "—";

const stats = computed(() => [
  {
    label: "تعداد میزها",
    value: cafe.loaded.tables ? faNumber(cafe.tables.length) : null,
  },
  { label: "اعضای فعال", value: null },
  { label: "پیام‌های امروز", value: null },
]);

/* -------------------------------------------------------------- tab filters -- */

/**
 * The three segments of the café's table list.
 *
 * `mine` asks whether the reader is a member rather than reading a flag on the
 * table, because membership is not a property of a table: the same table is
 * "mine" for one reader and a stranger's for another, and `GET /table/subscribed`
 * says so by listing it rather than by stamping it — which is exactly what
 * `subscribedTableIds` is.
 */
type TabKey = "all" | "mine" | "voice";

const TABS: { key: TabKey; label: string; match: (table: ICafeTable) => boolean }[] = [
  { key: "all", label: "همه میزها", match: () => true },
  {
    key: "mine",
    label: "میزهای من",
    /**
     * ⚠️ ON `table.id` AND NOT ON `table.tableId`. The two are the SAME table's
     * two identifiers and they are not interchangeable (`app/types/cafe.ts`,
     * rule 3): `id` is the uniqid the socket rooms and `subscribedTableIds` are
     * built from, `tableId` is the public `ch_…` / `cv_…` / `tb_…` handle a URL
     * can carry. `subscribedTableIds` holds the uniqid, and so does every row of
     * `GET /table/:cafeId/tables`, so `id` is the side the two answers share.
     */
    match: (table) => cafe.subscribedTableIds.has(table.id),
  },
  // ⚠️ `club-voice` is one of three real `tableType` values; see `app/types/cafe.ts`.
  { key: "voice", label: "میزهای صوتی", match: (table) => table.tableType === "club-voice" },
];

const activeTab = ref<TabKey>("all");

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

/* ----------------------------------------------------------------- search -- */

/**
 * The same Arabic→Persian fold `/cafe` uses, and for the same reason: the reader
 * types on a Persian keyboard while the text may arrive with ي (U+064A) and ك
 * (U+0643), which look identical and are not the same code points.
 */
function fold(value: string | undefined | null): string {
  return faNormalize((value ?? "").toLocaleLowerCase("fa")).trim();
}

/** Long enough to swallow a Persian word being typed, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 300;

/** ⚠️ `GET /table/q`'s own default, sent anyway so the screen's intent is visible here. */
const SEARCH_LIMIT = 10;

/**
 * Whether a query is live, and it is decided on the FOLDED term.
 *
 * `fold` is what `/cafe` and the three sibling lists use, and it is the reason a
 * field holding nothing but spaces is not a query: `faNormalize` trims, so a
 * whitespace-only string folds to `""` and the screen is back to the café's own
 * list instead of asking the server to search for nothing.
 */
const queryTerm = computed(() => fold(query.value));

const isSearchActive = computed(() => queryTerm.value !== "");

/**
 * ⚠️ `false` from the moment a query becomes live until the debounced call has
 * come back.
 *
 * `cafe.pending.search` alone is NOT enough, and the gap is the whole reason
 * this ref exists: that flag is false for the 300ms BETWEEN the keystroke and the
 * request going out. Without this ref, a reader who typed «آ» would be shown
 * «میزی با این جستجو پیدا نشد» — an empty-state verdict about a question the
 * server had not been asked yet, drawn on top of a screen reacting to a key
 * instead of to an answer. The debounce is the feature; this is what keeps the
 * empty states behind it.
 */
const searchSettled = ref(true);

const runSearch = useDebounceFn(async (text: string) => {
  // ⚠️ `cafeId` is SENT and NOT a filter. `GET /table/q` reads only `text`,
  // `page` and `limit`, so the request cannot be narrowed server-side — the
  // tab filter below is what keeps a foreign café's table out of this café's
  // list, and it is the caller's job for exactly that reason.
  await cafe.searchTables({ text, cafeId: cafeId.value, limit: SEARCH_LIMIT });

  searchSettled.value = true;
}, SEARCH_DEBOUNCE_MS);

/**
 * ⚠️ THE WATCHER FOLLOWS `queryTerm`, AND SENDS `query` — and neither half is
 * interchangeable with the other.
 *
 * The trigger is the FOLDED term so it agrees with `isSearchActive` on what "a
 * query is live" means. `value.trim()` does not: a field holding nothing but
 * tashkeel folds to `""` (so the screen is showing the café's own table list)
 * while `trim()` leaves something behind (so the watcher was firing `GET /table/q`
 * for it) — the screen would flash the search skeleton over a list that was never
 * meant to be replaced. Watching the computed also means two spellings that fold
 * to the same term are one query, not two.
 *
 * The request still carries the RAW trimmed text: `fold` lower-cases and strips
 * harakat, and the endpoint matches `nikname` and `tableId` as sent, so sending it
 * the folded term would quietly change what the server searches for. `retrySearch`
 * sends the same `query.value.trim()` for the same reason.
 */
watch(queryTerm, (term) => {
  // ⚠️ NO REQUEST FOR AN EMPTY FIELD, AND NO DEBOUNCE LEFT RUNNING. The endpoint
  // answers `result: null` — not `[]` — when `text` is missing, so a blank field
  // is a request that can only look like a failed one; and a pending debounce
  // would fire the PREVIOUS term 300ms after the reader has cleared the field.
  // `cancel()` drops that timer. `reset` is what clears the previous term's rows
  // AND its flags together, so the screen goes back to the café's own list rather
  // than to the last search's results.
  if (term === "") {
    runSearch.cancel();
    cafe.reset("search");
    searchSettled.value = true;

    return;
  }

  searchSettled.value = false;

  void runSearch(query.value.trim());
});

/**
 * ⚠️ THE PENDING DEBOUNCE IS CANCELLED ON THE WAY OUT.
 *
 * `useDebounceFn` holds a plain timer and nobody else will clear it, so a reader
 * who typed three letters and immediately tapped the back chevron would still
 * have the screen fire `GET /table/q` for a term they have already left behind —
 * landing on the next café as a `searchResults` list that is not theirs, and
 * setting `errors.search` there if it were refused. `cancel()` drops the timer;
 * the store's own scope check is what keeps the rest honest, and this keeps the
 * rest from starting.
 */
onBeforeUnmount(() => {
  runSearch.cancel();
});

/** Both, because the debounce window and the open request are the same sentence. */
const isSearchPending = computed(() => cafe.pending.search || !searchSettled.value);

const searchError = computed(() => cafe.errors.search);

/**
 * The `#action` of the search refusal — and the same debounced path as typing.
 *
 * Deliberately NOT a second, undelayed call: two code paths that both ask
 * `GET /table/q` is two places for the next one to forget the scope or the
 * flag. `searchSettled` is set the way the keystroke sets it, so the skeleton
 * covers the button press exactly as it covers the 300ms that follows it, and an
 * empty field (unreachable here, but reachable by a race) settles on its own
 * because the store refuses an empty `text` without touching a single flag.
 */
function retrySearch() {
  cafe.reset("search");
  searchSettled.value = false;

  void runSearch(query.value.trim());
}

/* -------------------------------------------------------------------- rows -- */

/**
 * Which list the screen is showing: this café's own tables, or the server's
 * answer to the live query.
 *
 * Two lists rather than one filtered one, and the reason is that the server
 * filters on `text` over `nikname` **and `tableId`** — re-folding its rows
 * against the term on the client would drop every row that matched on the public
 * handle, which is the half of the match a reader is most likely to be typing.
 * So while a query is live the term is the server's business, and only the tab
 * filter — which the server knows nothing about — still runs here.
 */
const rowsForView = computed<ICafeTableView[]>(() =>
  isSearchActive.value ? cafe.searchResults : cafe.tables,
);

const visibleTables = computed(() => {
  const match = TABS.find((tab) => tab.key === activeTab.value)?.match ?? (() => true);

  return rowsForView.value.filter(match);
});

/**
 * The unread badge a joined table already carries; a table the reader is not in
 * has none.
 *
 * Delegated to the store because it is the only reader that can answer it: the
 * badge lives on the reader's own subscription record, which
 * `GET /table/:cafeId/tables` does not carry, and the store's `unreadFor`
 * matches on **either** id — the uniqid or the public handle — where a lookup
 * written here would have to guess which spelling the row came in as.
 */
const unreadFor = (table: ICafeTable): number => cafe.unreadFor(table.id);

/**
 * Three empty states, checked most-specific-first: «this café has no tables at
 * all» and «your filters removed them» are different answers, and collapsing
 * them would blame the café for a choice the reader just made.
 *
 * ⚠️ `isSourceEmpty` is false while a query is live, because the rows on screen
 * are then the SERVER's and «این کافه هنوز میزی ندارد» would be answering about
 * a list this café is not even in. And `isSearchEmpty` is false while the search
 * is in flight, for the reason `searchSettled` exists: an empty-state verdict
 * about a question the server has not answered yet is the screen guessing.
 */
const isSourceEmpty = computed(() => !isSearchActive.value && cafe.tables.length === 0);
const isSearchEmpty = computed(
  () =>
    isSearchActive.value && !isSearchPending.value && visibleTables.value.length === 0,
);
const isTabEmpty = computed(
  () =>
    !isSourceEmpty.value &&
    !isSearchEmpty.value &&
    !isSearchPending.value &&
    visibleTables.value.length === 0,
);

const activeTabLabel = computed(
  () => TABS.find((tab) => tab.key === activeTab.value)?.label ?? "",
);

/* --------------------------------------------------------- tablist keyboard -- */

const tablist = useTemplateRef<HTMLElement>("tablist");

/**
 * ## THE ARROWS, AND WHY THEY ARE MIRRORED
 *
 * A horizontal tablist takes arrow keys, and which arrow means "next" follows
 * the *visual* order, not the array order. This app is hard-coded
 * `dir="rtl"` (see `nuxt.config.ts`), so the visually next tab is the one to
 * the **left**: `ArrowLeft` advances and `ArrowRight` goes back. Writing it the
 * other way round would move the highlight against the direction the caret is
 * travelling, which on a screen whose every other row mirrors is the single
 * most disorienting bug this control could have.
 *
 * `Home`/`End` are included because they are the only way a keyboard reader can
 * reach the last segment without pressing `ArrowLeft` N times — and the list is
 * filtered by that segment, so "the end of the list" is also "the end of the
 * results".
 *
 * Roving `tabindex` (below) means the tablist is **one** stop in the tab order
 * and the arrows move within it, which is what `role="tablist"` promises; a
 * plain row of buttons would put three stops on a control that reads as one.
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

  // `nextTick` because the tab is not focused by the `aria-selected` change —
  // only the browser moves focus, and only in response to a real key press.
  nextTick(() => {
    tablist.value?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  });
}

/* --------------------------------------------------------------------- fab -- */

/**
 * The two rows this phase can navigate to, plus the one it cannot.
 *
 * «میز تازه» is `disabled` with a «به‌زودی» badge rather than a label that says
 * «به‌زودی» and a button that closes the menu: a press on a live-looking row
 * that does nothing but dismiss the popup is the one behaviour this menu must
 * not have. See `/cafe/chat`'s own copy of this note.
 */
const FAB_ITEMS: ICafeFabMenuItem[] = [
  { label: "میزهای پیوسته", icon: "solar:chat-dots-linear", to: "/cafe/joined" },
  { label: "همه کافه‌ها", icon: "solar:cup-hot-linear", to: "/cafe" },
  { label: "میز تازه", icon: "solar:add-circle-linear", disabled: true, badge: "به‌زودی" },
];

/**
 * Two id families, deliberately kept apart.
 *
 * A tab and the panel it controls must **not** share an id: `aria-controls`
 * points from the tab at the panel, so one id would make the tab point at
 * itself and put a duplicate id in the document. The prefix is also what makes
 * the pairing readable in the DOM inspector.
 */
const tabId = (key: TabKey) => `cafe-table-tab-${key}`;
const panelId = (key: TabKey) => `cafe-table-panel-${key}`;
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="compact"
      back="/cafe"
      :title="currentCafe?.label ?? 'میزها'"
    >
      <template #leading>
        <CafeAvatar
          v-if="currentCafe"
          :src="currentCafe.profileImage ?? undefined"
          :name="currentCafe.label"
          size="md"
        />
      </template>

      <template #actions>
        <!--
          ⚠️ STILL `disabled`, AND STILL NOT BECAUSE OF THE GRANTS.
          `managedCafeIds` / `managedTableIds` are readable now — `GET /me/my-ct`
          is the store's `myAccess` — but the management SCREENS were deleted in
          the design wave, and there is no route to send this to. Enabling the
          button for a reader who *does* hold a grant would produce the exact
          thing `CafeFabMenu`'s own header refuses to build: a live-looking
          control that goes nowhere, and this one carries an icon that promises a
          menu. So it is disabled for everybody — which is also the only state
          that is true for everybody, since a permission is not a destination.
          `fetchMyAccess()` is deliberately NOT called on this screen: it would be
          a request whose answer changes nothing that is drawn.

          `disabled` and not `hidden`, either way: an inert button that still
          carries its Persian `aria-label` tells a screen-reader user the control
          exists and is not yet available, which is more than hiding it would.
        -->
        <button
          type="button"
          disabled
          aria-label="گزینه‌های کافه"
          class="grid size-11 shrink-0 place-items-center rounded-full text-x-text-title transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UIcon name="solar:menu-dots-linear" size="22" aria-hidden="true" />
        </button>
      </template>

      <template #below>
        <div v-if="currentCafe" class="px-4 pt-3 pb-4">
          <!--
            The Telegram-style café card. `border-b` rather than a ring: this sits
            directly under the header's own hairline, and a second rule two
            pixels below it would read as a rendering fault.
          -->
          <section class="border-b border-slate-200 pb-4" :aria-label="currentCafe.label">
            <div class="flex items-center gap-3">
              <CafeAvatar
                :src="currentCafe.profileImage ?? undefined"
                :name="currentCafe.label"
                size="xl"
              />

              <div class="min-w-0 flex-1">
                <h2 class="truncate text-lg font-bold text-x-text-title">
                  {{ currentCafe.label }}
                </h2>
                <p class="line-clamp-2 text-xs leading-5 text-x-text-subtitle">
                  {{ currentCafe.description || currentCafe.title || "توضیحی برای این کافه ثبت نشده است" }}
                </p>
              </div>
            </div>

            <!--
              Three quiet tiles on `x-primary-content-200`, the feature's own
              neutral. Not filled accent pills: three coloured chips under one
              title would out-shout the name they belong to, and the counts are
              the third thing on this screen, not the first.

              ⚠️ `stat.value ?? UNKNOWN_COUNT`: an em dash is a number this screen
              will not invent, and it is deliberately NOT `۰` — a zero is the one
              substitute a reader cannot tell from a real count of nothing.
            -->
            <dl class="mt-4 grid grid-cols-3 gap-2">
              <div
                v-for="stat in stats"
                :key="stat.label"
                class="rounded-xl bg-x-primary-content-200 px-2 py-2 text-center"
              >
                <dt class="text-[11px] leading-4 text-x-text-subtitle">
                  {{ stat.label }}
                </dt>
                <dd class="mt-0.5 text-sm font-bold text-x-text-title tabular-nums">
                  {{ stat.value ?? UNKNOWN_COUNT }}
                </dd>
              </div>
            </dl>
          </section>

          <div class="pt-4">
            <!--
              `loading` is the field's own spinner, and `SearchPill` draws it in
              the trailing end INSTEAD of the clear button — two controls in a 48px
              pill is a row of targets too small to hit, and while the answer is
              coming the reader is not going to press it anyway.
            -->
            <CafeSearchPill
              v-model="query"
              placeholder="جستجو در میزها"
              :loading="isSearchPending"
            />
          </div>

          <div
            id="cafe-table-tabs"
            ref="tablist"
            role="tablist"
            aria-label="دسته‌بندی میزها"
            class="mt-3 flex gap-1 rounded-full bg-x-primary-content-200 p-1"
            @keydown="onTabKeydown"
          >
            <!--
          `flex items-center justify-center` is the same fix as the café list's
          category rail, and here it matters twice over because the *same
          control* on `/cafe/chat` and `/cafe/joined` already declares it.

          A `<button>` is `inline-block`; `min-height` widens its box without
          re-centring the line box inside it. This tab is 44px tall holding one
          20px line box (`text-sm`), so the label sat at the top with 24px of
          dead space under it — 11.2px above the pill's centre. The two sibling
          tablists centre theirs, so the identical segmented control appeared at
          three different heights depending on the screen.

          `font-bold` on the active segment is **not** part of the problem: all
          four Yekan cuts ship the same vertical metrics (ascent 1000, descent
          −550, lineGap 0 per em, `USE_TYPO_METRICS` set), so the active and
          inactive labels share one baseline to the hundredth of a pixel.
        -->
        <button
              v-for="tab in TABS"
              :id="tabId(tab.key)"
              :key="tab.key"
              type="button"
              role="tab"
              :aria-selected="activeTab === tab.key"
              :aria-controls="panelId(tab.key)"
              :tabindex="activeTab === tab.key ? 0 : -1"
              class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full text-sm transition-colors"
              :class="
                activeTab === tab.key
                  ? 'bg-x-primary-content-50 font-bold text-x-text-title'
                  : 'text-x-text-subtitle hover:text-x-text-title'
              "
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </template>
    </CafeScreenHeader>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-32">
      <!--
        ⚠️ THE PANEL WRAPS EVERY STATE, NOT ONLY THE ROWS.

        Each tab's `aria-controls` names this element's id, so on a loading,
        refusal or empty screen the tab would be pointing at nothing at all if
        the panel existed only in the last `v-else`. The tablist pattern says the
        panel is the region the tab owns — the state a screen is in is part of
        that region. `aria-labelledby` is unchanged, and the state chain below is
        exactly the chain it was; only the `role="tabpanel"` div moved up to
        hold it.

        ## IN THE ORDER THEY CAN BE TRUE
        The café and its tables are one screen, so they get ONE skeleton; the
        search is a different resource with its own in-flight window, so it gets
        its own. All four sit ahead of the three empty blocks, because a list
        that is still in flight is momentarily empty and an empty state drawn
        over a request nobody has answered is the screen guessing.
      -->
      <div
        :id="panelId(activeTab)"
        role="tabpanel"
        :aria-labelledby="tabId(activeTab)"
      >
        <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

        <!--
          ⚠️ `:description="cafeError ?? '…'"` — the store's own Persian sentence
          when the server refused, and the written one when there was no refusal to
          quote. Both are kept: the sentence from `parseCafeFailure` names the
          actual reason («این کافه پیدا نشد» and «اتصال اینترنت را بررسی کنید» are
          different problems for the reader), and the fallback is the case where the
          café simply is not there and nothing refused.
        -->
        <CafeStateBlock
          v-else-if="!currentCafe"
          state="error"
          title="این کافه پیدا نشد"
          :description="cafeError ?? 'ممکن است نشانی کافه تغییر کرده باشد یا این کافه دیگر در دسترس نباشد.'"
        >
          <template #action>
            <UButton
              to="/cafe"
              variant="soft"
              color="x-primary"
              label="بازگشت به کافه‌ها"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock
          v-else-if="tablesError"
          state="error"
          title="میزها بارگذاری نشد"
          :description="tablesError"
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
              @click="retryTables"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock v-else-if="isSearchPending" state="loading" :rows="5" />

        <CafeStateBlock
          v-else-if="searchError"
          state="error"
          title="جستجو انجام نشد"
          :description="searchError"
        >
          <template #action>
            <UButton
              type="button"
              variant="soft"
              color="x-primary"
              label="تلاش دوباره"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
              :loading="isSearchPending"
              @click="retrySearch"
            />
          </template>
        </CafeStateBlock>

        <CafeStateBlock
          v-else-if="isSourceEmpty"
          state="empty"
          title="این کافه هنوز میزی ندارد"
          description="میزهای این کافه به‌زودی ساخته می‌شوند"
        />

        <CafeStateBlock
          v-else-if="isSearchEmpty"
          state="empty"
          icon="solar:magnifer-linear"
          title="میزی با این جستجو پیدا نشد"
          description="نام دیگری را امتحان کنید یا دسته‌بندی را روی «همه میزها» بگذارید"
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
          icon="solar:chat-dots-linear"
          :title="`در «${activeTabLabel}» میزی نیست`"
          description="می‌توانید دستهٔ دیگری را انتخاب کنید یا همهٔ میزها را ببینید"
        >
          <template #action>
            <UButton
              type="button"
              variant="soft"
              color="x-primary"
              label="نمایش همهٔ میزها"
              class="mt-1"
              :ui="{ base: 'rounded-full' }"
              @click="showAllTabs"
            />
          </template>
        </CafeStateBlock>

        <!--
          A `<div>`, not `<li>`s — the same reason `/cafe` does it. `TableCard`'s
          hairline is `not-last:border-b` (`&:not(:last-child)`), which is a **DOM**
          relationship: an `<li>` wrapper makes every card the only and therefore
          last child of its own parent and every divider disappears. The rows are
          links, so a plain container of anchors is valid markup.
        -->
        <div v-else>
          <CafeTableCard
            v-for="table in visibleTables"
            :key="table.id"
            :table="table"
            :to="`/cafe/${cafeId}/table/${table.id}`"
            :unread="unreadFor(table)"
            :now="now"
          />
        </div>
      </div>
    </div>

    <CafeFabMenu :items="FAB_ITEMS" label="ساختن میز" />
  </div>
</template>
