<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { DiscScores } from "~/types/test";

/**
 * One DISC profile as a four-column 3D bar chart.
 *
 * The API scores every dimension 0–7. The chart never prints the figures as the
 * primary reading: each value floats over its own bar, and the bar's height
 * carries the same information, so a reader who does not parse the numbers
 * still sees the profile's shape.
 */
const props = defineProps<{
  title: string;
  subtitle?: string;
  scores: DiscScores;
}>();

const DIMENSIONS = [
  { key: "D", label: "قاطع", en: "Dominance" },
  { key: "I", label: "اجتماعی", en: "Influence" },
  { key: "S", label: "حمایت‌گر", en: "Steadiness" },
  { key: "C", label: "تحلیل‌گر", en: "Conscientiousness" },
] as const;

const MAX_SCORE = 7;

const animated = ref(false);

onMounted(() => {
  // One frame at zero height, then the real heights transition in.
  requestAnimationFrame(() => {
    animated.value = true;
  });
});

const bars = computed(() =>
  DIMENSIONS.map((dimension, index) => {
    const raw = Number(props.scores[dimension.key]);
    const value = Number.isFinite(raw)
      ? Math.min(MAX_SCORE, Math.max(0, Math.round(raw)))
      : 0;

    return {
      ...dimension,
      value,
      delay: index * 90,
      height: animated.value ? (value / MAX_SCORE) * 100 : 0,
    };
  }),
);

const chartLabel = computed(
  () =>
    `${props.title}: ` +
    bars.value
      .map((bar) => `${bar.label} ${faNumber(bar.value)} از ${faNumber(MAX_SCORE)}`)
      .join("، "),
);
</script>

<template>
  <section
    class="disc-card overflow-hidden rounded-3xl bg-white p-4"
    :aria-label="chartLabel"
  >
    <header class="flex items-baseline justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-xs font-bold text-x-text-title">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="mt-0.5 text-[10px] text-x-text-muted">
          {{ subtitle }}
        </p>
      </div>
      <span
        class="shrink-0 rounded-full bg-x-primary-content-100 px-2 py-0.5 text-[10px] text-x-text-subtitle"
      >
        از ۰ تا ۷
      </span>
    </header>

    <div class="disc-chart mt-3" role="img" :aria-label="chartLabel">
      <!-- Scale guides; purely visual, the label above states the range. -->
      <div class="disc-grid" aria-hidden="true">
        <span v-for="line in 4" :key="line" class="disc-grid__line" />
      </div>

      <ul class="disc-bars">
        <li
          v-for="bar in bars"
          :key="bar.key"
          class="disc-column"
          :aria-label="`${bar.label}: ${faNumber(bar.value)} از ${faNumber(MAX_SCORE)}`"
        >
          <span class="disc-value">{{ faNumber(bar.value) }}</span>

          <div class="disc-track" aria-hidden="true">
            <div
              class="disc-bar"
              :class="`disc-bar--${bar.key}`"
              :style="{
                height: `${bar.height}%`,
                transitionDelay: `${bar.delay}ms`,
              }"
            >
              <span class="disc-bar__cap" />
              <span class="disc-bar__shine" />
            </div>
          </div>

          <span class="disc-letter" aria-hidden="true">{{ bar.key }}</span>
          <span class="disc-label">{{ bar.label }}</span>
          <span class="disc-label-en" aria-hidden="true">{{ bar.en }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.disc-card {
  box-shadow:
    0 1px 2px rgb(15 23 42 / 0.04),
    0 10px 30px -18px rgb(15 23 42 / 0.28);
}

.disc-chart {
  position: relative;
  padding-top: 0.25rem;
}

.disc-grid {
  position: absolute;
  inset-inline: 0;
  top: 0.25rem;
  bottom: 2.9rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.disc-grid__line {
  height: 1px;
  background: color-mix(in srgb, var(--color-x-primary-content-400) 55%, transparent);
}

.disc-grid__line:first-child,
.disc-grid__line:last-child {
  background: color-mix(in srgb, var(--color-x-primary-content-400) 80%, transparent);
}

.disc-bars {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: end;
}

.disc-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
}

.disc-value {
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-x-text-title);
  font-variant-numeric: tabular-nums;
}

.disc-track {
  position: relative;
  width: 100%;
  max-width: 2.75rem;
  height: 7.25rem;
  overflow: hidden;
  border-radius: 0.85rem 0.85rem 0.4rem 0.4rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--color-x-primary-content-200) 88%, transparent),
      color-mix(in srgb, var(--color-x-primary-content-100) 92%, transparent)
    );
  box-shadow: inset 0 2px 6px rgb(15 23 42 / 0.08);
}

.disc-bar {
  position: absolute;
  inset-inline: 0.15rem;
  bottom: 0.15rem;
  overflow: visible;
  border-radius: 0.7rem 0.7rem 0.35rem 0.35rem;
  background: linear-gradient(180deg, var(--bar-from), var(--bar-to));
  box-shadow:
    inset -0.28rem 0 0 rgb(0 0 0 / 0.13),
    inset 0.28rem 0 0 rgb(255 255 255 / 0.22),
    0 0.5rem 0.9rem -0.35rem var(--bar-to);
  transform: perspective(9rem) rotateX(1.5deg);
  transform-origin: bottom center;
  transition: height 720ms var(--ease-soft, cubic-bezier(0.32, 0.72, 0, 1));
  will-change: height;
}

.disc-bar__cap {
  position: absolute;
  inset-inline: 0.1rem;
  top: -0.28rem;
  height: 0.6rem;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff8, var(--bar-from));
  box-shadow: 0 0.1rem 0.3rem rgb(15 23 42 / 0.18);
}

.disc-bar__shine {
  position: absolute;
  inset-block: 0.15rem;
  inset-inline-end: 24%;
  width: 22%;
  border-radius: 999px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.55), transparent);
  opacity: 0.75;
}

.disc-bar--D {
  --bar-from: #ff6aa6;
  --bar-to: #c61060;
}

.disc-bar--I {
  --bar-from: #a8adff;
  --bar-to: #565fb8;
}

.disc-bar--S {
  --bar-from: #6ee7b7;
  --bar-to: #21835b;
}

.disc-bar--C {
  --bar-from: #ffdf70;
  --bar-to: #a8631a;
}

.disc-letter {
  margin-top: 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-x-text-subtitle);
}

.disc-label {
  margin-top: 0.15rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.66rem;
  line-height: 1.4;
  color: var(--color-x-text-title);
}

.disc-label-en {
  margin-top: 0.05rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.52rem;
  line-height: 1.3;
  color: var(--color-x-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .disc-bar {
    transition: none;
  }
}

html[data-motion="reduced"] .disc-bar {
  transition: none;
}
</style>
