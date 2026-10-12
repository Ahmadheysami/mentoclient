<script setup lang="ts">
/**
 * The attempt gate: one assigned exam, before the 708-line exam page.
 *
 * - asset unknown ⇒ toast + back («این آزمون برای تو در دسترس نیست.»)
 * - past the deadline ⇒ UAlert soft warning + back («این آزمون دیگر در دسترس نیست.»)
 * - no attempt left (incl. already consumed) ⇒ ParentScopedNote + disabled start
 * - closed schedule ⇒ UiStateMessage «الان بازی با هم آرام است.»
 * - otherwise ⇒ ExamIntro (remaining, the 10-term notice, terms, start)
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "شروع آزمون" });

const childPanel = useChildPanel();
const route = useRoute();
const { $toast } = useNuxtApp();

const assetId = computed(() =>
  typeof route.params.assetId === "string" ? route.params.assetId : "",
);

onMounted(async () => {
  // A hard load of a deep link lands here with an empty store — read the
  // lists first, and only then judge the gate.
  if (childPanel.state.readAt === null) await childPanel.loadTests();

  const unreadable =
    childPanel.state.error.available !== null ||
    childPanel.state.error.consumed !== null;

  if (!unreadable && assetEntry.value === null && childPanel.state.readAt !== null) {
    $toast.error("این آزمون برای تو در دسترس نیست.");
    await navigateTo("/panels/child/tests");
  }
});

const assetEntry = computed(
  () =>
    childPanel.state.available.find((entry) => entry.id === assetId.value) ??
    childPanel.state.consumed.find((entry) => entry.id === assetId.value) ??
    null,
);

const title = computed(() => assetEntry.value?.test?.[0]?.title ?? "آزمون");

const remaining = computed(() => childPanel.remainingFor(assetId.value));

const expired = computed(() => {
  const asset = assetEntry.value;

  if (!asset || typeof asset.expireDate !== "string" || asset.expireDate.length === 0)
    return false;

  const at = childPanel.state.readAt;

  if (at === null) return false;

  const deadline = Date.parse(asset.expireDate);

  return Number.isFinite(deadline) && deadline <= at;
});

const isLoading = computed(
  () => childPanel.state.loading.available || childPanel.state.loading.consumed,
);
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <!-- SectionHeader-style row: the exam owns the start, the way back the end. -->
    <div class="flex items-center justify-between gap-3">
      <h2 class="min-w-0 truncate font-yekan-extra text-lg text-x-text-title">
        {{ title }}
      </h2>
      <NuxtLink
        to="/panels/child/tests"
        class="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-x-text-subtitle focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="childPanel.variant === 'child' ? 'focus-visible:outline-x-kid-berry-700' : 'focus-visible:outline-x-teen-violet-600'"
      >
        <UIcon name="solar:arrow-right-linear" size="16" aria-hidden="true" />
        آزمون‌ها
      </NuxtLink>
    </div>

    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton
        class="h-48 bg-white"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      />
    </div>

    <UiStateMessage
      v-else-if="childPanel.state.sessionEnded === 'outside-window'"
      icon="solar:moon-stars-linear"
      title="الان بازی با هم آرام است."
    />

    <UAlert
      v-else-if="childPanel.state.error.available !== null || childPanel.state.error.consumed !== null"
      class="mt-5"
      variant="soft"
      color="error"
      :title="childPanel.state.error.available ?? childPanel.state.error.consumed ?? ''"
    >
      <template #actions>
        <UButton
          size="sm"
          icon="solar:refresh-linear"
          label="تلاش دوباره"
          variant="outline"
          color="error"
          @click="void childPanel.loadTests(true)"
        />
      </template>
    </UAlert>

    <UAlert
      v-else-if="expired"
      class="mt-5"
      variant="soft"
      color="warning"
      title="این آزمون دیگر در دسترس نیست."
    />

    <div v-else-if="assetEntry" class="mt-5">
      <ChildExamIntro
        :remaining="remaining"
        :asset-id="assetId"
        :disabled="remaining === 0"
        class="mb-4"
      />

      <ChildParentScopedNote v-if="remaining === 0" />
    </div>
  </div>
</template>
