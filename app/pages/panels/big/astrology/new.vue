<script setup lang="ts">
import { usePreferredReducedMotion } from "@vueuse/core";
import { type AstrologyFormInput } from "~/types/astrology";

/**
 * The activation page: the form, a confirmation the reader cannot skip, and what
 * happens while the one irreversible call is running.
 *
 * ## WHY THERE IS A CONFIRMATION AT ALL
 *
 * The birth data is stored **verbatim** upstream and a second activation is
 * refused with `ERR_MODULE_ASTROLOGT_ONCE`. There is no edit, no delete and no
 * "start over": a typo in the year is a chart computed from the wrong birth for
 * as long as the account lives. So the confirmation is not a courtesy — it is
 * the only place the reader is told that, and `confirmActivate` below is the
 * only path to the network call.
 *
 * The gate is structural: `AstrologyForm` emits `submit`, this page stores the
 * payload and OPENS the dialog, and nothing else. `astrology.activate()` is
 * reachable from `confirmActivate` alone, so no reordering of this template can
 * send an unconfirmed birth date.
 *
 * ## `Settings/ConfirmModal` — GENERIC DESPITE THE FOLDER NAME
 *
 * Its props are `{ open, title, description?, confirmLabel, loading? }` and its
 * emits are `update:open` and `confirm` — nothing about sessions, preferences or
 * sign-out. It is `Ui/Alert.vue` inside a `UModal`, and `Plan/BuyModal.vue`
 * reuses it the same way. So it is the right component here, and the copy below
 * is what the `description` slot is for.
 *
 * ## THE FEEDBACK AROUND ONE REQUEST
 *
 * Four states, in this order, and each is decided before the request resolves:
 *
 * 1. **The frame the reader confirms.** `handingOver` flips `true` before the
 *    first `await`, so `AstrologyActivating` is already on screen while the
 *    request is still being created — the reader never sees an unchanged page.
 *    The confirmation stays open with its own spinner, and its copy changes to
 *    «در حال فعال‌سازی…», so the thing under their thumb says so too.
 * 2. **The request.** `showProgress` is `loading.start || handingOver`, so the
 *    panel owns the screen for the whole of it. The form is kept mounted behind
 *    it (`v-show`), **not** swapped out — a refusal must bring back the birth
 *    data the reader typed, and destroying the component would destroy it.
 * 3. **The answer.** Success → toast, then the hub, which renders the report.
 *    `ERR_TOKEN_BALANCE` → a toast with «شارژ سکه». Anything else → the store's
 *    Persian sentence, inline above the button that retries it, on the form the
 *    reader is returned to with their input intact.
 * 4. **The verification.** After a success the saved-reports list is read once
 *    (`astrology.getResults()`), which is the only answer the app can get about
 *    "is it really initialised?" — it answers 200, so the hub it navigates to
 *    opens on that entry, and a read that somehow fails lands on the hub's
 *    retryable error rather than on the birth form (see that function's note on
 *    why `"failed"` may never be laundered into `[]`).
 *
 * A second activation is impossible while one is in flight: `confirmActivate`
 * refuses on `pending` and on `loading.start`, the form's own submit refuses on
 * `submitting`, and `astrology.activate()` itself holds a lock that makes the
 * duplicate request unrepresentable (see `stores/astrology.ts`).
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "فعال‌سازی طالع‌بینی",
});

useSeoMeta({
  title: "فعال‌سازی طالع‌بینی",
});

const astrology = useAstrology();
const { $toast } = useNuxtApp();

/**
 * The validated payload, held while the dialog is open.
 *
 * Component-local and on purpose: it is the reader's own birth data, it is only
 * needed between "form submitted" and "confirmed", and nothing about it is worth
 * keeping once the server has answered. It is dropped in `confirmActivate` and
 * on cancel.
 */
const pending = ref<AstrologyFormInput | null>(null);

const confirmOpen = ref(false);

/**
 * True from the frame the reader confirms until the screen that shows the answer
 * has taken over — the hub, or the form with its refusal.
 *
 * This is the "immediate feedback" half, and it is local to the page because it
 * is a fact about THIS interaction, not about the account: the store's
 * `loading.start` only goes `true` a few lines later, and on a refusal it is
 * already `false` again by the time the reader is looking for the confirmation.
 * Derived into `showProgress` below rather than read directly, so there is one
 * answer to "is the activation happening?" and it is a computed one.
 */
const handingOver = ref(false);

/**
 * Whether the progress panel owns the screen. `handingOver` alone is not enough
 * (it is cleared on a failure) and `loading.start` alone is not enough either (it
 * is cleared the instant the request answers, which would swap the panel for the
 * form and back again in one frame — the flash this exists to prevent).
 */
const showProgress = computed<boolean>(
  () => astrology.state.loading.start || handingOver.value,
);

/**
 * The form's own box, for one reason: putting it back on screen.
 *
 * The panel is short, so when it takes the form's place the page shrinks under
 * the reader and the scroller is clamped to the top — and the form's refusal is
 * rendered *below* its fold, right above the retry button. Without bringing them
 * back to it, the clearest sentence on the screen would be one scroll away from
 * the reader who just caused it.
 */
const formWrap = useTemplateRef<HTMLDivElement>("formWrap");

/** A jump the reader did not ask for must not be animated either. */
const reducedMotion = usePreferredReducedMotion();

/**
 * How long the progress panel is held once the answer is in, so a fast answer
 * cannot make it flash.
 *
 * A refusal that answers in 200ms would otherwise paint the panel and un-paint it
 * before the eye has settled on it, which reads as a glitch rather than as
 * feedback. 900ms is the usual floor for "I acknowledge you" and costs nothing on
 * a success, where the wait has already been seconds.
 */
const FEEDBACK_FLOOR_MS = 900;

/**
 * The city list, loaded once on mount and warm-cached in the store (24h
 * upstream, the proxy caches it too). `onMounted`, not `setup()`: the same rule
 * `AppCoinPill` follows — the cookie-backed request belongs to the store, and a
 * bare `$fetch` during SSR would arrive without the reader's cookie.
 *
 * No `force`: a failed load leaves `state.cities` empty, and the form falls back
 * to typed coordinates — which the retry button on the alert inside the form
 * covers without this page having to own a retry of its own.
 */
onMounted(async () => {
  await astrology.getCities();
});

/** Open the dialog. **No request is fired here.** */
function onSubmit(payload: AstrologyFormInput): void {
  if (astrology.state.loading.start) return;

  pending.value = payload;
  confirmOpen.value = true;
}

/** The dialog's own cancel, from either its close icon or «انصراف». */
function onCancel(): void {
  confirmOpen.value = false;
  pending.value = null;
}

/**
 * `update:open` → `confirmOpen`. Split out from the inline arrow in the template
 * so the "closed" case lands on `onCancel` and the payload is dropped with it,
 * rather than only closing the dialog and leaving a validated birth date in
 * memory behind a modal that is no longer on screen.
 *
 * Nothing here is blocked while the activation runs. The dialog CAN be dismissed
 * mid-flight — and the reader must be able to, because the call cannot be
 * cancelled server-side and trapping them behind it would be worse than letting
 * them look at the page. `AstrologyActivating` is what they see on the page then:
 * the feedback does not depend on the dialog staying open.
 */
function onUpdateOpen(value: boolean): void {
  if (value) {
    confirmOpen.value = true;
    return;
  }

  onCancel();
}

/**
 * Hold the panel for `FEEDBACK_FLOOR_MS` counted from `startedAt`.
 *
 * `Date.now()` in a click handler is client-only, and this function is only ever
 * reached from one — so the clock here cannot disagree with a server render.
 */
async function holdFeedback(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;

  if (elapsed < FEEDBACK_FLOOR_MS) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, FEEDBACK_FLOOR_MS - elapsed);
    });
  }
}

/**
 * The ONLY place `activate()` is called, and the only place the answer is turned
 * into something a reader sees.
 *
 * The payload is dropped **first**, before the request. It is the first of the
 * two guards that make a second activation unrepresentable (the store's lock is
 * the third): the second press of «تایید» finds nothing to send, and even if it
 * found something, `activate()` would join the request already in flight rather
 * than create a second one.
 *
 * The three outcomes:
 * - **success** → the report is in memory; verify the initialization once, then
 *   go to the hub, which renders the report.
 * - **`ERR_MODULE_ASTROLOGT_ONCE`** → treated as the success it is. The store has
 *   set `status` to `"started"`, and the hub says «قبلاً فعال شده» rather than
 *   showing a report this call did not produce.
 * - **`ERR_TOKEN_BALANCE`** → the wallet cannot pay. The backend's own Persian
 *   message, with an action to `/wallet`, and the reader is left on the form with
 *   their data intact rather than navigated away from it.
 *
 * Everything else (including an untranslated 5xx) is already a written Persian
 * sentence in `state.error.start`, rendered inline by the form — which is also why
 * no toast is fired for it: the form's own alert, right above the button, is a
 * better place for a sentence the reader may need to read twice.
 */
async function confirmActivate(): Promise<void> {
  const payload = pending.value;

  if (!payload || astrology.state.loading.start) return;

  pending.value = null;

  // Before the request, not after it: this is the frame the panel has to appear
  // on, and everything after this line is awaited.
  handingOver.value = true;
  const startedAt = Date.now();

  const response = await astrology.activate(payload);

  if (response.success || response.reason === "ERR_MODULE_ASTROLOGT_ONCE") {
    confirmOpen.value = false;

    $toast.success(
      response.reason === "ERR_MODULE_ASTROLOGT_ONCE"
        ? "طالع‌بینی شما قبلاً فعال شده است."
        : (response.message ?? "طالع‌بینی با موفقیت فعال شد."),
    );

    await holdFeedback(startedAt);

    /**
     * The confirmation read, fired ONCE and only here — never on mount, never per
     * render. It is `await`ed so the hub's first paint happens after the answer
     * (a refused read answers at once, so this costs nothing on a fast server) and
     * its result is deliberately not inspected: the activation has already
     * succeeded, this read is what turns it into a list entry the hub can render,
     * and every outcome of it lands in `state.results` / `error.results` for the
     * hub to render in its own words.
     */
    await astrology.getResults();

    await navigateTo("/panels/big/astrology");
    return;
  }

  confirmOpen.value = false;

  if (response.reason === "ERR_TOKEN_BALANCE") {
    $toast.error(astrology.state.error.start ?? "موجودی سکه کافی نیست.", {
      action: {
        label: "شارژ سکه",
        onClick: () => {
          void navigateTo("/wallet");
        },
      },
    });
  }

  await holdFeedback(startedAt);

  // The panel gives way to the form, which is still mounted with the reader's
  // input and now carries `state.error.start` above its button.
  handingOver.value = false;

  await nextTick();

  formWrap.value?.scrollIntoView({
    behavior: reducedMotion.value === "reduce" ? "auto" : "smooth",
    block: "end",
  });
}
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      The heading and its sentence enter together, on ONE animation, as the panel's
      own greeting does. `reveal` on each of them separately would be two entrances
      racing the same six pixels, and on the heading alone it would leave the
      sentence sitting still while the title above it was still fading in.

      They stay OUTSIDE the swap below, deliberately: the sentence tells the reader
      their data is permanent, and it has to be the thing still on screen beside
      `AstrologyActivating` while the irreversible call is running.
    -->
    <div class="reveal">
      <h2 class="font-yekan-bold text-x-text-title">اطلاعات تولد</h2>

      <p class="mt-2 mb-5 text-sm leading-7 text-x-text-subtitle">
        این اطلاعات پایهٔ محاسبهٔ نقشهٔ تولد شماست و پس از فعال‌سازی دیگر قابل
        تغییر نیست.
      </p>
    </div>

    <!--
      The progress panel takes the form's place for the whole of the request. It
      is rendered here — not inside the dialog — because the reader may dismiss
      the dialog, and an irreversible call in flight must never be something only
      a dismissable modal is telling them about.
    -->
    <AstrologyActivating v-if="showProgress" />

    <!--
      `v-show`, not `v-if`: the form holds the reader's draft as local refs, so
      unmounting it on the way into the request would wipe a birth date they may
      have to correct after a refusal — the exact moment they most need it back.
      `v-show` keeps the component (and the draft) alive and out of the layout, so
      nothing below the panel can shift.
    -->
    <div v-show="!showProgress" ref="formWrap">
      <AstrologyForm
        :cities="astrology.state.cities"
        :cities-loading="astrology.state.loading.cities"
        :cities-error="astrology.state.error.cities"
        :submitting="astrology.state.loading.start"
        :error="astrology.state.error.start"
        @submit="onSubmit"
      />
    </div>

    <!--
      The confirmation, and the last point at which the reader can stop.
      `:loading` is bound to the in-flight call so «تایید» carries a spinner and
      cannot be pressed twice while the report is being generated, and the copy
      changes with it: a dialog that still asked for a permanent decision while
      the decision was already being carried out would be asking twice.
    -->
    <SettingsConfirmModal
      :open="confirmOpen"
      :title="
        showProgress ? 'در حال فعال‌سازی طالع‌بینی' : 'فعال‌سازی طالع‌بینی'
      "
      :description="
        showProgress
          ? 'فرایند فعال‌سازی آغاز شد. ساخت نقشهٔ تولد و نوشتن گزارش چند لحظه طول می‌کشد؛ لطفاً تا پایان آن در همین صفحه بمانید.'
          : 'اطلاعات تولد شما برای همیشه ذخیره می‌شود و پس از فعال‌سازی هیچ امکانی برای تغییر، ویرایش یا حذف آن وجود ندارد. اگر در وارد کردن اطلاعات مطمئن نیستید، پیش از تایید آن را بازبینی کنید.'
      "
      confirm-label="مطمئنم، فعال‌سازی کن"
      :loading="astrology.state.loading.start"
      @update:open="onUpdateOpen"
      @confirm="confirmActivate"
    />
  </div>
</template>
