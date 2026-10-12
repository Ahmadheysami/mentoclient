<script setup lang="ts">
import type { IssuedAccessCode } from "~/types/parent-panel";

/**
 * The one screen on which an access code exists as TEXT.
 *
 * ## WHY THIS IS THE ONLY PLACE, AND WHY IT SAYS SO
 *
 * Upstream stores the code hashed and projects only `hasAccessCode` afterwards,
 * so `POST /child/create` and `POST /child/{childId}/access-code` are the only two
 * responses in the whole API that carry a value — and this tray is where that
 * value is spent. The store holds it for one screen (`state.issuedCode`) and drops
 * it on navigation, because keeping it around longer would be keeping a child's
 * login credential in memory for no reason.
 *
 * The line «این کد فقط همین یک‌بار نمایش داده می‌شود» is not a formality: it is the
 * only place the reader is told that copying it now is not optional, and a code
 * they did not write down cannot be recovered.
 *
 * ## THE LINK, AND WHY IT IS THE SAME CREDENTIAL
 *
 * Under the code sits its shareable form — `/panels/child/<code>` — which lands
 * the child on the auto-entry page (`app/pages/panels/child/[code].vue`). The
 * link carries the same 11 digits, so it is the credential, once. What is
 * copied and shared is still the CODE itself, which is the thing a parent
 * actually hands over.
 */
defineProps<{ issued: IssuedAccessCode }>();

/** Origin of the current host (localhost:3000 in dev, the deployed domain in prod). */
const origin = useRequestURL().origin;

/** Prototype copy affordance: clipboard plus a local confirmation. */
const copied = ref(false);

async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    copied.value = false;
  }
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {
    copied.value = false;
  }
}

async function share(code: string, childName: string) {
  const url = `${origin}/panels/child/${code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `کد دسترسی ${childName}`, text: `${code}\n\n${url}` });
    } else {
      await navigator.clipboard.writeText(`${code}\n\n${url}`);
    }
  } catch {
    /* user dismissed the share sheet — nothing to report */
  }
}
</script>

<template>
  <!--
    Level 3 (`.neu-raised-lg`), not Level 1: this is the screen's subject, and at
    the same depth as the cards around it it would not read as the one thing the
    reader came here to take away.
  -->
  <section
    aria-labelledby="parent-access-code-title"
    class="neu-raised-lg rounded-3xl bg-linear-to-br from-x-parent-100 to-x-parent-warm-100 p-4"
  >
    <div class="flex items-center gap-3">
      <UIcon
        name="solar:key-minimalistic-linear"
        size="24"
        class="shrink-0 text-x-parent-700"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <h2
          id="parent-access-code-title"
          class="text-sm font-yekan-bold text-x-text-title"
        >
          کد دسترسی ساخته شد
        </h2>
        <p class="truncate text-xs text-x-text-subtitle">برای {{ issued.childName }}</p>
      </div>
    </div>

    <!--
      The code sits in a recessed well rather than a filled pill: it is a value to
      read and copy, not a status, and a well says "this is content" where a tint
      would say "this is a state". `dir="ltr"` and `tabular-nums` because an
      eleven-digit number read inside an RTL line gets reordered by the bidi
      algorithm around its own digits, and the digits are the whole point.
    -->
    <p
      class="neu-inset mt-3 truncate rounded-xl bg-white px-3 py-3 text-center font-yekan-extra text-lg tracking-widest text-x-parent-700 tabular-nums ltr"
      dir="ltr"
    >
      {{ issued.code }}
    </p>

    <!--
      The same code, in link form: this is the thing a parent actually hands
      to the child instead of reading eleven digits out loud. It is shown in
      the same tray so the code and its link travel together.
    -->
    <div class="neu-inset mt-3 rounded-xl bg-x-parent-warm-50 p-3">
      <p class="text-[11px] text-x-text-subtitle">لینک دسترسی</p>
      <a
        class="mt-1 block truncate text-center text-xs text-x-parent-600 underline-offset-4 hover:underline"
        dir="ltr"
        :href="`/panels/child/${issued.code}`"
        target="_blank"
        rel="noopener"
      >
        {{ origin }}/panels/child/{{ issued.code }}
      </a>
      <button
        type="button"
        class="mt-2 w-full rounded-xl bg-white py-2 text-xs text-x-parent-700"
        @click="copyLink(`${origin}/panels/child/${issued.code}`)"
      >
        کپی لینک
      </button>
    </div>

    <p class="mt-2 text-[11px] leading-5 text-x-text-subtitle">
      این کد فقط همین یک‌بار نمایش داده می‌شود. آن را برای فرزندتان بفرستید یا همین‌جا
      یادداشت کنید؛ بعداً نمی‌توان دوباره دیدش.
    </p>

    <div class="mt-3 flex items-center gap-2">
      <UButton
        :label="copied ? 'کپی شد' : 'کپی کد'"
        icon="solar:copy-linear"
        variant="soft"
        class="h-11 flex-1 justify-center rounded-full transition-transform duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        :ui="{ base: 'bg-x-parent-600! text-white! hover:bg-x-parent-700!' }"
        @click="copy(issued.code)"
      />
      <UButton
        label="اشتراک‌گذاری"
        icon="solar:share-circle-linear"
        variant="soft"
        class="h-11 flex-1 justify-center rounded-full transition-transform duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        :ui="{ base: 'bg-x-parent-100! text-x-parent-700! hover:bg-x-parent-200!' }"
        @click="share(issued.code, issued.childName)"
      />
      <!-- The label changing is not an announcement. This is. -->
      <span class="sr-only" role="status" aria-live="polite">
        {{ copied ? "کپی شد" : "" }}
      </span>
    </div>
  </section>
</template>
