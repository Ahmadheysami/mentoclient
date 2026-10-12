<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import { renderAiMarkdown } from "~/utils/markdown";
import type { GoalAwardListItem } from "~/types/goal-award";

/**
 * One child's goals, managed by the parent: create, delete, and approve steps.
 *
 * The screen owns only the dialogs; every read and write goes through
 * `useGoalAward()` so the store's `loading`/`error` slots are the single
 * source for the states below.
 *
 * The steps dialog reads as a journey: a rail runs down the inline-start edge,
 * each step is a numbered marker wearing the state it is in, and the one step
 * the parent has to act on is the only one that gets the ringed amber surface.
 * A step that carries the model's story keeps it in a recessed well of its own,
 * so the parent's own award text and the AI's words never blur together, and
 * the well opens on demand rather than by default.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "هدف‌گذاری",
});

useSeoMeta({ title: "هدف‌گذاری فرزند" });

const route = useRoute();
const parentPanel = useParentPanel();
const goalAward = useGoalAward();
const { $toast } = useNuxtApp();

const childId = computed<string>(() => String(route.params.childId ?? ""));

const childName = computed<string>(
  () =>
    parentPanel.state.detail[childId.value]?.profile.fullName?.first ??
    parentPanel.state.children.find((child) => child.userId === childId.value)?.name ??
    "",
);

onMounted(async () => {
  await Promise.all([
    parentPanel.loadChild(childId.value),
    goalAward.loadGoals(childId.value),
  ]);
});

// --- Create sheet -----------------------------------------------------------

const createOpen = ref(false);
const draftGoal = ref("");
const draftSteps = ref<{ award: string }[]>([{ award: "" }]);

const canSubmit = computed(
  () =>
    draftGoal.value.trim().length > 0 &&
    draftSteps.value.length >= 1 &&
    !goalAward.state.loading.create,
);

function resetDraft(): void {
  draftGoal.value = "";
  draftSteps.value = [{ award: "" }];
}

function addStep(): void {
  draftSteps.value.push({ award: "" });
}

function removeStep(index: number): void {
  if (draftSteps.value.length <= 1) return;
  draftSteps.value.splice(index, 1);
}

async function submitCreate(): Promise<void> {
  if (!canSubmit.value) return;

  const result = await goalAward.createGoal({
    child: childId.value,
    goal: draftGoal.value.trim(),
    steps: draftSteps.value.map((step) => ({ award: step.award.trim() })),
  });

  if (result.ok) {
    $toast.success(result.message || "هدف ساخته شد");
    createOpen.value = false;
    resetDraft();
    await goalAward.loadGoals(childId.value);
    return;
  }

  $toast.error(result.message);
}

// --- Delete -----------------------------------------------------------------

const deletingId = ref<string | null>(null);

function closeDelete(): void {
  deletingId.value = null;
}

function openCreate(): void {
  createOpen.value = true;
}

function closeCreate(): void {
  createOpen.value = false;
}

function onCreateOpen(open: boolean): void {
  createOpen.value = open;
}

function openDelete(goalId: string): void {
  deletingId.value = goalId;
}

function onDeleteOpen(open: boolean): void {
  if (!open) deletingId.value = null;
}

function onStepsOpen(open: boolean): void {
  if (!open) stepsGoalId.value = null;
}

async function retrySteps(): Promise<void> {
  if (stepsGoalId.value) await goalAward.loadSteps(stepsGoalId.value, "parent");
}

async function confirmDelete(): Promise<void> {
  if (!deletingId.value) return;

  const result = await goalAward.deleteGoal(deletingId.value);

  if (result.ok) {
    $toast.success(result.message || "هدف حذف شد");
    deletingId.value = null;
    return;
  }

  $toast.error(result.message);
}

// --- Steps ------------------------------------------------------------------

const stepsGoalId = ref<string | null>(null);
const stepsGoalTitle = ref("");

async function openSteps(goalId: string, title: string): Promise<void> {
  stepsGoalId.value = goalId;
  stepsGoalTitle.value = title;
  await goalAward.loadSteps(goalId, "parent");
}

async function approve(stepGoalId: string): Promise<void> {
  const result = await goalAward.approveStep(stepGoalId, "parent");

  if (result.ok) {
    $toast.success(result.message || "مرحله تأیید شد");
    await goalAward.loadSteps(stepGoalId, "parent");
    await goalAward.loadGoals(childId.value);
    return;
  }
  

  $toast.error(result.message);
}

/**
 * Which steps' stories are open, keyed by step id.
 *
 * A record rather than one boolean, because each step owns its own story: a
 * shared flag opened every story at once and, with ~1100 characters per story,
 * turned the dialog into a wall of text. It is dialog UI state, not domain
 * state, so it lives here instead of in the store.
 */
const openStories = ref<Record<string, boolean>>({});

/**
 * A goal is over only once it has walked PAST its last step.
 *
 * `currentStep` is 1-BASED — the list API sends (steps the parent granted) + 1
 * — so `currentStep === steps` still means the last stage is in play.
 */
function isGoalComplete(goal: GoalAwardListItem): boolean {
  return goal.steps > 0 && goal.currentStep > goal.steps;
}

/**
 * The same end state, read off the steps THIS dialog is showing: every stage
 * confirmed by the child and granted by the parent.
 *
 * Guarded the same way the list under it is, because the store keeps the last
 * goal's steps while the next one loads and after a failed load — a finished
 * banner must never belong to a goal that is not on screen.
 */
const stepsComplete = computed(
  () =>
    stepsGoalId.value !== null &&
    !goalAward.state.loading.steps &&
    goalAward.state.error.steps === null &&
    goalAward.state.steps.length > 0 &&
    goalAward.state.steps.every((step) => step.approvedByParent),
);

function isStoryOpen(stepId: string): boolean {
  return openStories.value[stepId] === true;
}

function toggleStory(stepId: string): void {
  openStories.value[stepId] = !openStories.value[stepId];
}

/**
 * Which step is actionable FOR THE PARENT: the child has done it, and the
 * parent has not granted yet. Only that chip turns the approve button on.
 */
function stepState(step: { approvedByChild: boolean; approvedByParent: boolean }) {
  if (step.approvedByParent) return "granted" as const;
  if (step.approvedByChild) return "awaiting-parent" as const;
  return "waiting-child" as const;
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <div class="flex items-start justify-between gap-3">
      <p class="text-xs leading-6 text-x-text-subtitle">
        برای {{ childName || "فرزندتان" }} هدف بسازید؛ هر مرحله جایزه‌ای دارد که بعد از تأیید شما داده می‌شود.
      </p>
      <UButton
        icon="solar:add-circle-linear"
        label="هدف جدید"
        variant="solid"
        color="x-primary"
        :ui="{ base: 'h-11 rounded-2xl bg-x-parent-600! hover:bg-x-parent-700! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
        @click="openCreate"
      />
    </div>

    <div v-if="goalAward.state.loading.goals" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton v-for="row in 2" :key="row" class="h-24 rounded-3xl bg-white" />
    </div>

    <UAlert
      v-else-if="goalAward.state.error.goals"
      class="mt-5"
      variant="soft"
      color="error"
      title="هدف‌ها خوانده نشد"
    >
      <template #description>{{ goalAward.state.error.goals }}</template>
      <template #actions>
        <UButton
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          :ui="{ base: 'min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
          @click="void goalAward.loadGoals(childId)"
        />
      </template>
    </UAlert>

    <UiStateMessage
      v-else-if="goalAward.state.goals.length === 0"
      icon="solar:flag-linear"
      title="هنوز هدفی برای این فرزند نساخته‌اید"
      description="با دکمهٔ «هدف جدید» اولین هدف را بسازید."
    />

    <ul v-else class="mt-5 grid gap-3">
      <li
        v-for="goal in goalAward.state.goals"
        :key="goal.id"
        class="neu-raised rounded-3xl bg-white p-4"
      >
        <button
          type="button"
          class="flex w-full items-center gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          @click="openSteps(goal.id, goal.goal)"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon name="solar:flag-linear" size="20" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-yekan-bold text-x-text-title">{{ goal.goal }}</span>
            <span class="block text-xs text-x-text-subtitle">
              {{
                isGoalComplete(goal)
                  ? 'همهٔ مراحل کامل شد'
                  : `مرحلهٔ ${faNumber(goal.currentStep)} از ${faNumber(goal.steps)}`
              }}
            </span>
          </span>
          <UIcon name="solar:alt-arrow-left-linear" size="18" class="shrink-0 text-x-parent-300" aria-hidden="true" />
        </button>

        <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <span class="text-[11px] text-x-text-muted">{{ faNumber(goal.steps) }} مرحله</span>
          <UButton
            variant="soft"
            color="error"
            icon="solar:trash-bin-trash-linear"
            label="حذف"
            :ui="{ base: 'min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
            @click="openDelete(goal.id)"
          />
        </div>
      </li>
    </ul>

    <!-- Create sheet -->
    <UModal
      :open="createOpen"
      fullscreen
      title="هدف جدید"
      description="هدف را بنویسید و برای هر مرحله جایزه‌ای تعیین کنید."
      :ui="{ content: 'max-w-md mx-auto' }"
      @update:open="onCreateOpen"
    >
      <template #body>
        <div class="space-y-5 pb-4">
          <UFormField label="هدف چیست؟" required>
            <UTextarea
              v-model="draftGoal"
              color="x-secondary"
              variant="soft"
              :rows="3"
              :maxrows="6"
              placeholder="مثلاً: منظم کتاب خواندن"
              :ui="{ base: 'min-w-md max-w-md rounded-2xl bg-x-secondary-50' }"
            />
          </UFormField>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-yekan-bold text-x-text-title">مراحل</span>
              <UButton
                variant="soft"
                color="neutral"
                icon="solar:add-circle-linear"
                label="افزودن مرحله"
                :ui="{ base: 'min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
                @click="addStep"
              />
            </div>

            <div
              v-for="(step, index) in draftSteps"
              :key="index"
              class="rounded-2xl bg-x-parent-50 p-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-yekan-bold text-x-parent-700">
                  مرحلهٔ {{ faNumber(index + 1) }}
                </span>
                <UButton
                  v-if="draftSteps.length > 1"
                  variant="ghost"
                  color="error"
                  icon="solar:trash-bin-trash-linear"
                  aria-label="حذف این مرحله"
                  :ui="{ base: 'min-h-11 min-w-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
                  @click="removeStep(index)"
                />
              </div>
              <UInput
                v-model="step.award"
                class="mt-2 w-full"
                color="x-primary"
                variant="soft"
                placeholder="جایزهٔ این مرحله (می‌تواند خالی باشد)"
                :ui="{ base: 'h-11 rounded-xl bg-white' }"
              />
            </div>
          </div>

          <p
            v-if="goalAward.state.error.create"
            role="alert"
            class="rounded-2xl bg-red-50 px-4 py-3 text-xs leading-6 text-red-600"
          >
            {{ goalAward.state.error.create }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2 pb-2">
          <UButton
            label="انصراف"
            variant="soft"
            color="neutral"
            class="flex-1 grid place-items-center"
            :ui="{ base: 'h-12 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
            :disabled="goalAward.state.loading.create"
            @click="closeCreate"
          />
          <UButton
            label="ثبت هدف"
            variant="solid"
            color="x-primary"
            class="flex-[2] grid place-items-center"
            :loading="goalAward.state.loading.create"
            :disabled="!canSubmit"
            :ui="{ base: 'h-12 rounded-2xl bg-x-parent-600! hover:bg-x-parent-700! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
            @click="submitCreate"
          />
        </div>
      </template>
    </UModal>

    <!-- Delete confirm -->
    <UModal
      :open="deletingId !== null"
      :ui="{ content: 'sm:max-w-sm' }"
      title="حذف هدف؟"
      description="با حذف این هدف، همهٔ مرحله‌هایش هم حذف می‌شود."
      @update:open="onDeleteOpen"
    >
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="انصراف"
            variant="soft"
            color="neutral"
            class="flex-1 grid place-items-center"
            :ui="{ base: 'h-12 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
            :disabled="goalAward.state.loading.remove"
            @click="closeDelete"
          />
          <UButton
            label="حذف"
            variant="solid"
            class="flex-1 bg-red-500 grid place-items-center"
            :loading="goalAward.state.loading.remove"
            :ui="{ base: 'h-12 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>

    <!-- Steps -->
    <UModal
      :open="stepsGoalId !== null"
      fullscreen
      :title="stepsGoalTitle || 'مراحل هدف'"
      description="هر مرحله را فرزندتان انجام می‌دهد؛ بعد از تأیید او، جایزه را بدهید."
      :ui="{ content: 'sm:max-w-md' }"
      @update:open="onStepsOpen"
    >
      <template #body>
        <div v-if="goalAward.state.loading.steps" class="grid gap-3" aria-busy="true">
          <USkeleton v-for="row in 3" :key="row" class="h-24 rounded-3xl bg-white" />
        </div>

        <UAlert
          v-else-if="goalAward.state.error.steps"
          variant="soft"
          color="error"
          title="مراحل خوانده نشد"
        >
          <template #description>{{ goalAward.state.error.steps }}</template>
          <template #actions>
            <UButton
              icon="solar:refresh-linear"
              label="تلاش دوباره"
              variant="outline"
              color="error"
              :ui="{ base: 'min-h-11 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
              @click="retrySteps"
            />
          </template>
        </UAlert>

        <UiStateMessage
          v-else-if="goalAward.state.steps.length === 0"
          icon="solar:clipboard-list-linear"
          title="این هدف مرحله‌ای ندارد"
        />

        <ol v-else class="grid">
          <li
            v-for="(step, index) in goalAward.state.steps"
            :key="step.id"
            class="relative ps-10 pb-3 last:pb-0"
          >
            <!--
              The rail: one hairline running down the inline-start edge from
              marker to marker, so the list reads as a single path. Its colour
              is the state of the step it leaves behind — a granted step has
              already been walked.
            -->
            <span
              v-if="index < goalAward.state.steps.length - 1"
              aria-hidden="true"
              class="absolute top-9 bottom-0 start-[15px] w-0 border-s-2"
              :class="
                stepState(step) === 'granted'
                  ? 'border-emerald-200'
                  : stepState(step) === 'awaiting-parent'
                    ? 'border-amber-200'
                    : 'border-slate-200'
              "
            />

            <!-- The stop itself: the step's number, wearing its state. -->
            <span
              class="absolute start-0 top-1 z-10 grid size-8 place-items-center rounded-full text-xs font-yekan-bold"
              :class="
                stepState(step) === 'granted'
                  ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                  : stepState(step) === 'awaiting-parent'
                    ? 'bg-amber-500 text-white ring-4 ring-amber-200'
                    : 'border border-slate-200 bg-white text-slate-400 ring-4 ring-slate-100'
              "
              :aria-label="`مرحلهٔ ${faNumber(index + 1)}`"
            >
              {{ faNumber(index + 1) }}
            </span>

            <!--
              The one step waiting on the parent is the only ringed, tinted
              surface in the list, and it keeps the other cards plain white —
              the eye finds it without reading a word.
            -->
            <div
              class="rounded-3xl p-4"
              :class="
                stepState(step) === 'awaiting-parent'
                  ? 'bg-amber-50 ring-2 ring-amber-300'
                  : 'neu-raised bg-white'
              "
            >
              <div class="flex items-center justify-end">
                <span
                  class="rounded-full px-2.5 py-1 text-[11px] font-yekan-bold"
                  :class="
                    stepState(step) === 'granted'
                      ? 'bg-emerald-50 text-emerald-600'
                      : stepState(step) === 'awaiting-parent'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-500'
                  "
                >
                  {{
                    stepState(step) === 'granted'
                      ? 'جایزه داده شد'
                      : stepState(step) === 'awaiting-parent'
                        ? 'منتظر تأیید شما'
                        : 'منتظر فرزند'
                  }}
                </span>
              </div>

              <p class="mt-2 text-sm leading-7 text-x-text-body">
                {{ step.award || "بدون جایزه" }}
              </p>

              <p
                v-if="stepState(step) === 'granted' && step.approvedAward"
                class="mt-1 text-xs text-emerald-600"
              >
                جایزه: {{ step.approvedAward ? 'به فرزند اهدا شد' : '' }}
              </p>

              <!--
                The model's story for this step, in a well of its own below the
                parent's own award text, and behind a toggle. A real story is
                ~1100 characters of Markdown, so open by default it pushed the
                award, the chip and the approve button off the card — a parent
                checking one step had to scroll past the previous step's story
                to do it. The toggle exists per step, so opening one story never
                opens the others, and it is rendered only when the API sent
                something, so no step grows an empty control.

                Rendered through the project's single Markdown renderer — never
                raw — and never truncated: this is a reading surface, not a
                preview.
              -->
              <button
                v-if="step.ai?.result"
                type="button"
                class="neu-control mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-white px-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
                :aria-expanded="isStoryOpen(step.id)"
                :aria-controls="`goal-story-${step.id}`"
                @click="toggleStory(step.id)"
              >
                <span class="flex items-center gap-1.5 text-[11px] font-yekan-bold text-x-parent-600">
                  <UIcon
                    name="solar:stars-minimalistic-linear"
                    size="14"
                    aria-hidden="true"
                  />
                  متن انگیزشی
                </span>
                <UIcon
                  name="solar:alt-arrow-down-linear"
                  size="16"
                  aria-hidden="true"
                  class="shrink-0 text-x-parent-500 transition-transform duration-200 ease-soft motion-reduce:transition-none"
                  :class="isStoryOpen(step.id) ? 'rotate-180' : ''"
                />
              </button>

              <div
                v-if="isStoryOpen(step.id)"
                :id="`goal-story-${step.id}`"
                class="neu-inset mt-2 rounded-2xl bg-white/80 p-3"
              >
                <div
                  class="ai-markdown leading-7"
                  v-html="renderAiMarkdown(step.ai?.result)"
                />
              </div>

              <UButton
                v-if="stepState(step) === 'awaiting-parent'"
                class="mt-3"
                variant="solid"
                color="x-primary"
                label="تأیید و اعطای جایزه"
                :loading="goalAward.state.loading.approve"
                :ui="{ base: 'h-11 w-full justify-center rounded-2xl bg-x-parent-600! hover:bg-x-parent-700! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500' }"
                @click="approve(stepsGoalId!)"
              />
            </div>
          </li>
        </ol>

        <!--
          The explicit end state, wearing the same emerald the granted chips
          already use: every stage was confirmed by the child and granted here,
          the reward included. Until now a finished goal only said so
          implicitly, one «جایزه داده شد» at a time.
        -->
        <p
          v-if="stepsComplete"
          class="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs leading-6 text-emerald-600"
        >
          <UIcon
            name="solar:cup-star-linear"
            size="16"
            aria-hidden="true"
            class="shrink-0"
          />
          <span>همهٔ مراحل انجام و تأیید شده و جایزه‌ها داده شد؛ این هدف به پایان رسید.</span>
        </p>
      </template>
    </UModal>
  </div>
</template>
