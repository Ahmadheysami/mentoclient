<script setup lang="ts">
import type { CreateChildInput } from "~/stores/parentPanel";

/**
 * Adding a child — and the one screen on which their access code exists.
 *
 * ## WHY THE STAY
 *
 * `POST /child/create` is the only response in this API that returns an access
 * code, and upstream stores it hashed, so this page does NOT navigate away on
 * success: it swaps the form for the reveal and lets the parent copy or share the
 * code before they go. A `navigateTo` here would spend the one copy of it on a
 * route change.
 *
 * ## WHY THE CATALOGUE IS FETCHED HERE TOO
 *
 * Same reason as `children/index.vue`, and it is not optional here: the form is
 * behind the member-limit gate, so a page that did not load the catalogue would
 * let a parent at their limit fill in the whole form and be refused by the server
 * at the last step. `getPlans()` is cached, so this costs one request across the
 * whole panel.
 *
 * ## WHY EACH REFUSAL GETS ITS OWN SENTENCE
 *
 * `ERR_LIMIT_CREATE_USER`, `ERR_PANEL_SUB_EXPIRE` and `ERR_PANEL_NOT_FOUND` are
 * three different problems with three different next moves, and they are read off
 * `state.reason.create` — the machine reason — rather than by matching Persian
 * prose. Everything else falls through to the store's own sentence, shown inline
 * on the form where the fields still are.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "افزودن فرزند",
});

useSeoMeta({ title: "افزودن فرزند" });

const parentPanel = useParentPanel();
const planStore = usePlan();
const { $toast } = useNuxtApp();

/** Set only by a refusal this page recognises; anything else renders inline. */
const refusal = ref<string | null>(null);

/**
 * The overview + the plan catalogue.
 *
 * The overview is not what this form writes, but `canAddChild` compares
 * `membersLimit` with the CURRENT child count — so the gate cannot be answered
 * without both, and a page that rendered the form on an unanswered gate would be
 * offering a write the server is about to refuse.
 */
async function load(): Promise<void> {
  await Promise.all([parentPanel.loadOverview(), planStore.getPlans()]);
}

onMounted(load);

/**
 * The code is worth one screen and no more.
 *
 * It lives in the store, in memory, and this is where that is enforced on the way
 * out: navigating anywhere else forgets it, because upstream will never project it
 * again and keeping a child's login credential in memory for the rest of the
 * session buys nothing.
 */
onBeforeRouteLeave(() => {
  parentPanel.clearIssuedCode();
});

async function onSubmit(input: CreateChildInput): Promise<void> {
  refusal.value = null;

  const result = await parentPanel.createChild(input);

  if (result.ok) return;

  const reason = parentPanel.state.reason?.create ?? null;

  // The three the server refuses a create with, each with the next move that
  // actually works. Client-only by construction: every branch below runs from a
  // click handler, and `plugins/sonner.client` is what provides `$toast` at all.
  if (reason === "ERR_LIMIT_CREATE_USER") {
    $toast.error("ظرفیت پلن شما پر است. برای افزودن فرزند بیشتر پلن را ارتقا دهید.");
    await navigateTo("/panels/parent/children");
    return;
  }

  if (reason === "ERR_PANEL_SUB_EXPIRE") {
    $toast.error("اعتبار پلن شما تمام شده است.");
    return;
  }

  if (reason === "ERR_PANEL_NOT_FOUND") {
    $toast.error("پلن فعالی برای این بخش ندارید.");
    await navigateTo("/plans");
    return;
  }

  // Anything else stays on the form, under the fields that produced it.
  refusal.value = result.message;
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <!--
      The reveal replaces the form rather than sitting above it: after a successful
      create there is nothing left to edit, and a form still on screen next to the
      code would invite a second child to be created by a parent who only meant to
      read the code.
    -->
    <ParentAccessCodePanel
      v-if="parentPanel.state.issuedCode"
      class="mt-2"
      :issued="parentPanel.state.issuedCode"
    />

    <template v-else-if="!parentPanel.canAddChild">
      <ParentMemberLimitNotice :limit="parentPanel.membersLimit" />
    </template>

    <template v-else>
      <p class="text-xs leading-6 text-x-text-subtitle">
        کد دسترسی فرزند شما در همین صفحه ساخته می‌شود و فقط یک‌بار نمایش داده می‌شود.
      </p>

      <!--
        An inline `UAlert` and not `UiStateMessage`: this is one part of a screen
        the parent is still filling in, and `Ui/StateMessage.vue` is `h-[55dvh]`,
        which would push the form off-screen. Repo precedent:
        `components/Settings/SessionPanel.vue:82-93`. It sits ABOVE the form and the
        form stays rendered, so a refusal never unmounts the fields — the parent
        edits and resubmits, and `onSubmit` clears `refusal` the moment a new
        submit starts.
      -->
      <UAlert
        v-if="refusal"
        variant="soft"
        color="error"
        title="فرزند اضافه نشد"
        class="mt-5 rounded-3xl"
      >
        <template #description>{{ refusal }}</template>
      </UAlert>

      <ParentChildForm
        class="mt-5"
        :submitting="parentPanel.state.loading.create"
        @submit="onSubmit"
      />
    </template>
  </div>
</template>
