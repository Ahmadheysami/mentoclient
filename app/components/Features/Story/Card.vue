<script setup lang="ts">
import { useMounted } from "@vueuse/core";
import type { StoryGroup } from "~/types/story";

/**
 * One story in the rail: a ring, the author's avatar and a truncated caption.
 *
 * The root is a single real `<button>`, so it is reachable, activatable and
 * labelled by the platform — no `role`, no `tabindex`, no key handler.
 *
 * ## THE CAPTION IS THE STORY'S TITLE, NOT THE AUTHOR'S
 *
 * The client asked for the story TITLE (what the API calls `thread.title` —
 * «تخفیف‌های روزانه», «برترین مشاوران», …) under each ring. The rail used to
 * print the author (`thread.description`), which is why the titles never
 * appeared. `author.title` is still the fallback, so an empty or missing title
 * degrades to a named ring rather than a blank one — it is never hardcoded.
 *
 * ## INSTAGRAM PROPORTIONS
 *
 * 64px ring / 56px avatar, the size Instagram itself uses on a phone. The
 * previous 72px avatar with a 10px gap read as crowded and oversized; the size
 * lives on the wrapper, so both the ring and the avatar stay proportional and
 * the caption cannot stretch the card.
 */
const props = defineProps<{
  group: StoryGroup;
  /** Has the reader been through this reel? Drives the ring only. */
  seen: boolean;
  /** Stagger index for the rail's first paint. */
  index: number;
}>();

const emit = defineEmits<{ select: [] }>();

/**
 * Relative time is clock-dependent, so it cannot be produced on the server —
 * before mount we render the deterministic `faDate`, after mount the relative
 * form. Both are announced, never laid out, so the swap cannot shift the rail.
 */
const mounted = useMounted();
const when = computed(() =>
  mounted.value
    ? faRelative(props.group.items[0]?.publishedAt, Date.now())
    : faDate(props.group.items[0]?.publishedAt),
);

/** The API's own title, with the author name as the never-blank fallback. */
const caption = computed(() => props.group.title?.trim() || props.group.author.title);
</script>

<template>
  <button
    type="button"
    class="reveal-stagger flex w-16 shrink-0 flex-col items-center rounded-2xl text-center transition-transform duration-150 ease-out active:scale-95 motion-reduce:active:scale-100 [transform-origin:center]"
    :style="{ animationDelay: `${Math.min(index * 40, 240)}ms` }"
    :aria-label="`استوری ${group.author.title}، ${caption}، ${when}`"
    @click="emit('select')"
  >
    <!--
      The ring. Unseen is a 135° gradient; seen is a flat hairline
      (`x-primary-content-400`, #bcc9d9). No colour transition, no animation:
      the ring changes only when a story is opened, and animating it would make
      the rail noisy for a change the reader did not just make.

      `x-quiz-accent` and NOT `x-accent-*`: `nuxt.config.ts` lists `x-accent` in
      `ui.theme.colors`, but `main.css` defines no `--color-x-accent-*`, so any
      `x-accent-*` utility is dead. A 135° linear gradient reads as a ring and
      uses only real tokens — a conic sweep would cost an arbitrary value for
      no gain.
    -->
    <span
      class="block rounded-full p-[2px]"
      :class="
        seen
          ? 'bg-x-primary-content-400'
          : 'bg-linear-135 from-x-primary-300 via-x-quiz-accent to-x-secondary-500'
      "
    >
      <span class="block rounded-full bg-white p-[2px]">
        <!--
          `UAvatar` renders `src` through `NuxtImg` → IPX, and `image.domains`
          defaults to `[]` — but that does NOT make a REMOTE avatar fail:
          `@nuxt/image` passes a non-allow-listed remote URL straight through to
          the browser. The mock uses local `/images/...` paths because that is
          the API-phase precondition for this panel, not because anything
          enforces it yet. `alt` is always passed because on an image error
          `UAvatar` falls back to initials derived from it.
        -->
        <!--
          `size` is a closed enum (3xs…3xl, max `size-12`), so the 56px avatar is
          a `:ui` root override on top of the largest legal value, not a made-up
          `size="14"`. 56px + 2×2px inner + 2×2px outer = 64px = `w-16`, so the
          ring, the card and the caption are all exactly the same width.
        -->
        <UAvatar
          size="3xl"
          :src="group.author.avatar"
          :alt="group.author.title"
          :ui="{ root: 'size-14' }"
        />
      </span>
    </span>

    <p class="mt-1.5 w-16 truncate text-xs font-bold leading-5 text-x-text-title">
      {{ caption }}
    </p>
  </button>
</template>
