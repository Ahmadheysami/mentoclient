<script setup lang="ts">
import {
  GOAL_DOMAINS_META,
  type CreateGoalInput,
  type GoalDocument,
  type GoalDomain,
} from "~/types/goal";
import { faNumber } from "~/utils/fa";
import GoalCard from "./GoalCard.vue";

/**
 * The WHOLE screen of one goal category — list, create sheet, delete
 * confirmation, and the four states a list can be in.
 *
 * It is a component rather than a page body so that the six category pages stay
 * ~12 lines each and hold nothing but their gate and their literal category.
 * Everything they have in common lives here once, which is also why a future
 * seventh category is one file plus one entry in `GOAL_DOMAINS` and no logic.
 *
 * `domain` is typed as `GoalDomain`, so the six pages cannot pass a string that
 * the API's `z.enum` would refuse — including `sprituality`, which is misspelled
 * upstream and must be sent verbatim.
 */
const props = defineProps<{ domain: GoalDomain }>();

const goalStore = useGoal();
const { $toast } = useNuxtApp();

const meta = computed(() => GOAL_DOMAINS_META[props.domain]);

const goals = computed<GoalDocument[]>(() => goalStore.goalsOf(props.domain));

/**
 * The reader's clock, read once on mount and handed to every row.
 *
 * A prop and not a `Date.now()` inside `GoalCard` because two rows rendered on the
 * server and two rendered at hydration could disagree about which side of «یک
 * ساعت» a creation date falls on — a text mismatch Vue reports. `undefined` until
 * mount, so the server render and the client's first paint agree, and each row's
 * absolute date is the half both can render identically.
 */
const now = ref<number>();

/**
 * This category's own two states, read from this category's own slots.
 *
 * Both are keyed by domain in the store, which is what makes them safe to show
 * here: the hub fires all six lists in parallel, so a shared flag would be
 * cleared by another category's answer and a shared sentence would be another
 * category's refusal. See `getGoals`.
 */
const isLoading = computed<boolean>(
  () => goalStore.state.loading.list[props.domain],
);

/** This category's own refusal, or `null`. */
const listError = computed<string | null>(
  () => goalStore.state.error.list[props.domain],
);

const hasError = computed<boolean>(
  () => !isLoading.value && Boolean(listError.value),
);

/**
 * Whether the header may state a count.
 *
 * `!isLoading && !hasError` as well as a non-empty list: while a request is in
 * flight the bucket is empty, and a «۰ هدف» beside the loading list would be a
 * false answer rather than an empty category.
 */
const showCount = computed<boolean>(
  () => !isLoading.value && !hasError.value && goals.value.length > 0,
);

const createOpen = ref(false);
const deleteOpen = ref(false);
/** The goal the confirmation is about. `null` is "no confirmation is open". */
const pendingDelete = ref<GoalDocument | null>(null);

onMounted(() => {
  now.value = Date.now();

  // A warm store already holds this category, and `getGoals` early-returns on it.
  goalStore.getGoals(props.domain);
});

/**
 * Ask the server again — the retry button AND «هدف‌های بیشتر».
 *
 * One function for both because they are the same request: the page the server
 * stopped at. A failed first page is page 0 again (`page` only advances after a
 * successful read), and a finished page is the next one, so `force` is right for
 * either and there is no second code path to keep in step with the first.
 */
async function refetch() {
  await goalStore.getGoals(props.domain, true);
}

async function onCreate(input: CreateGoalInput) {
  const created = await goalStore.createGoal(input);

  if (!created) {
    $toast.error(goalStore.state.error.create ?? "ثبت هدف انجام نشد");
    return;
  }

  createOpen.value = false;
  $toast.success("هدف شما ثبت شد");
}

/**
 * Open the create sheet.
 *
 * A function rather than `@click="createOpen = true"` in the template: an
 * assignment expression evaluates to the assigned value, and `UButton`'s click
 * handler is typed `void`, so the inline form is a type error.
 */
function openCreate() {
  createOpen.value = true;
}

function askDelete(goal: GoalDocument) {
  pendingDelete.value = goal;
  deleteOpen.value = true;
}

async function onDelete() {
  const goal = pendingDelete.value;

  deleteOpen.value = false;

  if (!goal) return;

  const removed = await goalStore.removeGoal(goal.id);

  if (removed) {
    $toast.success("هدف حذف شد");
  } else {
    $toast.error(goalStore.state.error.remove ?? "حذف هدف انجام نشد");
  }

  pendingDelete.value = null;
}
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!-- The category is named by the page's `panelTitle` in the panel header, so
         this line is the action, not a second heading for the same thing. -->
    <div class="flex items-center gap-3">
      <p class="min-w-0 flex-1 text-sm leading-6 text-x-text-subtitle">
        هدف‌های شما در {{ meta.label }}
      </p>

      <!--
        The count, and only once there is one. It reads the same bucket the list
        below renders, so the two cannot be two different numbers — and it is
        hidden while the list is loading, where a `۰ هدف` would be a false answer
        rather than an empty category.
      -->
      <UBadge
        v-if="showCount"
        variant="soft"
        color="neutral"
        :label="`${faNumber(goals.length)} هدف`"
        :ui="{ base: 'shrink-0 rounded-full text-xs font-medium' }"
      />

      <UButton
        label="ثبت هدف"
        icon="solar:add-circle-linear"
        variant="solid"
        color="x-primary"
        :ui="{
          base: 'h-11 rounded-full bg-x-primary-600! hover:bg-x-primary-700!',
        }"
        @click="openCreate"
      />
    </div>

    <div class="mt-4">
      <!-- SKELETON FIRST: this domain's `loading.list` starts `true`, so the
           server render and the client's first paint agree that this list has not
           arrived yet. -->
      <div v-if="isLoading" aria-busy="true">
        <TestListSkeleton
          shape="row"
          :label="`در حال دریافت هدف‌های ${meta.label}`"
        />
      </div>

      <!-- ERROR — this category's own sentence, never another's. -->
      <UiStateMessage
        v-else-if="hasError"
        icon="solar:link-broken-linear"
        :title="listError ?? ''"
        action-label="تلاش دوباره"
        @action="refetch"
      />

      <!-- EMPTY -->
      <UiStateMessage
        v-else-if="goals.length === 0"
        icon="solar:target-linear"
        title="در این دسته هدفی ثبت نکرده‌اید"
        :description="`با ثبت اولین هدف در ${meta.label}، راهنمای هفتگی از همین‌جا شروع می‌شود.`"
        action-label="ثبت هدف جدید"
        @action="openCreate"
      />
      <!-- SUCCESS -->
      <ul v-else class="space-y-3">
        <li
          v-for="(goal, index) in goals"
          :key="goal.id"
          class="reveal"
          :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
        >
          <!--
            The row is ONE component, link and delete together: the card is the
            goal and the delete target is a separate control on it, so there is no
            second element floating under the card. `index` is the row's position in
            this list (newest first) and is what the row numbers itself with — the
            API has no ordinal, and a fabricated one would renumber itself on every
            delete and every extra page.

            `:key` is the goal's uniqid and not the index, so deleting row 2 removes
            that one element and leaves the others' DOM (and therefore their
            entrance animation and focus) untouched. With an index key, every row
            after the deleted one would be re-created and re-animated, which is what
            makes a list visibly jump under the reader's thumb.
            -->
          <NuxtLink :to="`/panels/big/goal/message/${goal.id}`">
            <GoalCard
              :goal="goal"
              :domain="domain"
              :index="index"
              :now="now"
              @delete="askDelete(goal)"
            />
          </NuxtLink>
        </li>

        <!--
          `hasNext` is derived from the server's own `limit + 1` probe, so this
          button is the answer to a question the API actually answered — not a
          guess at whether the list continues.
        -->
        <li v-if="goalStore.state.hasNext[domain]" class="pt-1">
          <UButton
            label="هدف‌های بیشتر"
            icon="solar:arrow-down-linear"
            variant="soft"
            color="x-primary"
            block
            :loading="isLoading"
            :ui="{ base: 'h-11 rounded-full' }"
            @click="refetch"
          />
        </li>
      </ul>
    </div>

    <GoalCreateSheet
      v-model:open="createOpen"
      :domain="domain"
      :submitting="goalStore.state.loading.create"
      :error="goalStore.state.error.create"
      @submit="onCreate"
    />

    <SettingsConfirmModal
      v-model:open="deleteOpen"
      title="این هدف حذف شود؟"
      description="تمام پیام‌های هفتگی این هدف هم با آن حذف می‌شوند و این کار برگشت‌پذیر نیست."
      confirm-label="حذف هدف"
      :loading="goalStore.state.loading.remove"
      @confirm="onDelete"
    />
  </div>
</template>
