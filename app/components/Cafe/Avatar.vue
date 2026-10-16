<script setup lang="ts">
/**
 * Round avatar with an initials fallback, for every row, header and bubble in
 * the cafe feature.
 *
 * ## WHY A FALLBACK EXISTS AT ALL
 *
 * `profileImage` is optional on `ICafeTable` and `avatar` is optional on
 * `ITableUserView`, and a table whose picture has not been uploaded yet must
 * still render a row rather than a broken image. So the fallback is not a
 * nicety — it is the state a good share of Phase 1 data will be in.
 *
 * The initials are the **first letter of each of the first two words**, which
 * is the same rule Nuxt UI's own `UAvatar` applies to `alt`; it is recomputed
 * here only so a blank name falls back to a person icon instead of an empty
 * circle, and so the type carries Persian initials («آ م» from «آرش میرزایی»)
 * rather than a generic Latin-looking placeholder.
 *
 * `alt` is the **name**, not a description of a picture of the person: the name
 * is almost always already on screen next to the avatar, and an avatar that
 * repeats it is noise for a screen-reader user.
 */
const props = withDefaults(
  defineProps<{
    src?: string;
    /** Display name. Drives the initials and the `alt`. */
    name?: string;
    size?: "sm" | "md" | "lg" | "xl";
    /** Draws the presence dot on the inline-end corner. */
    online?: boolean;
  }>(),
  { size: "md", online: false },
);

/**
 * Standard spacing steps rather than the `3xs`…`3xl` scale of `UAvatar`: the
 * cafe screens want a 44px row avatar and a 56px conversation-header one, and
 * neither is a size Nuxt UI offers as a named variant.
 */
const SHAPES = {
  sm: { box: "size-9", text: "text-xs" },
  md: { box: "size-11", text: "text-sm" },
  lg: { box: "size-12", text: "text-base" },
  xl: { box: "size-14", text: "text-lg" },
} as const;

/** A whitespace string is a name, a blank one is not. */
const hasImage = computed(
  () => typeof props.src === "string" && props.src.trim().length > 0,
);

const initials = computed(() => {
  const words = (props.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
});

const shape = computed(() => SHAPES[props.size]);
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <UAvatar
      :src="hasImage ? src : undefined"
      :alt="name ?? ''"
      :text="initials || undefined"
      :icon="!hasImage && !initials ? 'solar:user-rounded-linear' : undefined"
      :ui="{
        root: `${shape.box} bg-x-primary-100 text-x-primary-800`,
        fallback: `font-bold ${shape.text}`,
        icon: shape.text,
      }"
    />

    <!--
      On the inline-END corner, which is the bottom-LEFT one in this app's
      hard-coded RTL. The white ring is what keeps the dot readable where it
      overlaps the avatar's own edge; `success` is the one Nuxt UI semantic
      already in `app.config.ts`, so no second green is introduced.
    -->
    <span
      v-if="online"
      class="bg-success-500 ring-x-primary-content-50 absolute -end-0.5 -bottom-0.5 size-3 rounded-full ring-2"
      aria-hidden="true"
    />
  </span>
</template>