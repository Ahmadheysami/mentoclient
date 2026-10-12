<script setup lang="ts">
import type { TestAssets } from "~/types/test";

/**
 * Which of the parent's purchased tests one child may take, one labelled switch
 * per row.
 *
 * ## THE ONLY SOURCE OF `subUserIds[]`
 *
 * `GET /test/a/my-tests` — `useTest().state.myTests`. `subUserIds` exists nowhere
 * else in this API: the allocation endpoint is a TOGGLE that answers prose and no
 * state, so the purchases list is the truth and everything else is a correction of
 * it. That is why the store re-runs `getMyTests()` after every toggle, and why this
 * component reads the store rather than a local copy of what it last set.
 *
 * ## WHY THIS IS A SWITCH AND NOT A CHECKBOX
 *
 * A bare checkbox says «tick to acknowledge», and the question on this screen is not
 * acknowledgement — it is «does this child hold this test right now», a state the
 * server already knows. So each row is a real `<button>` carrying `aria-pressed`,
 * drawn as a filled pill when it is on. The recess comes from `.neu-control`'s own
 * `[aria-pressed="true"]` rule, which is keyed off that attribute — so the depth a
 * screen reader announces and the depth the eye sees cannot drift apart.
 *
 * `bg-x-parent-600` when on, not a shadow: a shadow is not a state cue (WCAG
 * 1.4.11), and white on `parent-600` measures 6.29:1.
 *
 * ## WHY THE WRITE LIVES HERE
 *
 * Because this is the only place that knows WHICH child and WHICH asset, and
 * `toggleAssignment` needs both. The page loads the data; the row performs the
 * toggle.
 */
const props = withDefaults(
  defineProps<{
    childId: string;
    /** The child's first name, for the row's own accessible sentence. */
    childName: string;
    loading?: boolean;
    error?: string | null;
  }>(),
  { loading: false, error: null },
);

const emit = defineEmits<{ retry: [] }>();

const test = useTest();
const parentPanel = useParentPanel();
const { $toast } = useNuxtApp();

/**
 * The purchased assets, as rows.
 *
 * `myTests` is `null` while it has never been read and `[]` when there are none,
 * and those are different answers — so `Array.isArray` narrows the shape for the
 * `.filter` without inventing a list.
 */
const assets = computed<TestAssets[]>(() =>
  Array.isArray(test.state.myTests) ? test.state.myTests : [],
);

/** Whether this child holds this asset, per the cached purchases list. */
function isAssigned(assetId: string): boolean {
  const ids = assets.value.find((asset) => asset.id === assetId)?.subUserIds;

  return Array.isArray(ids) ? ids.includes(props.childId) : false;
}

/** The test's own title, or «آزمون» when the projection is missing it. */
function titleOf(asset: TestAssets): string {
  return asset.test?.[0]?.title || "آزمون";
}

/** True while the ONE toggle flag is set — the store has a single write slot. */
const isToggling = computed<boolean>(() => parentPanel.state.loading.assignment);

/**
 * One toggle, and the sentence that says which way it went.
 *
 * On success the response's own `message` is printed verbatim: this endpoint is a
 * TOGGLE that returns HTTP 201 with exactly `{ message }` and NO `success` key, so
 * that prose is the ONLY thing distinguishing «assigned» from «unassigned», and
 * rewriting it into a second wording would erase the one signal there is.
 *
 * On a refusal NOTHING is toasted: the refusal is already Persian and already
 * specific, and the `UAlert` below the rows is where the reader's eye is, because
 * their finger was on a row that did not move. A toast would say it once and leave
 * a second, permanent copy behind.
 */
async function onToggle(assetId: string): Promise<void> {
  const result = await parentPanel.toggleAssignment(props.childId, assetId);

  if (result.ok) $toast.success(result.message);
}
</script>

<template>
  <div>
    <div v-if="loading" class="grid gap-3" aria-busy="true">
      <USkeleton v-for="row in 2" :key="row" class="h-20 rounded-3xl bg-white" />
    </div>

    <UAlert v-else-if="error" variant="soft" color="error" title="آزمون‌ها خوانده نشد">
      <template #description>{{ error }}</template>
      <template #actions>
        <UButton
          type="button"
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="emit('retry')"
        />
      </template>
    </UAlert>

    <UiStateMessage
      v-else-if="assets.length === 0"
      icon="solar:clipboard-list-linear"
      title="هنوز آزمونی خریداری نکرده‌اید"
      description="آزمونی که در بخش آزمون‌ها فعال کنید، از همین‌جا به فرزندتان می‌دهید."
      action-label="رفتن به آزمون‌ها"
      action-to="/test"
    />

    <ul v-else class="grid gap-3">
      <li
        v-for="asset in assets"
        :key="asset.id"
        class="neu-raised rounded-3xl bg-white p-3"
        :aria-busy="isToggling"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="asset.test?.[0]?.image"
            :src="asset.test[0].image"
            :alt="titleOf(asset)"
            loading="lazy"
            class="size-12 shrink-0 rounded-2xl bg-x-parent-50 object-cover"
            width="48"
            height="48"
          >
          <span
            v-else
            class="grid size-12 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon name="solar:clipboard-list-linear" size="22" />
          </span>

          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-yekan-bold text-x-text-title">
              {{ titleOf(asset) }}
            </h3>
            <p class="truncate text-xs text-x-text-subtitle">
              {{ isAssigned(asset.id) ? "برای فرزند شما فعال است" : "به فرزند شما داده نشده" }}
            </p>
          </div>

          <!--
            The one control on the row. `type="button"` so it can never submit a
            surrounding form, and the accessible name spells out BOTH what the
            control does and which child it is about — «داده شده» alone, on a
            screen listing several children, names nothing.
          -->
          <button
            type="button"
            class="neu-control h-11 shrink-0 rounded-full px-4 text-xs font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
            :class="
              isAssigned(asset.id)
                ? 'bg-x-parent-600 text-white'
                : 'bg-white text-x-text-subtitle'
            "
            :aria-pressed="isAssigned(asset.id)"
            :aria-label="
              isAssigned(asset.id)
                ? `برداشتن آزمون ${titleOf(asset)} از ${childName}`
                : `دادن آزمون ${titleOf(asset)} به ${childName}`
            "
            @click="onToggle(asset.id)"
          >
            {{ isAssigned(asset.id) ? "فعال شده" : "فعال سازی" }}
          </button>
        </div>
      </li>
    </ul>

    <!--
      The refusal, on the screen the write happened on. The rows stay visible above
      it, because a refused toggle leaves them exactly as they were and hiding them
      would make one bad press look like the whole list is gone.
    -->
    <UAlert
      v-if="parentPanel.state.error.assignment"
      variant="soft"
      color="error"
      title="این آزمون تغییر نکرد"
      class="mt-3"
    >
      <template #description>{{ parentPanel.state.error.assignment }}</template>
    </UAlert>
  </div>
</template>
