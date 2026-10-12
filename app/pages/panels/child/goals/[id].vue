<script setup lang="ts">
import { gsap } from "gsap";
import { faNumber } from "~/utils/fa";

definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "مراحل هدف" });

const route = useRoute();
const childPanel = useChildPanel();
const goalAward = useGoalAward();
const { $toast } = useNuxtApp();

const goalId = computed<string>(() => String(route.params.id ?? ""));

const goalTitle = computed<string>(
  () => goalAward.state.goals.find((goal) => goal.id === goalId.value)?.goal ?? "",
);

onMounted(async () => {
  await Promise.all([
    goalAward.loadChildGoals(),
    goalAward.loadSteps(goalId.value, "child"),
  ]);
});

/**
 * The one step the child may work on right now.
 *
 * The steps unlock one at a time — the child confirms a step, the parent grants
 * it (and its award), and only then the next one opens — so searching for "not
 * approved by anybody" hands the child the step AFTER the one the parent has not
 * seen yet. The search stops at the first step the parent has not granted:
 * if the child has already confirmed THAT one, there is nothing to do and the
 * page says so (`-1`).
 */
const activeStep = computed(() => {
  const index = goalAward.state.steps.findIndex(
    (step) => !step.approvedByParent,
  );

  if (index === -1) return -1;

  return goalAward.state.steps[index]?.approvedByChild ? -1 : index;
});

/**
 * The goal is OVER — every stage was confirmed by the child and granted by the
 * parent, the reward included. This is the two-phase end state, not merely "the
 * last step was typed": the parent only ever grants what the child confirmed.
 */
const allGranted = computed(
  () =>
    goalAward.state.steps.length > 0 &&
    goalAward.state.steps.every((step) => step.approvedByParent),
);

const grantedCount = computed(
  () => goalAward.state.steps.filter((step) => step.approvedByParent).length,
);

/** The step the child finished but the parent has not granted yet. */
const pendingParentIndex = computed(() =>
  goalAward.state.steps.findIndex((step) => step.approvedByChild && !step.approvedByParent),
);

/**
 * Why nothing is tappable anywhere on the page, or `null` when something is.
 *
 * A list of cards with no action on it reads to a child like a broken screen
 * rather than like «your turn is coming», so the page has to say so — but it has
 * to name the REAL reason, because "nothing new" and "waiting for the parent"
 * are different silences. `null` once the goal itself is over: that state has
 * its own message below.
 */
const waitNotice = computed<string | null>(() => {
  if (activeStep.value !== -1 || allGranted.value) return null;

  return pendingParentIndex.value !== -1
    ? "این مرحله را ثبت کردی؛ به‌محض اینکه والدت تأییدش کند، قدم بعدی باز می‌شود."
    : "فعلاً مرحلهٔ تازه‌ای برای انجام دادن نیست؛ به‌محض باز شدن قدم بعدی، همین‌جا می‌بینیش.";
});

/**
 * The statuses `ChildJourneyPath` draws — the same facts the cards below carry.
 *
 * Correct because `activeStep` is the FIRST step the parent has not granted: a
 * step waiting on the parent is always that first one, so everything after it
 * is `locked` rather than `active`.
 */
type JourneyStatus = "done" | "active" | "pending-parent" | "locked";

const journeySteps = computed<Array<{ status: JourneyStatus }>>(() =>
  goalAward.state.steps.map((step, index) => ({
    status: step.approvedByParent
      ? "done"
      : index === activeStep.value
        ? "active"
        : step.approvedByChild
          ? "pending-parent"
          : "locked",
  })),
);

/**
 * The step whose story the sheet is showing, or `null` when it is closed.
 *
 * One id for the whole page rather than a sheet per step: the child reads one
 * story at a time, and a sheet that lives inside the `v-for` would be rebuilt
 * on every steps reload — which is exactly what happens right after «انجام
 * دادم!». Resolving it through the store (not a copied snapshot) keeps the title
 * and the text correct when the steps are reloaded underneath the sheet.
 */
const storyStepId = ref<string | null>(null);

const storyStep = computed(
  () => goalAward.state.steps.find((step) => step.id === storyStepId.value) ?? null,
);

/** Guarded so the sheet cannot render a story nobody selected. */
const storyMarkdown = computed<string | null>(
  () => storyStep.value?.ai?.result ?? null,
);

/**
 * Steps the reader finished this session, keyed by step id.
 *
 * Session-local ONLY: a plain ref, never persisted, and nothing on the server
 * knows about it. It exists so the entry point can quietly say «خوانده شد»
 * when the child comes back to a story they have already finished — nothing
 * more is implied.
 */
const readStories = ref<Record<string, boolean>>({});

function openStory(stepId: string): void {
  storyStepId.value = stepId;
}

function closeStory(): void {
  storyStepId.value = null;
}

function onStoryFinished(): void {
  if (storyStepId.value) readStories.value[storyStepId.value] = true;
  closeStory();
}

const listEl = ref<HTMLElement | null>(null);
let stepCtx: gsap.Context | undefined;

/**
 * One subtle emphasis pulse on the card the child can act on right now —
 * once, when the steps arrive. Reduced motion leaves it flat.
 */
watch(
  () => goalAward.state.loading.steps,
  (loading) => {
    if (!import.meta.client || loading) return;

    nextTick(() => {
      const card = listEl.value?.querySelector<HTMLElement>(
        '[data-step-active="true"]',
      );

      if (
        !card ||
        document.documentElement.dataset.motion === "reduced" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      stepCtx?.revert();
      stepCtx = gsap.context(() => {
        gsap.fromTo(
          card,
          { scale: 1 },
          {
            scale: 1.03,
            duration: 0.3,
            yoyo: true,
            repeat: 1,
            ease: childPanel.variant === "child" ? "back.out(1.4)" : "power2.out",
            transformOrigin: "center center",
          },
        );
      });
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  stepCtx?.revert();
});

async function done(): Promise<void> {
  const result = await goalAward.approveStep(goalId.value, "child");

  if (result.ok) {
    $toast.success(result.message || "ثبت شد");
    await goalAward.loadSteps(goalId.value, "child");
    await goalAward.loadChildGoals();
    return;
  }

  $toast.error(result.message);
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <NuxtLink
      to="/panels/child/goals"
      class="inline-flex min-h-11 items-center gap-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="childPanel.variant === 'child' ? 'text-x-kid-900 focus-visible:outline-x-kid-berry-700' : 'text-x-text-subtitle focus-visible:outline-x-teen-violet-600'"
    >
      <UIcon name="solar:alt-arrow-right-linear" size="16" aria-hidden="true" />
      همهٔ هدف‌ها
    </NuxtLink>

    <h2 class="mt-2 text-lg font-yekan-extra text-x-text-title">
      {{ goalTitle || "مراحل هدف" }}
    </h2>

    <div v-if="goalAward.state.loading.steps" class="mt-4 grid gap-3" aria-busy="true">
      <USkeleton
        v-for="row in 3"
        :key="row"
        class="h-28 bg-white"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      />
    </div>

    <UAlert
      v-else-if="goalAward.state.error.steps"
      class="mt-4"
      variant="soft"
      color="error"
      :title="goalAward.state.error.steps"
    >
          <template #actions>
        <UButton
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          :ui="{
            base: [
              'min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2',
              childPanel.variant === 'child'
                ? 'focus-visible:outline-x-kid-berry-700'
                : 'focus-visible:outline-x-teen-violet-600',
            ],
          }"
          @click="void goalAward.loadSteps(goalId, 'child')"
        />
      </template>
    </UAlert>

    <UiStateMessage
      v-else-if="goalAward.state.steps.length === 0"
      icon="solar:clipboard-list-linear"
      title="این هدف مرحله‌ای ندارد"
    />

    <template v-else>
      <p class="mt-2 text-xs text-x-text-subtitle">
        {{ faNumber(grantedCount) }} از {{ faNumber(goalAward.state.steps.length) }} مرحله با جایزه تمام شده
      </p>

      <!-- The whole journey at a glance; the cards below carry the details. -->
      <div
        class="neu-raised mt-4 bg-white p-4"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      >
        <ChildJourneyPath :steps="journeySteps" :variant="childPanel.variant" />
      </div>

      <!--
        `activeStep === -1` means every step is either granted or already
        registered and waiting on the parent, so NO card renders the «انجام
        دادم!» button. The page still has to say so: a list of cards with no
        action anywhere on it reads to a child like a broken screen rather than
        like «your turn is coming», and the silence is what made this look like
        the steps never loaded. `waitNotice` is `null` once the goal is over, so
        this never argues with the finished state further down.
      -->
      <p
        v-if="waitNotice"
        class="neu-inset mt-4 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs leading-6"
        :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-700'"
      >
        <UIcon
          name="solar:hourglass-linear"
          size="16"
          aria-hidden="true"
          class="shrink-0"
        />
        <span>{{ waitNotice }}</span>
      </p>

      <ul ref="listEl" class="mt-4 grid gap-3">
        <li
          v-for="(step, index) in goalAward.state.steps"
          :key="step.id"
          :data-step-active="index === activeStep ? 'true' : undefined"
          :class="[
            childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl',
            index === activeStep
              ? [
                  'neu-raised-lg p-5',
                  childPanel.variant === 'child'
                    ? 'bg-x-kid-sun-100 ring-2 ring-x-kid-sun-500/60'
                    : 'bg-x-teen-100 ring-1 ring-x-teen-violet-300',
                ]
              : 'neu-raised bg-white p-4',
            index !== activeStep && !step.approvedByParent && !step.approvedByChild
              ? 'opacity-70'
              : '',
          ]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-yekan-bold" :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-700'">
              مرحلهٔ {{ faNumber(index + 1) }}
            </span>
            <span
              class="rounded-full px-2 py-1 text-[11px] font-yekan-bold"
              :class="
                step.approvedByParent
                  ? 'bg-emerald-50 text-emerald-600'
                  : step.approvedByChild
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
              "
            >
              {{
                step.approvedByParent
                  ? 'تمام'
                  : step.approvedByChild
                    ? 'منتظر تأیید والد'
                    : 'در حال انجام'
              }}
            </span>
          </div>

          <p class="mt-2 text-sm leading-7 text-x-text-body">
            {{ step.award || "بدون جایزه" }}
          </p>

          <p
            v-if="step.approvedByParent && step.approvedAward"
            class="mt-1 text-xs text-emerald-600"
          >
            {{ step.approvedAward ? 'آفرین جایزه ات رو گرفتی' : 'هنوز جایزه رو نگرفتی' }}
          </p>

          <!--
            The story belongs to the STEP, not to the button. It used to be
            gated on `index === activeStep`, which hid a step's own text the
            moment the child pressed «انجام دادم!» — the one moment they are
            most likely to want to read it again — and hid EVERY story once
            `activeStep` was -1, i.e. for a goal whose steps are all waiting on
            the parent. A step that carries one now always offers it; the card
            above still marks which step is the live one, so the page's hierarchy
            is unchanged.

            WHY A BUTTON, NOT THE TEXT: a real story is ~1100 characters of
            Markdown, and inline it pushed the award and «انجام دادم!» below the
            fold on a phone — so the card that was supposed to be about the step
            became a wall of prose. The card keeps the step's own facts, and the
            story is one tap away in a sheet that scrolls on its own.
          -->
          <UButton
            v-if="step.ai?.result"
            class="mt-3"
            size="md"
            variant="soft"
            color="neutral"
            :icon="readStories[step.id] ? 'solar:check-circle-linear' : 'solar:book-2-linear'"
            :label="readStories[step.id] ? 'خوانده شد' : 'مشاهده داستان'"
            trailing-icon="solar:alt-arrow-left-linear"
            aria-haspopup="dialog"
            :ui="{
              base: [
                'min-h-11 w-full justify-center focus-visible:outline-2 focus-visible:outline-offset-2',
                childPanel.variant === 'child'
                  ? 'bg-x-kid-sun-100 text-x-kid-900 hover:bg-x-kid-sun-500/40 focus-visible:outline-x-kid-berry-700'
                  : 'bg-x-teen-100 text-x-teen-700 hover:bg-x-teen-violet-300/50 focus-visible:outline-x-teen-violet-600',
                childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl',
              ],
            }"
            @click="openStory(step.id)"
          />

          <UButton
            v-if="index === activeStep"
            class="mt-3"
            size="md"
            variant="solid"
            color="x-primary"
            label="انجام دادم!"
            :loading="goalAward.state.loading.approve"
            :ui="{
              base: childPanel.variant === 'child'
                ? 'h-12 w-full rounded-3xl bg-x-kid-sun-500! text-x-kid-900! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-kid-berry-700'
                : 'h-12 w-full rounded-xl bg-x-teen-violet-300! text-x-teen-900! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-teen-violet-600',
            }"
            @click="done"
          />

          <p
            v-if="index === pendingParentIndex"
            class="mt-2 text-xs text-amber-600"
          >
            ثبت شد؛ منتظر تأیید والدت باش.
          </p>
        </li>
      </ul>

      <!--
        The explicit finished state, and only once BOTH halves of the deal are
        done: the child confirmed every step, the parent granted every one of
        them (the reward included). `waitNotice` is `null` here, so the page
        never says "nothing to do" beside "you finished".
      -->
      <UiStateMessage
        v-if="allGranted"
        class="mt-4"
        icon="solar:cup-star-linear"
        title="آفرین، این هدف به پایان رسید!"
        description="هر مرحله را انجام دادی و تأیید کردی و والدت هم جایزه‌ها را داد؛ این هدف تمام شد."
      />
    </template>

    <!--
      One sheet for every step on this page, and the reason the story is not
      simply dropped into the card: a ~1100-character story has to scroll
      INSIDE the sheet, not stretch the page behind it, so the body is capped
      and scrolls on its own.

      The prose itself renders through `.ai-markdown` + `renderAiMarkdown` —
      the project's single audited path, the same one every other AI surface
      uses: raw-HTML tokens are dropped and unsafe link destinations are
      blanked inside the renderer, so model output can only become markup
      through that one path. Never a hand-rolled sanitiser, never raw `v-html`.
      The sheet (`Child/StorySheet.vue`) owns that rendering.
    -->
    <ChildStorySheet
      :open="storyStepId !== null"
      :title="storyStep?.award || 'داستان این مرحله'"
      :markdown="storyMarkdown"
      @close="closeStory"
      @finished="onStoryFinished"
    />
  </div>
</template>
