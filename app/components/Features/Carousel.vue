<script setup lang="ts">
import { Swiper, SwiperSlide } from "swiper/vue";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

/**
 * A backend-configured ad carousel.
 *
 * `for` is the backend's carousel key (`GET /api/ui/carousel/{for}`); the
 * response is normalised below because the upstream contract is not declared
 * in this repository. The component keeps the existing Swiper presentation and
 * falls back to the local banner when the request fails or returns an empty
 * list, so the home screen is never left without its banner.
 */
type Sizes = "sm" | "lg" | "xl";

interface CarouselSlide {
  id: string;
  image: string;
  alt: string;
  /** Internal path or absolute http(s) URL; absent for a non-clickable slide. */
  link?: string;
  title?: string;
}

const props = withDefaults(
  defineProps<{
    /** Backend carousel key. */
    for: string;
    size?: Sizes;
  }>(),
  { size: "xl" },
);

const SIZES: Record<Sizes, number> = {
  sm: 100,
  lg: 155,
  xl: 210,
};

const FALLBACK: CarouselSlide[] = [
  {
    id: "fallback-banner",
    image: "/images/banner/mentoya-1.png",
    alt: "منتویا",
  },
];

const { data, pending } = await useFetch(
  `/api/ui/carousel/${encodeURIComponent(props.for)}`,
  { key: `ui-carousel-${props.for}` },
);

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function firstString(
  record: UnknownRecord,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

/** Only a local path or an http(s) URL may become an image source. */
function safeImage(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** Only a local path or an http(s) URL may become a link. */
function safeLink(value: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

const IMAGE_KEYS = [
  "image",
  "src",
  "imageUrl",
  "image_url",
  "cover",
  "banner",
  "thumbnail",
  "path",
  "file",
] as const;

const LINK_KEYS = ["link", "href", "url", "target", "redirect"] as const;
const TITLE_KEYS = ["title", "name", "label", "alt"] as const;

function imageFrom(record: UnknownRecord): string | null {
  const direct = firstString(record, IMAGE_KEYS);
  if (direct) return direct;

  // A nested media/image object is common (`media: { url }`).
  const nested =
    asRecord(record.media) ??
    asRecord(record.image) ??
    asRecord(record.thumbnail);

  return nested ? firstString(nested, ["url", "src", "image", "path"]) : null;
}

function pickList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const body = asRecord(payload);
  if (!body) return [];

  // Cover the envelopes this API family uses across modules: `data`, `result`,
  // plus the carousel's own likely names. The first array wins.
  for (const key of [
    "carousels",
    "carousel",
    "items",
    "slides",
    "banners",
    "list",
    "results",
    "data",
    "result",
  ]) {
    const value = body[key];
    if (Array.isArray(value)) return value;

    const nested = asRecord(value);
    if (nested) {
      const nestedList = pickList(nested);
      if (nestedList.length) return nestedList;
    }
  }

  return [];
}

function normalize(payload: unknown): CarouselSlide[] {
  return pickList(payload).flatMap((entry, index) => {
    const record = asRecord(entry);

    if (!record) {
      // Some backends return a plain string of image paths.
      if (typeof entry === "string") {
        const image = safeImage(entry);
        return image
          ? [{ id: `slide-${index}`, image, alt: "منتویا" }]
          : [];
      }

      return [];
    }

    const image = safeImage(imageFrom(record));
    if (!image) {
      // A group wrapper (`{ slides: [...] }`) is flattened one level. The
      // public GET documents a flat `data` array, but the collection endpoint
      // returns groups, so accepting both costs nothing.
      const nested = record.slides ?? record.items ?? record.data;
      return Array.isArray(nested) ? normalize(nested) : [];
    }

    const title = firstString(record, TITLE_KEYS) ?? undefined;
    const linkBody = asRecord(record.link);
    const linkValue =
      firstString(record, LINK_KEYS) ??
      (linkBody ? firstString(linkBody, ["url", "href"]) : null);
    const link = safeLink(linkValue);
    const id =
      firstString(record, ["id", "_id", "key"]) ?? `slide-${index}`;

    return [
      {
        id,
        image,
        alt: title ?? "منتویا",
        ...(link && { link }),
        ...(title && { title }),
      },
    ];
  });
}

const slides = computed<CarouselSlide[]>(() => {
  const normalized = normalize(data.value);
  return normalized.length ? normalized : FALLBACK;
});

/** Static fallback while the config request is still in flight. */
const isFallback = computed(
  () => pending.value && normalize(data.value).length === 0,
);
</script>

<template>
  <section class="mb-5 mt-1">
    <Swiper
      class="banner-swiper"
      :modules="[Pagination]"
      :slides-per-view="slides.length > 1 ? 1.15 : 1"
      :pagination="{ clickable: true }"
    >
      <SwiperSlide v-for="slide in slides" :key="slide.id">
        <div class="px-8">
          <!--
            The same shell as the Pro banner above: rounded, hairline ring and a
            soft shadow, so the carousel reads as part of the same column. A
            scrim keeps the title legible over whatever artwork the backend
            sends, and the whole card is the link (a stretched, focusable
            overlay) so the content is rendered once instead of per link type.
          -->
          <article
            class="group relative overflow-hidden rounded-3xl bg-x-secondary-900 shadow-lg shadow-x-secondary-900/15 ring-1 ring-slate-900/5"
          >
            <img
              :src="slide.image"
              :alt="slide.alt"
              :style="{ height: `${SIZES[props.size]}px` }"
              loading="lazy"
              decoding="async"
              class="w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              :class="{ 'opacity-80': isFallback }"
            />

            <!-- Scrim: a gradient, not a solid bar, so the artwork still reads. -->
            <span
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 bg-linear-to-t from-x-secondary-900/80 via-x-secondary-900/10 to-transparent"
            />

            <!-- No title from the backend: a small brand chip, same idea as the
                 Pro banner's badge. -->
            <span
              v-if="!slide.title"
              class="pointer-events-none absolute start-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm"
            >
              منتویا
            </span>

            <div
              v-else
              class="pointer-events-none absolute inset-x-4 bottom-2.5 flex items-end justify-between gap-2"
            >
              <strong
                class="line-clamp-2 text-sm font-bold leading-5 text-white drop-shadow-sm"
              >
                {{ slide.title }}
              </strong>
              <span
                v-if="slide.link"
                class="grid size-7 shrink-0 place-items-center rounded-full bg-white/95 text-x-secondary-700 shadow-sm transition-transform duration-200 group-hover:-translate-x-0.5"
              >
                <UIcon
                  name="solar:arrow-left-linear"
                  size="15"
                  aria-hidden="true"
                />
              </span>
            </div>

            <NuxtLink
              v-if="slide.link?.startsWith('/')"
              :to="slide.link"
              :aria-label="slide.title ?? 'مشاهده'"
              class="absolute inset-0 rounded-3xl outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            />

            <a
              v-else-if="slide.link"
              :href="slide.link"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="slide.title ?? 'مشاهده'"
              class="absolute inset-0 rounded-3xl outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            />
          </article>
        </div>
      </SwiperSlide>
    </Swiper>
  </section>
</template>

<style scoped lang="scss">
/* Pagination lives UNDER the card rather than on top of the artwork: the
   padding is the space the absolutely-positioned bullets sit in. */
.banner-swiper {
  padding-bottom: 1.5rem;
}

:deep(.swiper-pagination) {
  bottom: 0.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

:deep(.swiper-pagination-bullet) {
  width: 0.375rem;
  height: 0.375rem;
  margin: 0 !important;
  border-radius: 9999px;
  background: var(--color-x-secondary-300);
  opacity: 1;
  transition:
    width 0.25s ease,
    background-color 0.25s ease;
}

:deep(.swiper-pagination-bullet-active) {
  width: 1.125rem;
  background: var(--color-x-secondary-600);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.swiper-pagination-bullet) {
    transition: none;
  }
}
</style>
