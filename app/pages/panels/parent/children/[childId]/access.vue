<script setup lang="ts">
import type { AccessibilityWindow } from "~/types/parent-panel";

/**
 * Two controls over one child's access to the panel: WHEN they may be in it, and
 * the code they enter with.
 *
 * ## THE SCHEDULE READS FROM GET, WRITES THROUGH POST
 *
 * `GET /modules/accessibility?child=<userId>` now returns exactly what
 * `POST /modules/accessibility` stored, so the editor seeds from the server on
 * mount and re-seeds from a fresh GET after every successful save. The POST's
 * own `disabled` field is STILL never rendered: the route writes `user.disabled`
 * and reads `user.disable`, which it never writes, so that value is always
 * `undefined` and calling it «the schedule is off» would be a permanent lie.
 *
 * ## WHY THE CODE IS SHOWN ONCE
 *
 * `state.issuedCode` holds the value for exactly this screen. Leaving forgets it —
 * upstream stores the code hashed and never projects it again, so there is no way
 * back to it and keeping a child's login credential in memory for the rest of the
 * session buys nothing.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "دسترسی",
});

useSeoMeta({ title: "دسترسی فرزند" });

const route = useRoute();
const parentPanel = useParentPanel();
const { $toast } = useNuxtApp();

const childId = computed<string>(() => String(route.params.childId ?? ""));

const detail = computed(() => parentPanel.state.detail[childId.value] ?? null);

/**
 * The real refusal behind an empty screen. A transient failure leaves no
 * `detail[userId]`, and the screen must say what actually happened — with a
 * retry — instead of claiming the child is not found.
 */
const error = computed<string | null>(
  () => parentPanel.state.error.detail[childId.value] ?? null,
);

const name = computed<string>(
  () =>
    detail.value?.profile.fullName?.first ??
    parentPanel.state.children.find((child) => child.userId === childId.value)?.name ??
    "",
);

/**
 * ⚠ THE EXISTENCE OF A CODE, NEVER ITS VALUE.
 *
 * `ChildProfileDto.hasAccessCode` is a boolean and this button is the only thing
 * that may be built from it. The prototype had a `url`, an `expiresInDays` and a
 * `createdAt` here, and none of the three has any backend source — the expiry in
 * particular would be a date this client invented.
 */
const hasAccessCode = computed<boolean>(
  () => detail.value?.profile.hasAccessCode ?? false,
);

/** Only THIS child's reveal — another child's code stays on its own screen. */
const issued = computed(() => {
  const revealed = parentPanel.state.issuedCode;

  return revealed !== null && revealed.childId === childId.value ? revealed : null;
});

const revokeOpen = ref(false);

/**
 * The schedule as the server last confirmed it in THIS session.
 *
 * Seeded on mount from `GET /modules/accessibility` and re-seeded from it after
 * every save — the server's row is the one edited, never the form's own echo.
 */
const savedWindows = ref<AccessibilityWindow[]>([]);
const savedDisable = ref(false);

onMounted(async () => {
  void parentPanel.loadChild(childId.value);

  const stored = await parentPanel.loadAccessibility(childId.value);

  if (stored.ok) {
    savedWindows.value = stored.windows;
    savedDisable.value = stored.disable;
  }
});

onBeforeRouteLeave(() => {
  parentPanel.clearIssuedCode();
});

async function onIssue(): Promise<void> {
  const result = await parentPanel.issueAccessCode(childId.value);

  if (result.ok) $toast.success("کد دسترسی ساخته شد");
}

/**
 * The dialog's own close path — closing is NOT revoking. A statement body, because
 * `@update:open="revokeOpen = $event"` is an arrow returning the assignment's
 * `boolean` where `UModal` declares a `void` handler.
 */
function onDialogUpdate(open: boolean): void {
  if (!open) revokeOpen.value = false;
}

/**
 * Opening the revoke dialog — a statement body for the same reason: an inline
 * `@click="revokeOpen = true"` is an arrow whose value is the assignment's result,
 * and a `boolean` is not a `void` handler.
 */
function onRevokeClick(): void {
  revokeOpen.value = true;
}

async function onRevoke(): Promise<void> {
  revokeOpen.value = false;

  const result = await parentPanel.revokeAccessCode(childId.value);

  if (result.ok) $toast.success("دسترسی لغو شد");
}

async function onSave(input: {
  windows: AccessibilityWindow[];
  disable: boolean;
}): Promise<void> {
  const result = await parentPanel.saveAccessibility(childId.value, input.windows, input.disable);

  // `ERR_CHILD_NOT_FOUND` is the one refusal this screen words for itself: the
  // store has already keyed success on `success` (§IRREGULAR #1), so a failure here
  // is a real failure, and «این فرزند پیدا نشد» names the one cause a parent can
  // act on. Everything else keeps the store's own Persian sentence.
  if (!result.ok) {
    $toast.error(
      parentPanel.state.reason?.accessibility === "ERR_CHILD_NOT_FOUND"
        ? "این فرزند پیدا نشد."
        : result.message,
    );
    return;
  }

  // ⚠ A SUCCESSFUL write carries NO `message` (`controllers.ts:87-92`), so the
  // store returns `""` for one and printing it would say nothing at all. The
  // confirmation sentence is written here for that reason and only that reason.
  // Re-read the canonical row instead of trusting the write's own echo: the
  // GET is the source of truth for what is stored (and it carries `updatedAt`).
  const stored = await parentPanel.loadAccessibility(childId.value);

  if (stored.ok) {
    savedWindows.value = stored.windows;
    savedDisable.value = stored.disable;
  } else {
    savedWindows.value = result.windows;
  }

  $toast.success("زمان‌های دسترسی ذخیره شد.");
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <div v-if="parentPanel.state.loading.detail[childId]" class="grid gap-3" aria-busy="true">
      <USkeleton class="h-24 rounded-3xl bg-white" />
      <USkeleton class="h-64 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="!detail && error"
      icon="solar:link-broken-linear"
      :title="error"
      action-label="تلاش دوباره"
      @action="parentPanel.loadChild(childId, true)"
    />

    <UiStateMessage
      v-else-if="!detail"
      icon="solar:user-block-linear"
      title="این فرزند پیدا نشد"
      description="ممکن است حذف شده باشد یا دسترسی شما به آن تغییر کرده باشد."
      action-label="بازگشت به فرزندان"
      action-to="/panels/parent/children"
    />

    <template v-else>
      <section class="rounded-3xl bg-x-parent-warm-50 p-4">
        <p class="text-xs leading-6 text-x-text-subtitle">
          برای این فرزند کد دسترسی بسازید، و همچنین مشخص کنید چه ساعت‌هایی اجازهٔ ورود دارد.
        </p>
      </section>

      <ParentAccessCodePanel v-if="issued" class="mt-4" :issued="issued" />

      <section
        v-else
        aria-labelledby="parent-code-title"
        class="neu-raised mt-4 rounded-3xl bg-white p-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon name="solar:key-minimalistic-linear" size="20" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 id="parent-code-title" class="text-sm font-yekan-bold text-x-text-title">
              کد دسترسی {{ name }}
            </h2>
            <p class="truncate text-xs text-x-text-subtitle">
              {{ hasAccessCode ? "کدی برای او ساخته شده است" : "هنوز کدی ساخته نشده است" }}
            </p>
          </div>
        </div>

        <p class="mt-3 text-[11px] leading-5 text-x-text-subtitle">
          با ساخت کد جدید، کد قبلی از کار می‌افتد. خود کد فقط یک‌بار و فقط در همین
          صفحه نشان داده می‌شود.
        </p>

        <UButton
          v-if="!hasAccessCode"
          type="button"
          label="ساخت کد دسترسی"
          icon="solar:key-minimalistic-linear"
          variant="solid"
          class="mt-3 h-11 w-full justify-center rounded-full"
          :loading="parentPanel.state.loading.issueCode"
          :disabled="parentPanel.state.loading.issueCode"
          :ui="{ base: 'bg-x-parent-600! text-white! hover:bg-x-parent-700!' }"
          @click="onIssue"
        />

        <UButton
          v-else
          type="button"
          label="ساخت کد تازه"
          icon="solar:refresh-linear"
          variant="soft"
          class="mt-3 h-11 w-full justify-center rounded-full"
          :loading="parentPanel.state.loading.issueCode"
          :disabled="parentPanel.state.loading.issueCode"
          :ui="{ base: 'bg-x-parent-100! text-x-parent-700! hover:bg-x-parent-200!' }"
          @click="onIssue"
        />

        <UButton
          v-if="hasAccessCode"
          type="button"
          label="لغو کد دسترسی"
          icon="solar:shield-cross-linear"
          color="error"
          variant="soft"
          class="mt-3 h-11 w-full justify-center rounded-full"
          :ui="{ base: 'bg-red-50! text-red-500! hover:bg-red-100!' }"
          @click="onRevokeClick"
        />

        <UAlert
          v-if="parentPanel.state.error.issueCode"
          variant="soft"
          color="error"
          title="کد دسترسی ساخته نشد"
          class="mt-3"
        >
          <template #description>{{ parentPanel.state.error.issueCode }}</template>
        </UAlert>
      </section>

      <section aria-labelledby="parent-schedule-title" class="mt-8 rounded-3xl bg-x-parent-warm-50 p-4">
        <h2 id="parent-schedule-title" class="text-sm font-yekan-bold text-x-text-title">
          ساعت‌های دسترسی
        </h2>
        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          اگر بازه‌ای نگذاشته باشید، فرزند شما در همهٔ ساعت‌ها وارد می‌شود. با بستن پنل، حتی داخل این بازه‌ها هم وارد نمی‌شود.
        </p>

        <div class="mt-4">
          <ParentAccessibilityForm
            :windows="savedWindows"
            :disable="savedDisable"
            :submitting="parentPanel.state.loading.accessibility"
            :error="parentPanel.state.error.accessibility"
            @save="onSave"
          />
        </div>
      </section>

      <!--
        The revoke confirmation. It is a real dialog and not a bare second button
        because the consequence is not obvious from the label: `auth` re-checks
        `minorCode == null` on EVERY request, so the child's session dies on their
        very next call, mid-exam, with no warning. `UAlert` is the repo's own
        confirm body (`Settings/ConfirmModal.vue` composes the same two).
      -->
      <UModal
        :open="revokeOpen"
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
            @cancel="revokeOpen = false"
          />

          <UAlert
            v-if="parentPanel.state.error.revokeCode"
            variant="soft"
            color="error"
            title="دسترسی لغو نشد"
            class="mt-3"
          >
            <template #description>{{ parentPanel.state.error.revokeCode }}</template>
          </UAlert>
        </template>
      </UModal>
    </template>
  </div>
</template>
