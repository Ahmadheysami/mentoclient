<script setup lang="ts">
import type { CurrentSession, SessionEntry } from "~/types/settings";

/**
 * The active session, and the short history of past sign-ins.
 *
 * The panel is titled «نشست‌های همین مرورگر» and not «همه دستگاه‌های فعال»
 * because that is the truth: a cookie belongs to one browser, so this list
 * cannot see the phone the reader signed in on last week, and pretending
 * otherwise is the kind of claim that teaches people to trust a security panel
 * they should not. The footnote under the list says the same thing again in
 * plainer words, for whoever is about to clear their cookies.
 */
withDefaults(
  defineProps<{
    current: CurrentSession | null;
    sessions: SessionEntry[];
    loading: boolean;
    error: string | null;
    /** Nothing to clear until something has been recorded. */
    canClear: boolean;
    /**
     * The page's single clock reading. Relative time is the one string in this
     * app that cannot be produced on the server, so it arrives as a prop for
     * the same reason `faRelative` takes `now` as an argument: reading the
     * clock inside the component would let SSR and hydration disagree about
     * which bucket a timestamp falls in, and a row would change its mind in
     * front of the reader.
     */
    now?: number;
  }>(),
  { now: undefined },
);

const emit = defineEmits<{ clear: []; retry: [] }>();

/**
 * The device word is store vocabulary, so the panel asks the store rather than
 * reaching for the label map itself: one place decides what a platform is
 * called, and the panel cannot end up calling `unknown` something else.
 */
const settings = useSettings();
</script>

<template>
  <section class="grid gap-2" aria-labelledby="settings-sessions-title">
    <div class="flex items-baseline justify-between gap-2 px-1">
      <h2 id="settings-sessions-title" class="text-xs font-bold text-x-primary-700">
        نشست‌های همین مرورگر
      </h2>

      <button
        v-if="canClear && !loading && !error"
        type="button"
        class="shrink-0 text-xs font-bold text-x-text-subtitle"
        @click="emit('clear')"
      >
        پاک کردن
      </button>
    </div>

    <div class="overflow-hidden rounded-4xl bg-white">
      <!-- Loading: three rows, so the panel already has the height it will
           have, and nothing below it shifts when the answer lands. -->
      <div v-if="loading" class="grid gap-4 p-4" aria-busy="true">
        <USkeleton v-for="row in 3" :key="row" class="h-11 rounded-2xl bg-slate-100" />
      </div>

      <!-- Error: an inline alert, not a full-screen state — this is one section
           of a page, and `UiStateMessage` is `h-[55dvh]`. The retry is the same
           request the boot plugin made, forced past the store's warm cache. -->
      <UAlert
        v-else-if="error"
        variant="soft"
        color="error"
        title="نشست‌ها خوانده نشد"
        class="m-4"
      >
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

      <template v-else>
        <!--
          The current session gets its own row above the history: it is the one
          the reader is looking at RIGHT now, which is what the green dot and
          the «همین دستگاه» chip are saying.
        -->
        <div
          v-if="current"
          class="flex min-h-16 items-center gap-3 border-b border-slate-100 px-4 py-3"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full bg-x-primary-100 text-x-primary-700"
            aria-hidden="true"
          >
            <UIcon
              :name="current.platform === 'desktop' ? 'solar:monitor-linear' : 'solar:smartphone-2-linear'"
              size="20"
            />
          </span>

          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-sm font-bold text-x-text-title">
              <span class="truncate">نشست فعال</span>
              <span
                class="inline-flex shrink-0 items-center rounded-full bg-x-primary-50 px-2 py-0.5 text-[10px] font-bold text-x-primary-700"
              >
                همین دستگاه
              </span>
            </p>
            <p
              class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-x-text-subtitle"
            >
              <span>{{ settings.platformLabel(current.platform) }}</span>
              <!-- `dir="ltr"`, like the phone number elsewhere: an address is
                   read left to right, and inside an RTL line the bidi algorithm
                   would otherwise reorder it around its own punctuation. -->
              <span v-if="current.ip" dir="ltr">{{ current.ip }}</span>
            </p>
          </div>

          <time
            class="shrink-0 text-[11px] text-x-text-subtitle tabular-nums"
            :datetime="current.at"
          >
            {{ faRelative(current.at, now) }}
          </time>

          <!--
            The dot is decorative: the chip already says "this device" in words,
            and a green circle on its own is a state only colour can carry.
          -->
          <span class="relative flex size-2.5 shrink-0" aria-hidden="true">
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:animate-none"
            />
            <span class="relative inline-flex size-2.5 rounded-full bg-green-500" />
          </span>
        </div>

        <div
          v-for="entry in sessions"
          :key="`${entry.at}-${entry.ip}`"
          class="flex min-h-16 items-center gap-3 border-b border-slate-100 px-4 py-3"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-x-text-subtitle"
            aria-hidden="true"
          >
            <UIcon
              :name="entry.platform === 'desktop' ? 'solar:monitor-linear' : 'solar:smartphone-2-linear'"
              size="20"
            />
          </span>

          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-x-text-title">ورود به منتویا</p>
            <p
              class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-x-text-subtitle"
            >
              <span>{{ settings.platformLabel(entry.platform) }}</span>
              <span v-if="entry.ip" dir="ltr">{{ entry.ip }}</span>
            </p>
          </div>

          <time
            class="shrink-0 text-[11px] text-x-text-subtitle tabular-nums"
            :datetime="entry.at"
          >
            {{ faRelative(entry.at, now) }}
          </time>
        </div>

        <!--
          An empty ledger after a successful load is a normal state — a reader
          who has signed in once has exactly this — so it gets one quiet line
          and not an empty box or a full-screen state.
        -->
        <p
          v-if="!sessions.length"
          class="px-4 py-4 text-center text-xs leading-6 text-x-text-subtitle"
        >
          هنوز ورود دیگری روی این مرورگر ثبت نشده است.
        </p>

        <p
          class="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-x-text-subtitle"
        >
          این تاریخچه فقط روی همین مرورگر نگهداری می‌شود و با پاک کردن کوکی‌ها از
          بین می‌رود.
        </p>
      </template>
    </div>
  </section>
</template>
