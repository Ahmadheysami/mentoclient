<script setup lang="ts">
import type { ICafeAccess } from "~/types/cafe";

/**
 * `/cafe/management` — «مدیریت من»: the cafés and tables this reader administers.
 *
 * A **nested** screen, like `/cafe/settings`: it is reached from `/cafe`'s own FAB
 * menu, so it takes `CafeScreenHeader`'s `compact` shape and a chevron back to
 * `/cafe` rather than a root screen's large title and no way back. It has no FAB
 * of its own — the button that brought the reader here has nothing left to offer.
 *
 * ## WHERE THE TWO LISTS COME FROM, AND WHY THEY ARE TWO
 *
 * `GET /me/my-ct` answers ONE list of grants, and each grant populates **at most
 * one** of the two `cafe` / `table` arrays beside it: the `cafe` virtual is looked
 * up by `targetId` on `Cafe.id`, the `table` one on `Cafe Table.id`
 * (`Server/src/models/cafe-access.model.ts`). So the pair — never `grant.type`,
 * which a grant inserted straight into Mongo does not carry at all, see
 * `ICafeAccess` — is what says whether a row belongs under «کافه‌ها» or «میزها»,
 * and that is exactly how `cafeGrants` / `tableGrants` below partition it.
 *
 * ⚠️ `fetchMyAccess()` IS CALLED WITH **NO ARGUMENT**, and that is the whole point
 * of this screen: the backend filters on `type`, the real grants often carry
 * none, and `?type=cafe` answers an empty list for a reader who manages a café.
 * The store's own header carries the measurement; do not pass `type` "to make it
 * faster" — it empties the screen and looks like the truth.
 *
 * Awaited in the **setup body**, like every other café page, so the server's HTML
 * carries the grants and the Pinia payload carries them to the client's first
 * paint. `onMounted` would draw «تا کنون به میز یا کافه دعوت نشدید» — a statement
 * about the reader's own account — over a reader who does, in fact, administer
 * something.
 *
 * ⚠️ The server's `hasAccess` ignores `startAt`, and so does nothing else on this
 * screen: a grant is listed from the day it exists, whatever its own start date
 * says. That is the backend's behaviour, restated here rather than worked around,
 * because the alternative is hiding a permission the reader really holds.
 */

definePageMeta({
  layout: "cafe",
  middleware: ["auth"],
});

useSeoMeta({
  title: "مدیریت من",
});

const cafe = useCafe();

await cafe.fetchMyAccess();

/**
 * Three answers off the store's own per-resource flags: the skeleton while the
 * request is open, the Persian sentence `parseCafeFailure` already wrote when it
 * was refused, and the empty block when the answer arrived with nothing in it.
 *
 * `errors` and not `loaded`, because a refusal sets `loaded` too — it is a known
 * answer — so only the sentence tells the two apart.
 */
const isLoading = computed(() => cafe.pending.myAccess);
const loadError = computed(() => cafe.errors.myAccess);

/**
 * The `#action` of the refusal block: drop the answer and the sentence, then ask
 * again, so the screen leaves the error for the skeleton instead of holding the
 * refusal on screen next to a request already on its way.
 */
function retry() {
  cafe.reset("myAccess");

  void cafe.fetchMyAccess();
}

/**
 * The screen's one clock reading, taken once on mount.
 *
 * `CafeCard` and `CafeTableCard` each print a `CafeMessageTimestamp`, and
 * «۳ دقیقه پیش» is a question about *now*: answered from the server's clock and
 * again from the phone's it is a hydration mismatch on the very first paint, and
 * the row visibly changes its mind. Undefined until mount, so the server and the
 * client's first paint agree and only a mounted client may say «همین الآن».
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/* ------------------------------------------------------------------ the two -- */

/**
 * The café grants: the rows whose `cafe` array the populate filled.
 *
 * ⚠️ NOT `grant.type === "cafe"`. That test is `false` for every grant that
 * skipped schema validation — including this session's café grant, measured — and
 * it is the branch the deleted version of this screen took, which is why it
 * printed «بدون نام» on a row the API had already named. See `ICafeAccess`.
 */
const cafeGrants = computed(() => cafe.myAccess.filter((grant) => grant.cafe.length > 0));

/**
 * The table grants, and ⚠️ ONLY the ones this route can actually reach.
 *
 * A table row carries no guarantee of a `cafeId` on every endpoint — the
 * subscribed and search views do not populate it — and the thread route is
 * `/cafe/:cafeId/table/:tableId`, so a grant whose table does not name its café
 * has **no link to offer**. It is omitted rather than rendered as a row pointing
 * at `/cafe/undefined/table/…`, which is a live-looking row that opens nothing.
 * The same rule as `managedCafeIds`: a grant this screen cannot name is a grant
 * it cannot show.
 */
const tableGrants = computed(() =>
  cafe.myAccess.filter((grant) => typeof grant.table[0]?.cafeId === "string"),
);

/** Where a café grant opens: its own table list, exactly where `/cafe` sends one. */
const cafeTo = (grant: ICafeAccess): string => `/cafe/${grant.cafe[0]!.id}/table`;

/**
 * Where a table grant opens.
 *
 * ⚠️ The PUBLIC `tableId` with the uniqid as the fallback — the same two id
 * families, and the same preference, as `/cafe/joined`'s `channelTo`: a route may
 * carry the public handle, and `fetchTable` resolves whichever it is handed. See
 * rule 4 in `app/pages/cafe/README.md`.
 */
const tableTo = (grant: ICafeAccess): string => {
  const table = grant.table[0]!;

  return `/cafe/${table.cafeId}/table/${table.tableId ?? table.id}`;
};

/**
 * ⚠️ `loaded.myAccess`, and never the length of a list on its own.
 *
 * An empty list is momentarily true while the request is still open, so the test
 * has to know the answer ARRIVED — and `pending` / `errors` are in front of it in
 * the template, so what reaches here is a refusal-free, settled answer. «you
 * administer nothing» is a claim about the reader's own account, and drawing it
 * over an unanswered request is the screen guessing about them.
 *
 * ⚠️ The two PARTITIONS, not `myAccess.length === 0`: a grant that populates
 * neither array, and a table grant whose table does not name its café, are rows
 * this screen cannot draw — so a reader holding ONLY those has a list that is
 * non-empty and a screen with nothing on it. That is the blank screen this
 * condition exists to prevent; the sentence below is the best one available for
 * it, and it is far better than a healthy-looking page with no rows.
 */
const isEmpty = computed(
  () =>
    cafe.loaded.myAccess &&
    cafeGrants.value.length === 0 &&
    tableGrants.value.length === 0,
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <CafeScreenHeader
      variant="compact"
      back="/cafe"
      title="مدیریت من"
      subtitle="کافه‌ها و میزهایی که مدیر آن‌ها هستید"
    />

    <!--
      `pb-32` is the same clearance the three list screens use: `CafeBottomMenu`
      is 72px of pill starting 16px off the edge, and the scroller has to park its
      last row above it rather than under it.
    -->
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-32">
      <!--
        Loading, refusal and empty come FIRST, for the reason they do on every
        other café page: «the rows did not arrive» and «the rows arrived and there
        are none» are different answers, and a list that swaps between them looks
        like a fault rather than like a fact.

        `state="loading"` is `CafeStateBlock`'s own list skeleton — the same
        `USkeleton` rows `CafeChatItemSkeleton` draws, in the feature's tokens,
        which is what the sibling lists show for the same reason.
      -->
      <CafeStateBlock v-if="isLoading" state="loading" :rows="5" />

      <CafeStateBlock
        v-else-if="loadError"
        state="error"
        title="دسترسی‌های شما بارگذاری نشد"
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
        v-else-if="isEmpty"
        state="empty"
        icon="solar:shield-check-linear"
        title="تا کنون به میز یا کافه دعوت نشدید"
        description="به‌محض اینکه مدیریت کافه یا میزی به شما سپرده شود، همین‌جا نمایش داده می‌شود"
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

      <!--
        ## THE TWO GROUPS
        A plain `<h2>` + a plain `<div>`, in `settings.vue`'s idiom for a group
        label and the list screens' idiom for rows — no card, no ring. Each group
        keeps its own container so `not-last:border-b` (a **DOM** relationship,
        see `CafeCard`'s header) draws its dividers between its OWN rows and not
        across the boundary between the two lists.

        A group whose list is empty is not drawn at all, label included: a heading
        with nothing under it reads as a broken screen rather than as «you manage
        cafés and no tables».
      -->
      <div v-else class="flex flex-col gap-6 pt-4">
        <section v-if="cafeGrants.length > 0" aria-labelledby="cafe-management-cafes">
          <h2
            id="cafe-management-cafes"
            class="mb-2 px-4 text-xs font-bold text-x-text-subtitle"
          >
            کافه‌ها
          </h2>

          <div>
            <CafeCard
              v-for="grant in cafeGrants"
              :key="grant.cafe[0]!.id"
              :cafe="grant.cafe[0]!"
              :to="cafeTo(grant)"
              :now="now"
            />
          </div>
        </section>

        <section
          v-if="tableGrants.length > 0"
          aria-labelledby="cafe-management-tables"
        >
          <h2
            id="cafe-management-tables"
            class="mb-2 px-4 text-xs font-bold text-x-text-subtitle"
          >
            میزها
          </h2>

          <div>
            <CafeTableCard
              v-for="grant in tableGrants"
              :key="grant.table[0]!.id"
              :table="grant.table[0]!"
              :to="tableTo(grant)"
              :now="now"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>