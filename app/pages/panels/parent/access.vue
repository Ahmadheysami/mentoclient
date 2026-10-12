<script setup lang="ts">
/**
 * Every child's access code, in one list: one row per child, and the one control
 * that row's `hasAccessCode` decides.
 *
 * ## WHY THIS IS A LIST OF CHILDREN AND NOT A LIST OF LINKS
 *
 * The prototype had `ParentAccessLink` rows carrying a `url`, a `code`,
 * an `expiresInDays`, a `createdAt` and an `active` flag. **Four of those five have
 * no backend source at all.** Upstream stores the code hashed and projects only
 * `hasAccessCode: boolean` afterwards, so there is no URL to hand out, no expiry to
 * quote and no creation date to print — and an expiry in particular would be a date
 * this client invented. What is real is the child, whether a code exists for them,
 * and — for the moment right after a write — the code itself.
 *
 * So a row is a child plus a boolean plus one button, and the code appears only in
 * the tray at the top of the screen for the child it was just issued for.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "دسترسی",
});

useSeoMeta({ title: "دسترسی فرزندان" });

const parentPanel = useParentPanel();
const { $toast } = useNuxtApp();

const isLoading = computed<boolean>(
  () => parentPanel.state.loading.children || parentPanel.state.loading.stats,
);

const hasError = computed<boolean>(
  () => !isLoading.value && parentPanel.state.error.children !== null,
);

/** The child whose row is waiting for a revoke confirmation, or `null`. */
const revoking = ref<string | null>(null);

onMounted(() => {
  void parentPanel.loadOverview();
});

/**
 * The code is worth one screen and no more.
 *
 * It lives in the store, in memory, and this is where that is enforced on the way
 * out: upstream will never project it again, and keeping a child's login credential
 * in memory for the rest of the session buys nothing.
 */
onBeforeRouteLeave(() => {
  parentPanel.clearIssuedCode();
});

async function onIssue(childId: string): Promise<void> {
  const result = await parentPanel.issueAccessCode(childId);

  if (result.ok) $toast.success("کد دسترسی ساخته شد");
}

/**
 * The confirmed revoke.
 *
 * The dialog closes BEFORE the request, so a refused revoke leaves the parent on a
 * usable screen with the dialog gone rather than with a spinner over a page they
 * may want to leave — the same reasoning `Settings/Preferences.vue` documents for
 * its sign-out.
 */
/**
 * The dialog's own close path — closing is NOT revoking.
 *
 * A separate handler rather than `@update:open="revoking = null"`, because that
 * inline assignment is an arrow whose value is the assignment's result: a `string`
 * where `UModal` declares a `void` handler. Making it a statement-bodied function
 * also gives the one place that can forget the distinction a name.
 */
function onDialogUpdate(open: boolean): void {
  if (!open) revoking.value = null;
}

/**
 * Opening the revoke dialog for one row — a statement body for the same reason as
 * `onDialogUpdate`: `@click="revoking = child.userId"` is an inline arrow whose
 * value is the assignment's result, and a `string` is not a `void` handler.
 */
function onRevokeClick(childId: string): void {
  revoking.value = childId;
}

async function onRevoke(): Promise<void> {
  const childId = revoking.value;

  revoking.value = null;

  if (childId === null) return;

  const result = await parentPanel.revokeAccessCode(childId);

  if (result.ok) $toast.success("دسترسی لغو شد");
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <p class="text-xs leading-6 text-x-text-subtitle">
      هر فرزند با کد دسترسی خودش وارد می‌شود؛ بدون ثبت‌نام، بدون رمز عبور. کد فقط یک‌بار
      و فقط همین‌جا نشان داده می‌شود.
    </p>

    <div v-if="isLoading" class="mt-4 grid gap-3" aria-busy="true">
      <USkeleton v-for="row in 2" :key="row" class="h-24 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="parentPanel.state.error.children ?? ''"
      action-label="تلاش دوباره"
      @action="parentPanel.loadOverview(true)"
    />

    <UiStateMessage
      v-else-if="parentPanel.state.children.length === 0"
      icon="solar:users-group-rounded-linear"
      title="هنوز فرزندی اضافه نشده"
      description="اول فرزندتان را بسازید؛ کد دسترسی او همان‌جا ساخته می‌شود."
      action-label="افزودن فرزند"
      action-to="/panels/parent/children/new"
    />

    <template v-else>
      <ParentAccessCodePanel
        v-if="parentPanel.state.issuedCode"
        class="mt-4"
        :issued="parentPanel.state.issuedCode"
      />

      <ul class="mt-4 grid gap-3">
        <li
          v-for="child in parentPanel.state.children"
          :key="child.userId"
          class="neu-raised rounded-3xl bg-white p-4"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
              aria-hidden="true"
            >
              <UIcon name="solar:key-minimalistic-linear" size="20" />
            </span>

            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-yekan-bold text-x-text-title">
                {{ child.name }}
              </h3>
              <p class="truncate text-xs text-x-text-subtitle">
                {{ child.hasAccessCode ? "کد دسترسی فعال" : "هنوز کدی ساخته نشده است" }}
              </p>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <UButton
              type="button"
              :label="child.hasAccessCode ? 'ساخت کد تازه' : 'ساخت کد دسترسی'"
              icon="solar:key-minimalistic-linear"
              variant="soft"
              class="h-11 flex-1 justify-center rounded-full"
              :loading="parentPanel.state.loading.issueCode"
              :disabled="parentPanel.state.loading.issueCode"
              :ui="{
                base: child.hasAccessCode
                  ? 'bg-x-parent-100! text-x-parent-700! hover:bg-x-parent-200!'
                  : 'bg-x-parent-600! text-white! hover:bg-x-parent-700!',
              }"
              @click="onIssue(child.userId)"
            />

            <!--
              Only offered where a code exists: a revoke with nothing to revoke is
              a control that does nothing, and this row already says «هنوز کدی
              ساخته نشده است».
            -->
            <UButton
              v-if="child.hasAccessCode"
              type="button"
              icon="solar:shield-cross-linear"
              color="error"
              variant="soft"
              aria-label="لغو کد دسترسی"
              class="size-11 shrink-0 rounded-full"
              :ui="{ base: 'size-11 min-h-11 rounded-full' }"
              @click="onRevokeClick(child.userId)"
            />
          </div>
        </li>
      </ul>

      <UAlert
        v-if="parentPanel.state.error.issueCode || parentPanel.state.error.revokeCode"
        variant="soft"
        color="error"
        title="تغییر کد دسترسی انجام نشد"
        class="mt-4"
      >
        <template #description>
          {{ parentPanel.state.error.issueCode ?? parentPanel.state.error.revokeCode }}
        </template>
      </UAlert>

      <!--
        One dialog for the whole list rather than one per row: `revoking` holds the
        child, so the dialog is opened once and names whoever is in it. `UAlert` is
        the repo's own confirm body — `Settings/ConfirmModal.vue` composes the same
        two buttons — and the consequence needs spelling out, because `auth`
        re-checks `minorCode == null` on EVERY request and a child's session dies on
        their very next call, mid-exam, with no warning.
      -->
      <UModal
        :open="revoking !== null"
        title="لغو کد دسترسی"
        :ui="{ content: 'w-96 max-md:w-85 rounded-3xl shadow-none' }"
        @update:open="onDialogUpdate"
      >
        <template #body>
          <UiAlert
            title="لغو کد دسترسی"
            description="با لغو کد، فرزند شما از پنل خارج می‌شود و باید کد جدید بگیرد."
            type="warning"
            :loading="parentPanel.state.loading.revokeCode"
            @accept="onRevoke"
            @cancel="revoking = null"
          />
        </template>
      </UModal>
    </template>
  </div>
</template>
