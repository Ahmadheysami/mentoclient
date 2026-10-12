<script setup lang="ts">
/**
 * The 11-digit code form — the only door into the child panel.
 *
 * `type="text"` + `inputmode="numeric"`, NOT `type="number"`: the latter
 * drops a leading digit and its numeric value can exceed safe-integer
 * precision. `dir="ltr"` because the digits read left-to-right even on an
 * RTL page. The code is always 11 digits, always starting with 1.
 *
 * Two refusals get two different sentences, and the throttle gets a further
 * one: the form locks for a minute. A wrong code never ends a session and
 * never clears the field — the child only has to look again at the piece of
 * paper in their hand.
 */
const childPanel = useChildPanel();

const code = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);
const throttled = ref(false);

let throttleTimer: ReturnType<typeof setTimeout> | undefined;

function resetThrottleTimer(): void {
  if (throttleTimer !== undefined) clearTimeout(throttleTimer);

  throttleTimer = setTimeout(() => {
    throttled.value = false;
  }, 60_000);
}

/** The throttle may still be pending when the child navigates away — never fire it against a dead component. */
onUnmounted(() => {
  if (throttleTimer !== undefined) clearTimeout(throttleTimer);
});

/** Keep only digits and cap at 11 — the input never promises more than the upstream schema does. */
function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;

  target.value = target.value.replace(/\D/g, "").slice(0, 11);
  code.value = target.value;
}

async function submit(): Promise<void> {
  if (submitting.value || throttled.value) return;

  submitting.value = true;
  error.value = null;

  try {
    const result = await childPanel.enterWithCode(code.value);

    if (result.ok) {
      // The store already cleared the old session and the ended marker.
      await navigateTo("/panels/child");
      return;
    }

    if (result.reason === "ERR_CHILD_ACCESS_INVALID") {
      error.value = "کد درست نیست";
      return;
    }

    if (
      result.reason === "ERR_CHILD_AUTH_THROTTLED" ||
      result.reason === "ERR_TOO_MANY_REQUESTS"
    ) {
      error.value =
        "کدهای نادرست زیاد بوده‌اند. کمی بعد دوباره تلاش کنید.";
      throttled.value = true;
      resetThrottleTimer();
      return;
    }

    error.value = result.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section
    class="neu-raised-lg relative w-full overflow-hidden p-6"
    :class="
      childPanel.variant === 'child'
        ? 'rounded-3xl bg-x-kid-100'
        : 'rounded-3xl bg-linear-to-br from-x-teen-violet-300/45 via-x-teen-100 to-x-teen-teal-300/60'
    "
  >
    <!-- The kid form's one floating element, and it is the only one in the panel. -->
    <img
      v-if="childPanel.variant === 'child'"
      src="/images/panels/kid-blob.svg"
      alt=""
      aria-hidden="true"
      class="absolute -top-6 start-[-1.5rem] size-28 opacity-90"
      width="112"
      height="112"
    >
    <img
      v-else
      src="/images/panels/teen-blob.svg"
      alt=""
      aria-hidden="true"
      class="absolute -top-4 start-[-1rem] size-24 opacity-50"
      width="96"
      height="96"
    >

    <div class="relative flex flex-col items-center text-center">
      <img
        :src="childPanel.variant === 'child' ? '/images/panels/child-avatar.svg' : '/images/panels/teen-avatar.svg'"
        alt=""
        aria-hidden="true"
        class="size-16 rounded-full bg-white/60 p-1"
        :class="childPanel.variant === 'child' ? 'ring-2 ring-x-kid-300' : 'ring-2 ring-x-teen-violet-300'"
        width="64"
        height="64"
      >

      <h2 class="mt-4 font-yekan-extra text-xl text-x-text-title">
        {{ childPanel.variant === 'child' ? 'کد مخصوصت را وارد کن' : 'کد ورود' }}
      </h2>
      <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
        {{ childPanel.variant === 'child' ? 'همون کدی که والدت بهت داده — ۱۱ رقمه' : 'کد ۱۱ رقمی که والد شما به شما داده است را وارد کنید.' }}
      </p>
    </div>

    <form class="relative mt-6" @submit.prevent="submit">
      <label class="sr-only" for="child-enter-code">کد ورود</label>
      <input
        id="child-enter-code"
        type="text"
        inputmode="numeric"
        dir="ltr"
        maxlength="11"
        autocomplete="one-time-code"
        :value="code"
        :disabled="submitting || throttled"
        class="neu-inset w-full rounded-2xl bg-white/70 px-4 py-3 text-center font-yekan-extra text-2xl tracking-[0.25em] text-x-text-title placeholder:text-x-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        :class="[
          childPanel.variant === 'child' ? 'h-16 text-3xl focus-visible:outline-x-kid-berry-700' : 'h-14 focus-visible:outline-x-teen-violet-600',
        ]"
        placeholder="۱۱۰۲۳۰۴۵۶۷۸۹"
        @input="onInput"
      >

      <UAlert
        v-if="error"
        class="mt-3"
        variant="soft"
        color="error"
        :title="error"
      />

      <p v-if="throttled" class="mt-2 text-xs text-x-text-subtitle">
        کمی صبر کن و بعد دوباره تلاش کن.
      </p>

      <UButton
        type="submit"
        :loading="submitting"
        :disabled="throttled || code.length !== 11"
        :label="childPanel.variant === 'child' ? 'بریم!' : 'ورود'"
        trailing-icon="solar:arrow-left-linear"
        class="mt-4 w-full"
        :ui="{ base: childPanel.variant === 'child' ? 'h-14 rounded-2xl bg-x-kid-sun-500! text-x-kid-900! font-yekan-extra' : 'h-12 rounded-xl bg-x-teen-violet-600! text-white!' }"
      />
    </form>
  </section>
</template>
