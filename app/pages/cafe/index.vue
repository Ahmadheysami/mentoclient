<script setup lang="ts">
import type { ICafe } from "~/types/cafe";
import type { ICafeFabMenuItem } from "~/components/Cafe/FabMenu.vue";

/**
 * `/cafe` — the cafés list, and the root of the feature's navigation.
 *
 * This is Screen A of `docs/design/cafe-ui.webp` with a **café** substituted for
 * a conversation: the same large title, the same pill search, the same
 * hairline-divided rows, the same floating FAB. Nothing about the composition
 * is re-invented here — `CafeScreenHeader` draws the title, `CafeSearchPill`
 * draws the field, `CafeCard` draws the row and `CafeFabMenu` draws the button
 * and its popup. This file's whole job is deciding *which* cafés are on screen.
 *
 * ## WHY THIS PAGE IS THE TAB ROOT AND CARRIES NO BACK CHEVRON
 *
 * It is one of the four destinations in `CafeBottomMenu`, so it is reached from
 * the bottom of the app with no screen above it — and the reference's own
 * Messages screen draws its big title with no arrow for the same reason. A
 * chevron here would offer a way back to wherever the reader came from, which
 * is not somewhere this page knows about.
 *
 * ## WHERE THE ROWS COME FROM, AND WHY THE FETCH IS HERE AND NOT `onMounted`
 *
 * Two reads, both awaited in the setup body, so the rows travel in the Pinia
 * payload and the server's HTML already contains the list — `onMounted` would
 * ship «هنوز کافه‌ای وجود ندارد» to every reader whose script has not run yet,
 * which on a screen whose whole job is offering somewhere to go is the one wrong
 * answer available.
 *
 * `fetchFeet()` is `GET /cafes/feet`, which answers **`201`** and splits its
 * payload in two: `data.public` and `data.privite` — the backend's own
 * misspelling, `app/types/cafe.ts` rule 2. The store concatenates the halves, so
 * this screen reads ONE list and the category rail below re-splits it by
 * `status`, which is what it has always done.
 *
 * `fetchSubscribed()` is the second read and it exists for ONE thing: the
 * «صوتی» segment. See `voiceCafeIds` for why the feet answer cannot answer it.
 *
 * Both are awaited together rather than one after the other, which is safe for
 * one reason worth knowing: each action takes its fetcher with
 * `useRequestFetch()` on its FIRST line, reached synchronously from here, so
 * neither can lose the request's cookies by being started in parallel.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "کافه‌ها",
});

const cafe = useCafe();

await Promise.all([cafe.fetchFeet(), cafe.fetchSubscribed()]);

/**
 * ## LOADING, REFUSAL AND EMPTY ARE THREE ANSWERS, READ OFF THE STORE
 *
 * `pending.feet` is the skeleton, `errors.feet` is the Persian sentence
 * `parseCafeFailure` already wrote, and «the answer arrived and there was none»
 * is the empty block the design wave drew. `errors` is `null` — not `""` — while
 * there is no refusal, so `v-else-if="loadError"` is the whole test and nothing
 * has to be inferred from the length of a string.
 *
 * `errors` is read and NOT `loaded`: `loaded.feet` is set on a refusal too — a
 * refusal is a known answer — so it is the sentence, not the arrival, that
 * separates «the server said no» from «the server said nothing».
 */
const isLoading = computed(() => cafe.pending.feet);
const loadError = computed(() => cafe.errors.feet);

/**
 * The `#action` of the refusal block: forget the answer and ask again.
 *
 * `reset` is what makes this a retry rather than a second opinion. A refusal
 * already leaves `errors.feet` set, and `isFresh` refuses while it is — so
 * without the `reset` the re-call would still go out; what the `reset` adds is
 * that the flags and the sentence are cleared *first*, so the screen leaves the
 * error block for the skeleton instead of holding the refusal on screen while
 * the second request is in flight.
 */
function retry() {
  cafe.reset("feet");

  void cafe.fetchFeet();
}

/**
 * The screen's one clock reading, taken once on mount.
 *
 * `CafeCard` renders a `CafeMessageTimestamp`, and a timestamp that says
 * «۳ دقیقه پیش» is a question about *now*: one answered during SSR and a
 * different one answered at hydration is a text mismatch, and the reader sees a
 * row change its mind on the first paint. Undefined until mount, so the server
 * — and the client's first paint — render the deterministic Jalali date, and
 * only a mounted client is allowed to say «همین الان». The same rule
 * `app/pages/settings.vue` follows, for the same reason.
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/* --------------------------------------------------------------- filtering -- */

const query = ref("");

/**
 * A named handler rather than an inline `@click="query = ''"`.
 *
 * An inline assignment is an *expression*, and Vue types a template listener as
 * `(event) => void`; an expression that evaluates to the assigned string is
 * `(event) => string` and the compiler rejects it. The same three lines are
 * also the one place this page mutates the query, so it is worth a name.
 */
function clearSearch() {
  query.value = "";
}

/** The «نمایش همهٔ کافه‌ها» action on the empty-category block. Named for the same reason as `clearSearch`. */
function showAllCategories() {
  category.value = "all";
}

/**
 * ## THE «صوتی» SEGMENT, AND WHY IT CANNOT ASK THE FEET ANSWER
 *
 * `ICafe` has no `tableType` of its own — a café is "audio" only in the sense
 * that it HOLDS a `club-voice` table — and `GET /cafes/feet` answers cafés with
 * no table list beside them. The fixture could afford a `CAFE_MOCK_TABLES_BY_CAFE`
 * map that knew all of them at once; the API cannot, without one request per row
 * of a list that is already scrolling.
 *
 * The one table list a café screen can hold honestly is the reader's OWN
 * (`GET /table/subscribed`), so the segment is answered from that: a café is
 * «صوتی» here when the reader is inside a voice table of it. A café with a voice
 * room they have not joined does not appear — which is the segment's own empty
 * block saying so out loud, rather than a row appearing on a guess.
 */
const voiceCafeIds = computed<Set<string>>(
  () =>
    new Set(
      cafe.joined
        .filter((channel) => channel.tableType === "club-voice")
        .map((channel) => channel.cafe?.id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
);

/**
 * The category rail's five segments, and the predicate each one applies.
 *
 * ⚠️ `privite` is misspelled in the backend model. See `app/types/cafe.ts` rule 2.
 *
 * The parameter is still called `cafe` and it still shadows the store of the same
 * name, which is safe here for one reason worth stating: no predicate in this
 * array reads the store — `voiceCafeIds` above is the one that needs a second
 * list, and it is a named `computed` precisely so it does not have to be reached
 * for from inside a shadowed scope.
 */
type CategoryKey = "all" | "vip" | "public" | "privite" | "voice";

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  match: (cafe: ICafe) => boolean;
}[] = [
  { key: "all", label: "همه", match: () => true },
  { key: "vip", label: "ویژه", match: (cafe) => cafe.vip === true },
  { key: "public", label: "عمومی", match: (cafe) => cafe.status === "public" },
  { key: "privite", label: "خصوصی", match: (cafe) => cafe.status === "privite" },
  { key: "voice", label: "صوتی", match: (cafe) => voiceCafeIds.value.has(cafe.id) },
];

const category = ref<CategoryKey>("all");

/**
 * One fold applied to both sides of every comparison.
 *
 * A Persian reader types on a Persian keyboard, and Arabic-scripted text
 * arrives from the outside world with ي (U+064A) and ك (U+0643) — code points
 * that *look* identical to ی and ک and are not them, so `"کافه آرامش".includes(
 * "کافه آرامش")` is false for reasons no reader could see on screen.
 * `faNormalize` already folds exactly those two (plus teh-marbuta and harakat)
 * and is the same helper the city list uses, so the rail and the search agree
 * about what a word is instead of each inventing a rule.
 *
 * `toLocaleLowerCase("fa")` rather than `toLowerCase()`: Latin-lower-casing is
 * the only case-folding this text has, and asking for it in Persian keeps the
 * conversion from being re-interpreted under a different locale if a café name
 * ever carries Latin characters.
 */
function fold(value: string | undefined | null): string {
  return faNormalize((value ?? "").toLocaleLowerCase("fa")).trim();
}

const queryTerm = computed(() => fold(query.value));

/** One haystack per café, so a café with many tags is still folded once. */
function searchable(cafe: ICafe): string {
  return fold([cafe.label, cafe.title, cafe.description, ...(cafe.tags ?? [])].join(" "));
}

const byCategory = computed(() =>
  CATEGORIES.find((entry) => entry.key === category.value)?.match ?? (() => true),
);

const visibleCafes = computed(() => {
  const term = queryTerm.value;
  const match = byCategory.value;

  return cafe.cafes.filter(
    (cafe) => match(cafe) && (term === "" || searchable(cafe).includes(term)),
  );
});

/**
 * ## WHY THE THREE EMPTY STATES ARE THREE STATES AND NOT ONE
 *
 * «There are no cafés at all», «your search matched nothing» and «this category
 * has none» are three different answers, and collapsing them makes a screen
 * blame the catalogue for a choice the reader just made — or suggest a search
 * that does not exist yet. Each is checked in the order that can be true, so
 * the most specific one wins.
 *
 * ⚠️ All three are reached only because the template puts `pending.feet` and
 * `errors.feet` in front of them: a row list that is still in flight is
 * momentarily empty, and an empty state drawn over a request that has not been
 * answered is the screen guessing. The template chain is what makes «we do not
 * know yet» and «there is nothing» different pixels.
 */
const isSourceEmpty = computed(() => cafe.cafes.length === 0);
const isSearchEmpty = computed(() => queryTerm.value !== "" && visibleCafes.value.length === 0);
const isCategoryEmpty = computed(
  () => !isSourceEmpty.value && !isSearchEmpty.value && visibleCafes.value.length === 0,
);

const activeCategoryLabel = computed(
  () => CATEGORIES.find((entry) => entry.key === category.value)?.label ?? "",
);

/**
 * The count line under the search, and only under a live query.
 *
 * With an empty field the number it would print is just the length of a list
 * the reader is already looking at, which is noise. With a query it is the one
 * thing the reader cannot see — how much was thrown away — and «۳ کافه برای
 * «آرامش»» answers it in one line. «کافه» is left singular-proof rather than
 * dualised: a search for one café and a search for three read the same way
 * here, and a wrong dual form would be a mistake a reader notices.
 */
const resultSummary = computed(() =>
  queryTerm.value === ""
    ? ""
    : `${faNumber(visibleCafes.value.length)} کافه برای «${query.value.trim()}»`,
);

/**
 * The entrance stagger, the formula `settings.vue` and `/plans` already use:
 * 50ms a step, capped at five, because past that the last row waits long
 * enough for the wait to feel broken. Copied rather than extracted — a shared
 * composable for one arithmetic expression would be a second abstraction for
 * two lines, and the cap is the part that is not obvious.
 */
const stagger = (index: number) => ({
  animationDelay: `${Math.min(index, 5) * 50}ms`,
});

/* --------------------------------------------------------------------- fab -- */

const FAB_ITEMS: ICafeFabMenuItem[] = [
  { label: "گفتگوی تازه", icon: "solar:chat-round-linear", to: "/cafe/chat" },
  { label: "میزهای پیوسته", icon: "solar:chat-dots-linear", to: "/cafe/joined" },
  // ⚠️ The one item whose destination is a LIST OF THE READER'S OWN GRANTS, so it
  // belongs with the other two navigation rows and before the settings link —
  // which stays last among the destinations that go somewhere.
  { label: "مدیریت من", icon: "solar:shield-check-linear", to: "/cafe/management" },
  { label: "تنظیمات کافه", icon: "solar:settings-linear", to: "/cafe/settings" },
  { label: "میز تازه", icon: "solar:add-circle-linear", disabled: true, badge: "به‌زودی" },
];
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="large"
      title="کافه‌ها"
      subtitle="لحظه‌های آرام برای گفت‌وگو"
    >
      <!--
        The search hangs off `#below` rather than opening a scroller of its own:
        it is the one field on this screen that must be reachable without
        scrolling, because it is how a reader leaves the list they are looking
        at. `ScreenHeader`'s own header comment notes that `#below` under
        `large` lands exactly where Screen A puts this pill.
      -->
      <template #below>
        <div class="px-4 pb-3">
          <CafeSearchPill
            v-model="query"
            placeholder="جستجو در کافه‌ها"
          />
        </div>
      </template>
    </CafeScreenHeader>

    <!--
      The scroller. `pb-32` is clearance, not decoration: `CafeBottomMenu` is
      72px of pill starting 16px off the edge, and `CafeFabMenu`'s button
      bottom edge sits at 96px, so a list that scrolled all the way to its
      content would park its last row under both. 128px clears the FAB with
      32px of air under it.
    -->
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-32">
      <!--
        The category rail. It does **not** scroll itself to the active pill on
        render: `scrollIntoView` / `scrollTo` at mount is a layout read during
        SSR-and-hydrate, and on a server that never paints it produces a
        scroll position the client disagrees with. The rail starts at its own
        first chip, which is «همه» and the default anyway.

        `overscroll-x-contain` stops a horizontal swipe that runs off the end
        of the rail from chaining down and dragging the list sideways too.
      -->
      <div
        class="flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1"
        role="group"
        aria-label="دسته‌بندی کافه‌ها"
      >
        <!--
          `inline-flex items-center` is not decoration — it is what makes the
          label sit in the middle of the chip.

          A `<button>` is `display: inline-block` (Tailwind's preflight sets
          `font: inherit` on it and nothing else), and an inline-block places its
          line boxes at the **top** of its content box: `min-height` widens the
          box, it never re-centres what is inside. So the chip is 44px, the
          label's line box is `text-sm` = 20px, and the label was drawn at
          y=0 with 24px of dead space beneath it — a Persian word's optical
          centre at 10.8px inside a pill whose centre is at 22px, i.e. **11.2px
          high**. `items-center` centres the line box and the error drops to the
          0.8px every Persian line sits off-centre by in this font.

          Matching the two sibling tablists (`/cafe/chat`, `/cafe/joined`), which
          already declare `flex items-center justify-center`.
        -->
        <button
          v-for="entry in CATEGORIES"
          :key="entry.key"
          type="button"
          :aria-pressed="category === entry.key"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm transition-colors"
          :class="
            category === entry.key
              ? 'bg-x-text-title font-bold text-x-primary-content-50'
              : 'bg-x-primary-content-200 text-x-text-subtitle hover:bg-x-primary-content-300'
          "
          @click="category = entry.key"
        >
          {{ entry.label }}
        </button>
      </div>

      <p
        v-if="resultSummary"
        class="px-4 pt-3 pb-1 text-xs text-x-text-subtitle"
        aria-live="polite"
      >
        {{ resultSummary }}
      </p>

      <!--
        ## LOADING AND REFUSAL COME BEFORE EVERY EMPTY STATE

        `CafeStateBlock`'s own `loading` variant is the feature's list skeleton —
        the same `USkeleton` rows `CafeChatItemSkeleton` draws — so the three
        states are one component with three props rather than three blocks that
        could drift. `:rows="5"` because this list is rows of cards and four
        reads as a half-empty screen on a phone.
      -->
      <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

      <CafeStateBlock
        v-else-if="loadError"
        state="error"
        title="کافه‌ها بارگذاری نشد"
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
        icon="solar:cup-hot-linear"
        title="هنوز کافه‌ای وجود ندارد"
        description="به‌زودی کافه‌های تازه این‌جا باز می‌شوند"
      />

      <CafeStateBlock
        v-else-if="isSearchEmpty"
        state="empty"
        icon="solar:magnifer-linear"
        title="کافه‌ای با این جستجو پیدا نشد"
        description="واژهٔ دیگری را امتحان کنید یا فیلتر دسته‌بندی را بردارید"
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
        v-else-if="isCategoryEmpty"
        state="empty"
        icon="solar:cup-hot-linear"
        :title="`در بخش «${activeCategoryLabel}» کافه‌ای نیست`"
        description="می‌توانید بخش دیگری را انتخاب کنید یا همهٔ کافه‌ها را ببینید"
      >
        <template #action>
          <UButton
            type="button"
            variant="soft"
            color="x-primary"
            label="نمایش همهٔ کافه‌ها"
            class="mt-1"
            :ui="{ base: 'rounded-full' }"
            @click="showAllCategories"
          />
        </template>
      </CafeStateBlock>

      <!--
        A `<div>`, not a `<ul>` of `<li>`s, and the reason is `CafeCard`'s own
        contract: its hairline is `not-last:border-b`, which is `&:not(:last-child)`
        — a **DOM** relationship. An `<li>` wrapper would make every card the
        only and therefore last child of its own parent, and every divider would
        vanish. `CafeCard`'s header says the same thing from the other side: "it
        only behaves if rows are siblings".

        The row is a link rather than a list item, so a plain container of
        anchors is valid markup — and the entrance animation rides along on
        `class`/`style` fallthrough, which Vue merges into the card's own root
        class rather than replacing it.
      -->
      <div v-else>
        <CafeCard
          v-for="(cafe, index) in visibleCafes"
          :key="cafe.id"
          :cafe="cafe"
          :to="`/cafe/${cafe.id}/table`"
          :now="now"
          class="reveal-stagger"
          :style="stagger(index)"
        />
      </div>
    </div>

    <CafeFabMenu :items="FAB_ITEMS" label="ساختن کافه" />
  </div>
</template>
