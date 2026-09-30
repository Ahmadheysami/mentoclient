<script setup lang="ts">
import { mockStoryGroups } from "~/data/stories.mock";
import { flattenStoryGroups } from "~/types/story";
import type { StoryGroup } from "~/types/story";

/**
 * The story rail plus its viewer — the entry point, and the ONE place the data
 * source is named.
 *
 * ⚠️ DO NOT ADD `Features/Story/index.vue` OR `Features/Story/Story.vue`.
 * Nuxt derives `FeaturesStory` for BOTH (`index.vue` resolves to an empty file
 * name, and `Story.vue` has its own `Story` directory prefix stripped as a
 * matched suffix), so the duplicate is discarded with a warning and
 * `<FeaturesStory />` on the home page silently breaks. The full family lives in
 * `Features/Story/` as `List`, `Card`, `Viewer*` and `Link*`.
 */

// ── The single line the API phase replaces ────────────────────────────────
const groups = ref<StoryGroup[]>(mockStoryGroups());

/**
 * groupId → the MOST RECENT item index visited, not the furthest one reached.
 * In-memory; dies on reload.
 *
 * The distinction is load-bearing and the resume logic depends on it:
 * `onViewerProgress` overwrites on every `slideChange`, so a back-swipe LOWERS
 * the stored index. That is intended — reopening a reel resumes where the
 * reader actually STOPPED, not where they got to. Do not "fix" it to
 * `Math.max`.
 */
const seen = reactive(new Map<string, number>());

const flat = computed(() => flattenStoryGroups(groups.value));

const viewerOpen = ref(false);
const startSlide = ref(0);

/** A group with zero items renders no ring, so it must not mount the rail. */
const hasStories = computed(() => groups.value.some((g) => g.items.length > 0));

/** The flat index of a specific frame, or -1. */
function frameIndexOf(groupId: string, itemIndex: number): number {
  return flat.value.findIndex(
    (frame) => frame.group.id === groupId && frame.itemIndex === itemIndex,
  );
}

function openGroup(groupIndex: number) {
  const first = flat.value.findIndex((frame) => frame.groupIndex === groupIndex);

  // Defensive: a group with zero items has no frame to open.
  if (first < 0) return;

  const target = flat.value[first];

  if (!target) return;

  const groupId = target.group.id;
  const last = seen.get(groupId);
  // Resume where they stopped, but never resume onto a frame that no longer
  // exists — a stale `seen` must not drop the reader off the list.
  const resume = last === undefined ? -1 : frameIndexOf(groupId, last);

  startSlide.value = resume >= 0 ? resume : first;
  viewerOpen.value = true;
}

/** Last write wins, on purpose: see the `seen` docblock. */
function onViewerProgress(groupId: string, itemIndex: number) {
  seen.set(groupId, itemIndex);
}

function closeViewer() {
  viewerOpen.value = false;
}
</script>

<template>
  <!--
    An empty feed renders NOTHING. Not `UiStateMessage`: its root is `h-[55dvh]`,
    which would leave a 55 vh hole in the home page — and Instagram simply
    hides the rail.

    `aria-label` rather than a visible heading: `Home/Services.vue` and
    `App/TopBar.vue` establish that this page has no section-heading rhythm, so
    adding one here only would be inconsistent.
  -->
  <section v-if="hasStories" aria-label="استوری‌ها" class="pt-3">
    <FeaturesStoryList :groups="groups" :seen="seen" @select="openGroup" />

    <!--
      `v-if`, NOT the modal's `open`: `UModal`'s `DialogContent` is rendered by
      Reka's `Presence` only while `open` is true, so a permanently-mounted
      `UModal` would hand Swiper a `null` element and it would never initialise.
      It also keeps the whole viewer (Swiper, rAF, `popstate`) out of the SSR
      payload, so hydration has nothing to mismatch.
    -->
    <FeaturesStoryViewer
      v-if="viewerOpen"
      :groups="groups"
      :start-slide="startSlide"
      @close="closeViewer"
      @finished="closeViewer"
      @progress="onViewerProgress"
    />
  </section>
</template>
