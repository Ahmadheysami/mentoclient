<script setup lang="ts">
/**
 * Which of the tests this parent bought, this child may take.
 *
 * ## WHY BOTH READS RUN HERE
 *
 * `loadChild` gives the name the rows are phrased around and confirms the child
 * exists at all; `getMyTests` is the ONLY source of `subUserIds[]`, which is the
 * toggle's on/off state. They are independent requests, so they run together.
 *
 * The toggle itself lives in `Parent/ChildTestsPanel.vue`, because that is the one
 * place that knows both which child and which asset — this page only loads.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "آزمون‌های فرزند",
});

useSeoMeta({ title: "آزمون‌های فرزند" });

const route = useRoute();
const parentPanel = useParentPanel();
const testStore = useTest();

const childId = computed<string>(() => String(route.params.childId ?? ""));

const name = computed<string>(
  () =>
    parentPanel.state.detail[childId.value]?.profile.fullName?.first ??
    parentPanel.state.children.find((child) => child.userId === childId.value)?.name ??
    "",
);

onMounted(async () => {
  await Promise.all([parentPanel.loadChild(childId.value), testStore.getMyTests()]);
});
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <p class="text-xs leading-6 text-x-text-subtitle">
      هر آزمونی که به فرزندتان بدهید، در پنل خودش او می‌بیند و از حساب شما کم می‌شود.
    </p>

    <div class="mt-5">
      <ParentChildTestsPanel
        :child-id="childId"
        :child-name="name"
        :loading="testStore.state.loading.getMyTests"
        :error="testStore.state.error"
        @retry="testStore.getMyTests()"
      />
    </div>
  </div>
</template>
