<script setup lang="ts">
import { useMounted } from "@vueuse/core";
import type { StoryAuthor, StoryItem } from "~/types/story";

/**
 * The chrome column under the progress bar: who is speaking, when, and the
 * three controls.
 *
 * Two lines with `truncate` on the title is deliberate: a 60-character Persian
 * author name must never push the three 44 px controls off a 320 px screen.
 * `16 + 36 + 8 + title + 3×44 + 2×4` still leaves ~104 px for the title there.
 */
const props = defineProps<{
  author: StoryAuthor;
  item: StoryItem;
  /** The parent owns the *reasons*; the header only flips the manual one. */
  manualPaused: boolean;
}>();

const emit = defineEmits<{ toggle: []; next: []; close: [] }>();

/**
 * Relative time is the one string that cannot be rendered on the server — it
 * depends on the clock, so a bucket boundary crossed between SSR and hydration
 * is a text mismatch. Before mount we render the deterministic `faDate`;
 * afterwards the relative form, on a `min-h-4` box so the post-mount fill
 * shifts nothing.
 */
const mounted = useMounted();
const timeLabel = computed(() =>
  mounted.value
    ? faRelative(props.item.publishedAt, Date.now())
    : faDate(props.item.publishedAt),
);
</script>

<template>
  <div class="flex items-center gap-2 px-4 pt-2 pb-6">
    <!--
      `UAvatar` renders `src` through `NuxtImg` (IPX) and `image.domains` is
      `[]`, which does NOT mean a remote avatar fails — `@nuxt/image` passes a
      non-allow-listed remote URL straight through to the browser as-is. The
      mock sticks to local `/images/...` paths because that is the API-phase
      precondition for this panel, not because anything enforces it yet.
      `alt` is always passed, because on an image error `UAvatar` falls back to
      initials derived from it.
    -->
    <!--
      `size` is a closed enum (3xs…3xl, max `size-12`); `lg` IS `size-9`, and the
      `:ui` root only adds the ring, so neither has to be spelled as a raw size.
    -->
    <UAvatar
      size="lg"
      :src="author.avatar"
      :alt="author.title"
      :ui="{ root: 'ring-2 ring-white/90' }"
      class="shrink-0"
    />

    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-1 truncate text-sm font-bold text-white">
        <span class="truncate">{{ author.title }}</span>
        <UIcon
          v-if="author.verified"
          name="solar:verified-check-linear"
          size="16"
          class="shrink-0 text-x-primary-300"
          aria-hidden="true"
        />
      </p>
      <time
        class="mt-0.5 inline-block min-h-4 shrink-0 text-[11px] tabular-nums text-white/70"
        :datetime="item.publishedAt"
      >
        {{ timeLabel }}
      </time>
    </div>

    <!--
      The three controls. `size-11` is 44 px, the iOS minimum touch target, and
      the identical `base` string is repeated on purpose: three copies of one
      known-good class list is cheaper to read than a shared constant threaded
      through `:ui`.
    -->
    <!--
      The pause control is a TOGGLE: `aria-label` is CONSTANT and the state
      lives in `aria-pressed`, because a toggle button's accessible name must
      not change with its state (a screen reader re-announcing "ادامه پخش" on
      every press loses the identity of the control and fights the pressed
      state). The visible glyph still swaps below, so sighted readers get the
      state from the icon. Do not make the label conditional again.
    -->
    <UButton
      variant="ghost"
      color="neutral"
      square
      :ui="{
        base: 'size-11 min-h-11 rounded-full text-white hover:bg-white/15 active:bg-white/25 focus-visible:ring-2 focus-visible:ring-white transition-colors duration-150 ease-out',
      }"
      aria-label="توقف پخش"
      :aria-pressed="manualPaused"
      @click="emit('toggle')"
    >
      <!--
        An `absolute`-overlapped `v-if` pair with a cross-fade (A7), so the glyph
        does not visibly resize the header cluster mid-swap. It is the ONLY
        place the paused state is shown visually — see the `aria-pressed` note
        above.
      -->
      <span class="relative grid place-items-center">
        <UIcon
          v-if="manualPaused"
          name="solar:play-linear"
          class="absolute transition-opacity duration-150 ease-out"
          aria-hidden="true"
        />
        <UIcon
          v-else
          name="solar:pause-linear"
          class="absolute transition-opacity duration-150 ease-out"
          aria-hidden="true"
        />
      </span>
    </UButton>

    <!--
      "Stop" is a COMMAND, not a mode: it ends this item only, and closes the
      viewer on the last frame. There is no third persistent state to reason
      about, and "stop the current item" is the only reading that is useful to
      someone who has finished reading a frame.
    -->
    <UButton
      variant="ghost"
      color="neutral"
      square
      icon="solar:stop-linear"
      :ui="{
        base: 'size-11 min-h-11 rounded-full text-white hover:bg-white/15 active:bg-white/25 focus-visible:ring-2 focus-visible:ring-white transition-colors duration-150 ease-out',
      }"
      aria-label="رد کردن این استوری"
      @click="emit('next')"
    />

    <UButton
      variant="ghost"
      color="neutral"
      square
      icon="solar:close-circle-linear"
      :ui="{
        base: 'size-11 min-h-11 rounded-full text-white hover:bg-white/15 active:bg-white/25 focus-visible:ring-2 focus-visible:ring-white transition-colors duration-150 ease-out',
      }"
      aria-label="بستن استوری"
      @click="emit('close')"
    />
  </div>
</template>
