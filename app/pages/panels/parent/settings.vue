<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * The parent panel's own settings — and, before this pass, four rows that were
 * `<button>`s with NO handler at all.
 *
 * ## WHY EVERY ROW IS NOW A REAL DESTINATION
 *
 * A settings list is a set of claims about what this app can do for you. A row
 * that leads nowhere is a claim the app cannot keep, and this is the screen a
 * parent opens precisely to check that their account is under their own control —
 * so the dead affordance here is worse than it would be on a feature page.
 *
 * - «نمایه» → `/me`, the profile form, which is where `panel-plan` already sends a
 *   parent with an incomplete one.
 * - «اعلان‌ها» → `/notifications`.
 * - «حریم خصوصی» → the access screen of the FIRST child, which is where the
 *   schedule and the code live. A family with no child has nothing private to
 *   configure, so that row is disabled with its reason in words rather than
 *   pointing at a child id that does not exist.
 * - «خروج» → the same two steps `Settings/Preferences.vue` performs: drop the
 *   `access-token` cookie, then leave with `{ external: true }` — because a
 *   client-side navigation would land on `/auth` still holding the render the
 *   cookie just authorised.
 * - «دستیار هوش مصنوعی» → the panel's own chat, which is also on the home tray.
 *   It is here rather than in the bottom nav because `grid-cols-5` is that strip's
 *   measured rhythm and a sixth item wraps.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "تنظیمات",
});

useSeoMeta({ title: "تنظیمات پنل والدین" });

const parentPanel = useParentPanel();
const auth = useAuth();
const { $toast } = useNuxtApp();

const signOutOpen = ref(false);

onMounted(() => {
  void parentPanel.loadOverview();
});

/**
 * The heading.
 *
 * `familyName` had no backend source and is gone; what replaces it is the one
 * figure this screen can state — how many children the panel is governing — and it
 * is omitted rather than printed as `۰` while `/child/stats` is still on the wire.
 */
const heading = computed<string>(() => {
  const total = parentPanel.state.stats?.totalChildren;

  if (typeof total !== "number") return "پنل والدین";

  return `پنل والدین · ${faNumber(total)} فرزند`;
});

/**
 * «حریم خصوصی» needs a child id to be meaningful.
 *
 * `null` when the family has none — and a row with no destination is exactly the
 * dead affordance this page exists to remove, so the row is rendered `disabled`
 * with the reason beside it instead.
 */
const privacyTo = computed<string | null>(() => {
  const first = parentPanel.state.children[0];

  return first === undefined ? null : `/panels/parent/children/${first.userId}/access`;
});

interface SettingsRow {
  icon: string;
  title: string;
  description: string;
  /** `null` ⇒ the row has no destination and says why instead. */
  to: string | null;
  /** Removes something, so the row is coloured as an action and confirmed. */
  signOut?: boolean;
}

const rows = computed<SettingsRow[]>(() => [
  {
    icon: "solar:user-circle-linear",
    title: "نمایه",
    description: "نام و تصویر حساب شما",
    to: "/me",
  },
  {
    icon: "solar:bell-linear",
    title: "اعلان‌ها",
    description: "اعلان‌های حساب شما",
    to: "/notifications",
  },
  {
    icon: "solar:shield-check-linear",
    title: "حریم خصوصی",
    description:
      privacyTo.value === null
        ? "پس از افزودن فرزند، ساعت‌های ورود و کد دسترسی اینجا تنظیم می‌شود"
        : "ساعت‌های ورود و کد دسترسی فرزند",
    to: privacyTo.value,
  },
  {
    icon: "solar:chat-round-linear",
    title: "دستیار هوش مصنوعی",
    description: "گفتگو با دستیار منتویا",
    to: "/panels/parent/assistant",
  },
  {
    icon: "solar:logout-2-linear",
    title: "خروج",
    description: "خروج از حساب والد",
    to: null,
    signOut: true,
  },
]);

/**
 * Sign out.
 *
 * Closed before the request, so a refusal leaves the parent on a usable screen
 * rather than behind a modal whose button is spinning — the reasoning
 * `Settings/Preferences.vue:97-98` already documents.
 */
/** The dialog's own close path — statement-bodied, for the reason above. */
function onDialogUpdate(open: boolean): void {
  signOutOpen.value = open;
}

async function signOut(): Promise<void> {
  signOutOpen.value = false;

  try {
    await auth.removeCookie("access-token");
  } catch {
    $toast.error("خروج از حساب انجام نشد. اتصال اینترنت را بررسی کنید.");
    return;
  }

  await navigateTo("/auth", { external: true });
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <h2 class="font-yekan-extra text-lg text-x-text-title">{{ heading }}</h2>

    <!--
      One raised card with hairline dividers, rather than five raised rows: a
      settings list is a single object you move through, and stacking soft shadows
      on adjacent rows makes the whole column look like it is drifting.
    -->
    <ul class="neu-raised mt-4 divide-y divide-x-parent-100 rounded-3xl bg-white">
      <li v-for="row in rows" :key="row.title">
        <NuxtLink
          v-if="row.to !== null"
          :to="row.to"
          class="flex min-h-16 items-center gap-3 p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
        >
          <UIcon :name="row.icon" size="22" class="shrink-0 text-x-parent-500" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-yekan-bold text-sm text-x-text-title">{{ row.title }}</span>
            <span class="block text-xs text-x-text-subtitle">{{ row.description }}</span>
          </span>
          <UIcon
            name="solar:alt-arrow-left-linear"
            size="16"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>

        <button
          v-else-if="row.signOut"
          type="button"
          class="flex min-h-16 w-full items-center gap-3 p-4 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
          @click="signOutOpen = true"
        >
          <UIcon :name="row.icon" size="22" class="shrink-0 text-red-500" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-yekan-bold text-sm text-red-500">{{ row.title }}</span>
            <span class="block text-xs text-x-text-subtitle">{{ row.description }}</span>
          </span>
          <UIcon
            name="solar:alt-arrow-left-linear"
            size="16"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </button>

        <!--
          The row that CANNOT lead anywhere, and says so. `aria-disabled` as well as
          `disabled` so a screen-reader user hears that the control exists and is
          refused, rather than finding it silently missing.
        -->
        <div
          v-else
          class="flex min-h-16 items-center gap-3 p-4"
          aria-disabled="true"
        >
          <UIcon :name="row.icon" size="22" class="shrink-0 text-x-text-muted" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block font-yekan-bold text-sm text-x-text-muted">{{ row.title }}</span>
            <span class="block text-xs leading-5 text-x-text-subtitle">{{ row.description }}</span>
          </span>
        </div>
      </li>
    </ul>

    <UModal
      :open="signOutOpen"
      title="خروج از حساب؟"
      :ui="{ content: 'w-96 max-md:w-85 rounded-3xl shadow-none' }"
      @update:open="onDialogUpdate"
    >
      <template #body>
        <UiAlert
          title="خروج از حساب؟"
          description="از این مرورگر خارج می‌شوید و برای ورود دوباره به کد تأیید نیاز دارید."
          type="warning"
          @accept="signOut"
          @cancel="signOutOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
