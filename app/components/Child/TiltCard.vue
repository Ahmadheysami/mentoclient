<script setup lang="ts">
/**
 * A surface that leans toward the pointer.
 *
 * The wrapper carries the `perspective`, the slot carries the rotation, and a
 * soft highlight travels with the pointer so the card reads as a physical
 * object rather than a flat rectangle. The text inside does not move — only the
 * card plane does — so nothing becomes hard to read.
 *
 * ## WHY THE FINGER DOES NOT GET STUCK IN A LEAN
 *
 * A `pointermove` on touch is also the gesture a child uses to scroll the
 * sheet, and this card never calls `preventDefault`: the scroll always wins and
 * the lean simply follows the finger. `pointerup` / `pointercancel` settle it
 * back the moment the gesture ends, so nothing stays tilted mid-read.
 *
 * It is decoration on top of content that is already visible: reduced motion
 * (`html[data-motion="reduced"]`, or the OS setting) simply switches it off.
 */
const props = withDefaults(
  defineProps<{
    /** How far the card may lean, in degrees, per axis. */
    max?: number;
  }>(),
  { max: 8 },
);

const root = ref<HTMLElement | null>(null);

const rotateX = ref(0);
const rotateY = ref(0);
const lightX = ref(50);
const lightY = ref(50);
const tilting = ref(false);

/** Never tilt before the browser has answered for reduced motion. */
const enabled = ref(false);

onMounted(() => {
  const reduced =
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  enabled.value = !reduced;
});

function onPointerMove(event: PointerEvent) {
  if (!enabled.value || !root.value) return;

  const rect = root.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;

  rotateY.value = (px - 0.5) * 2 * props.max;
  rotateX.value = -(py - 0.5) * 2 * props.max;
  lightX.value = Math.min(100, Math.max(0, px * 100));
  lightY.value = Math.min(100, Math.max(0, py * 100));
  tilting.value = true;
}

/** The card settles back to flat, slower than it leaned in. */
function rest() {
  rotateX.value = 0;
  rotateY.value = 0;
  lightX.value = 50;
  lightY.value = 50;
  tilting.value = false;
}

const tiltStyle = computed(() => ({
  transform: `rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg)`,
  "--tilt-light-x": `${lightX.value}%`,
  "--tilt-light-y": `${lightY.value}%`,
}));
</script>

<template>
  <div ref="root" class="tilt" :class="tilting ? 'tilt--tilting' : 'tilt--rest'">
    <div
      class="tilt__card relative"
      :style="tiltStyle"
      @pointermove="onPointerMove"
      @pointerleave="rest"
      @pointerup="rest"
      @pointercancel="rest"
    >
      <slot />
      <span class="tilt__shine" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.tilt {
  perspective: 900px;
}

.tilt__card {
  transform-style: preserve-3d;
  transition: transform 220ms ease-out;
  will-change: transform;
}

.tilt--rest .tilt__card {
  transition-duration: 480ms;
}

.tilt__shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 260ms ease;
  background: radial-gradient(
    200px circle at var(--tilt-light-x, 50%) var(--tilt-light-y, 50%),
    rgb(255 255 255 / 0.55),
    transparent 65%
  );
}

.tilt--tilting .tilt__shine {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .tilt__card {
    transition: none !important;
    will-change: auto;
  }

  .tilt__shine {
    display: none;
  }
}
</style>
