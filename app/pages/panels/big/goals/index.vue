<script setup lang="ts">
import { GOAL_DOMAINS, goalDomainOf, type GoalDomain } from "~/types/goal";

/**
 * The goals hub: six category tiles and the radar of where the reader started.
 *
 * Counts are per category and therefore per bucket in the store. Fetching all six
 * lists here costs six requests on the hub's first paint, which is why a
 * category page re-reads its own bucket from the warm store instead of asking
 * again — the count on a tile and the card on the category page can never be two
 * different numbers.
 *
 * The CHART is the screen's one non-obvious honest statement, and the reason this
 * page is not a plain grid: `GET /goal/chart` averages the self-rating each goal
 * was CREATED with, and the backend never recomputes it. So it is drawn, labelled
 * «نقطهٔ شروع», and never described as progress.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "هدف‌گذاری",
});

useSeoMeta({ title: "هدف‌گذاری" });

const goalStore = useGoal();

/**
 * `score` per domain for the tiles, `null` for "not loaded".
 *
 * The chart points are keyed by `slug`, not by domain — the same key the API uses
 * — so a tile cannot be given another category's number if the two orders ever
 * diverged upstream.
 */
const chartScores = computed<Record<GoalDomain, number | null>>(() => {
  const scores = {} as Record<GoalDomain, number | null>;
  const chart = goalStore.state.chart;

  for (const domain of GOAL_DOMAINS) {
    if (chart === null) {
      scores[domain] = null;
      continue;
    }

    // The domain is read back OUT of the `_id` rather than compared against
    // `GOAL_DOMAINS_META[domain].slug`. The slugs do agree today — they were
    // checked character-for-character against `app.config.json`'s
    // `panels.modules.goal.list` — but a hand-written copy of a string the server
    // owns fails SILENTLY: one mismatched axis becomes `0` with no error anywhere,
    // and `۰` on a tile is a claim about the reader. `goalDomainOf` is the single
    // place that reads the key, shared with `RadarChart`, so a tile and an axis
    // cannot disagree about which point is theirs.
    const point = chart.find((item) => goalDomainOf(item._id) === domain);

    scores[domain] = point ? Number(point.score) || 0 : 0;
  }

  return scores;
});

/**
 * Ask again for a figure that failed to arrive.
 *
 * `getChart` returns early only once `state.chart` is filled, so a call made from
 * this state really does put a second request on the wire, and nothing is awaited:
 * every outcome lands in `state.chart`, `state.error.chart` or
 * `state.chartUnavailable`, and all three are rendered by the template below.
 *
 * There is deliberately no `:loading` on the button it is called from: `getChart`
 * clears `error.chart` as it raises `loading.chart`, in the same tick, so this
 * state is unmounted before the flag could ever paint. What the reader sees after
 * a press is the figure's own skeleton, which is the spinner that actually belongs
 * to the request.
 */
function retryChart(): void {
  void goalStore.getChart();
}

onMounted(async () => {
  // Six lists, in parallel — the hub is the only screen that shows every bucket,
  // so it is the only screen that has to ask for all of them. Each writes its own
  // bucket, so they cannot overwrite one another.
  await Promise.all(GOAL_DOMAINS.map((domain) => goalStore.getGoals(domain)));

  await goalStore.getChart();
});
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <p class="reveal text-sm leading-6 text-x-text-subtitle">
      شش دستهٔ هدف، و نقطهٔ شروع شما در هرکدام.
    </p>

    <section
      aria-labelledby="panel-goals-chart"
      class="mt-4 rounded-3xl bg-white p-4 shadow-xs ring-1 ring-x-primary-100"
    >
      <h2
        id="panel-goals-chart"
        class="text-sm font-yekan-bold text-x-text-title"
      >
        نمودار نقطهٔ شروع
      </h2>

      <!--
        `<ClientOnly>` with the skeleton as its FALLBACK slot: apexcharts measures
        the DOM as it renders and is not SSR-safe, so the server must never run it.
        The fallback is the same height as the chart it stands in for, so the hub
        does not jump when the polygon arrives, and it is `aria-busy` — which is
        how a screen reader is told the figure is still coming.
      -->
      <ClientOnly>
        <!--
          The permanently-unavailable state comes FIRST and renders INSTEAD of the
          chart: the endpoint throws when the reader has no active plan, so there
          is no figure to draw — a zeroed polygon beside this message would claim
          the reader scored nothing in six categories, which is not what happened.
          It carries no retry on purpose: re-asking a request that cannot succeed
          would offer a button that lies. It points at `/plans`, the only thing that
          fixes it.

          It is written out here rather than handed to `UiStateMessage` because that
          component is a full-screen state: its root is `h-[55dvh]`, which inside
          this card would make a chart-sized section half the viewport tall, and it
          draws a 20-unit icon disc sized for a screen of its own. This is the same
          copy in the same card's own dimensions.
        -->
        <div
          v-if="goalStore.state.chartUnavailable"
          class="flex min-h-72 flex-col items-center justify-center gap-2.5 px-2 text-center"
        >
          <span
            class="grid size-14 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:chart-2-linear" size="28" />
          </span>

          <p class="text-sm font-yekan-bold text-x-text-title">
            نمودار پیشرفت در دسترس نیست
          </p>

          <p class="max-w-64 text-xs leading-6 text-x-text-subtitle">
            نمودار به یک پلن فعال نیاز دارد؛ پس از فعال شدن پلن، همین‌جا نمایش
            داده می‌شود.
          </p>

          <UButton
            to="/plans"
            label="مشاهده پلن‌ها"
            icon="solar:card-linear"
            trailing-icon
            variant="soft"
            color="x-primary"
            size="sm"
            class="mt-1"
            :ui="{ base: 'h-10 rounded-full' }"
          />
        </div>

        <!--
          A refusal that is neither of the states above — the one transport failure
          this route can still recover from, and therefore the only one of the
          three that carries a RETRY.

          It is its own mini-state rather than the single red line it was, because a
          line of text under the figure was a card collapsed to nothing, with nothing
          to press. And nothing could be pressed, because the one thing that state
          was missing is a second request — which is exactly what a failed request
          can be given. `min-h-72` is the figure's own height, so the six tiles below
          do not jump either way. None of these states blocks the page: the tiles
          stay usable in all of them. (`GoalRadarChart` owns a fourth of its own, for
          an answer that arrived with no figure in it; that request SUCCEEDED, so
          there is nothing there to retry either.)

          ⚠️ The line between this and the state above is load-bearing and must not
          blur: `chartUnavailable` is the endpoint's PERMANENT refusal (no active
          plan), so it links to `/plans` and offers no retry, because re-asking
          cannot succeed.
        -->
        <div
          v-else-if="goalStore.state.error.chart"
          class="flex min-h-72 flex-col items-center justify-center gap-2.5 px-2 text-center"
        >
          <span
            class="grid size-14 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:link-broken-linear" size="28" />
          </span>

          <p role="alert" class="text-sm font-yekan-bold text-x-text-title">
            {{ goalStore.state.error.chart }}
          </p>

          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            variant="soft"
            color="x-primary"
            size="sm"
            class="mt-1 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-10 rounded-full' }"
            @click="retryChart"
          />
        </div>

        <GoalRadarChart
          v-else
          :points="goalStore.state.chart"
          :loading="goalStore.state.loading.chart"
        />

        <template #fallback>
          <div aria-busy="true">
            <USkeleton class="mt-2 h-72 w-full rounded-3xl bg-x-primary-50" />
            <span class="sr-only">در حال دریافت نمودار</span>
          </div>
        </template>
      </ClientOnly>
    </section>

    <section aria-labelledby="panel-goals-categories" class="mt-6">
      <h2
        id="panel-goals-categories"
        class="text-sm font-yekan-bold text-x-text-title"
      >
        دسته‌ها
      </h2>

      <!--
        The tiles render in `GOAL_DOMAINS` order and are links to the six static
        category pages — one file each, deliberately not a `[category]` route, so
        "every category has its own page" is a fact of the route table rather than a
        runtime guess.

        `count` is `null` while THAT category's request is in flight, because a
        bucket that has not been filled in is not an empty category and «۰ هدف» would
        say it was. The flag is per domain in the store (see `getGoals`), so a tile
        that has answered prints its count while its five siblings still show an
        em-dash — which is the truth about each of them, and the whole reason the
        six are not sharing one boolean.
      -->
      <ul class="mt-3 grid gap-3">
        <li
          v-for="(domain, index) in GOAL_DOMAINS"
          :key="domain"
          class="reveal-stagger"
          :style="{ animationDelay: `${Math.min(index, 5) * 50}ms` }"
        >
          <GoalCategoryCard
            :domain="domain"
            :count="
              goalStore.state.loading.list[domain]
                ? null
                : goalStore.goalsOf(domain).length
            "
            :score="chartScores[domain]"
          />
        </li>
      </ul>
    </section>

    <p class="mt-6 text-center text-xs leading-6 text-x-text-muted">
      امتیاز ۱ تا ۱۰ را خودتان، هنگام ثبت هدف، انتخاب می‌کنید.
    </p>
  </div>
</template>