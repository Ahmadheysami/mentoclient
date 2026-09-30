/**
 * Stories (رویدادها) as the rail and the viewer read them.
 *
 * This phase is UI-only: the shapes below are the contract the mock in
 * `app/data/stories.mock.ts` already satisfies, so landing the real payload
 * later is a data swap, not a component rewrite. Everything a component is
 * allowed to trust is therefore a primitive, and the two places untrusted
 * strings could become executable — a URL and a colour — are gated by
 * `safeStoryHref` / `safeStoryAccent` before they leave this module.
 */

/* ------------------------------------------------------------------ links -- */

/**
 * Two link treatments, because they answer two different intents: `simple` is
 * "there is a link on this frame", `colorized` is "this frame is an
 * advertisement and should look like one". Modelled as a discriminated union
 * on `variant` so `ViewerCta` can dispatch with an exhaustive `switch` and the
 * compiler refuses a third shape.
 */
export type StoryLinkVariant = "simple" | "colorized";

/** Untrusted label. Interpolated as text only — never rendered as HTML. */
export interface StorySimpleLink {
  variant: "simple";
  label: string;
  url: string;
}

/** Untrusted label + sub-label. */
export interface StoryColorizedLink {
  variant: "colorized";
  label: string;
  /**
   * Untrusted. Gated by `safeStoryHref` in `ViewerCta` exactly like the simple
   * variant's — a colourised CTA is still a link, and the gate is the single
   * place an untrusted URL is allowed to become an `href`.
   */
  url: string;
  /** One short line under the label. Omitted when the copy is thin. */
  description?: string;
  /**
   * `@nuxt/icon` name. Untrusted, so it is allow-listed to the one locally
   * installed collection by `LinkColorized` before it reaches `<UIcon>`: for a
   * collection that is not bundled locally, `@nuxt/icon` falls back to the
   * public Iconify API from the READER'S BROWSER.
   */
  icon?: string;
  /**
   * Two `#rrggbb` stops for the button's gradient. Untrusted, so it is
   * validated by `safeStoryAccent` before it can reach a style attribute.
   */
  accent?: [string, string];
}

export type StoryLink = StorySimpleLink | StoryColorizedLink;

/* ------------------------------------------------------------------ media -- */

/**
 * `video` exists so the API is not blocked by this phase's shape, but the
 * viewer renders `kind === 'image'` only and falls back to the poster for
 * anything else. Adding playback later must not change the item contract.
 */
export type StoryMediaKind = "image" | "video";

export interface StoryMedia {
  kind: StoryMediaKind;
  /** Local path, or an absolute `http(s)` URL. Never `javascript:`/`data:`. */
  src: string;
  /** Empty string marks the image as decorative; the frame's own text carries it. */
  alt: string;
  /** Intrinsic size, so the media box can reserve space and avoid CLS. */
  width?: number;
  height?: number;
}

/* ------------------------------------------------------------------- item -- */

export interface StoryItem {
  id: string;
  media: StoryMedia;
  /** Absent for a frame that is only an announcement. */
  link?: StoryLink;
  /** ISO-8601. Drives the rail's «۲ ساعت پیش» and the viewer's own stamp. */
  publishedAt: string;
  /** Viewer dwell. Clamped by `storyItemDuration`; never trusted raw. */
  durationMs?: number;
}

/* ------------------------------------------------------------------ group -- */

export interface StoryAuthor {
  id: string;
  /** Display name: the rail caption and the viewer header line. */
  title: string;
  /** May be empty — `UAvatar` then renders initials from `alt`. */
  avatar: string;
  /** Brand tick beside the name. */
  verified?: boolean;
}

/**
 * One reel. `title` is the reel's own headline, deliberately separate from
 * `author.title`: the rail shows the author, the viewer header shows the author
 * with the reel title as the frame's caption.
 */
export interface StoryGroup {
  id: string;
  author: StoryAuthor;
  title: string;
  items: StoryItem[];
}

/* -------------------------------------------------------------- viewmodel -- */

/**
 * One row of the flattened reel. This is the only shape the viewer's Swiper
 * knows about, which is what lets a single carousel cover both "next item" and
 * "next story" without a second instance.
 */
export interface StoryFrame {
  key: string;
  groupIndex: number;
  itemIndex: number;
  group: StoryGroup;
  item: StoryItem;
}

/* --------------------------------------------------------------- constants -- */

/** Instagram's default dwell. */
export const STORY_DEFAULT_ITEM_DURATION_MS = 5000;
/** Below this the bar is a flicker, not a countdown. */
export const STORY_MIN_ITEM_DURATION_MS = 2500;
/** Above this a frame is being ignored, not read. */
export const STORY_MAX_ITEM_DURATION_MS = 15000;

/**
 * Dark-viewer palette. Every entry maps to a token already in `main.css` /
 * `nuxt.config.ts`, so the viewer introduces no new colour.
 *
 * What this map actually holds is the small set the components cannot express as
 * a stock Tailwind utility: the four gradient stops `Viewer.vue` publishes as
 * custom properties on the viewer root (`--story-accent-*`,
 * `--story-placeholder-*`) plus the progress bar's track colour. The rest of the
 * dark viewer is written as utilities in place — both scrims are
 * `bg-linear-to-* from-black/…`, the fills are `bg-white`, the header text is
 * `text-white` / `text-white/70` — and the exact `rgb()`/`#` values recorded
 * here are the tokens those utility alphas were taken from.
 */
export const STORY_VIEWER_COLORS = {
  barTrack: "rgb(255 255 255 / 0.32)",
  accentFrom: "#2b7fff", // --color-x-primary-500
  accentTo: "#7c86ff", // --color-x-secondary-500
  placeholderFrom: "#0e3d8a", // --color-x-primary-800
  placeholderTo: "#2b0b9b", // --color-x-quiz-primary
} as const;

/* ----------------------------------------------------------------- helpers -- */

/**
 * The dwell a frame actually gets. Clamped, never trusted raw: a hostile or
 * buggy `0` would make the bar flash and the story skip instantly, and an
 * unbounded value would leave a reader stuck on a frame.
 */
export function storyItemDuration(item: StoryItem): number {
  const raw = item.durationMs;

  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return STORY_DEFAULT_ITEM_DURATION_MS;
  }

  return Math.min(
    STORY_MAX_ITEM_DURATION_MS,
    Math.max(STORY_MIN_ITEM_DURATION_MS, raw),
  );
}

/**
 * The single flattening pass the whole feature depends on: one flat list of
 * frames is the only thing the viewer's Swiper knows about, which is what makes
 * "next item", "next story" and "next story's first item" one operation.
 *
 * Groups with **zero** items contribute nothing, so they can never be opened.
 * `key` is the identity the timing engine resets on.
 */
export function flattenStoryGroups(groups: StoryGroup[]): StoryFrame[] {
  const frames: StoryFrame[] = [];

  groups.forEach((group, groupIndex) => {
    group.items.forEach((item, itemIndex) => {
      frames.push({
        key: `${group.id}:${item.id}`,
        groupIndex,
        itemIndex,
        group,
        item,
      });
    });
  });

  return frames;
}

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * The single URL gate. Anything that is not an absolute `http(s)` URL returns
 * `null` and the CTA is not rendered at all.
 *
 * Why this must be ours, and why it must be `new URL`: Nuxt UI's `ULink`
 * decides "is this external?" with ufo's `hasProtocol(path, { acceptRelative:
 * true })`, which returns `true` for `javascript:alert(1)`, `data:…` and
 * `vbscript:…`. So an allow-list placed upstream of `UButton` is mandatory, and
 * a naive `url.startsWith('http')` is not enough either:
 * `'\tjavascript:alert(1)'` slips past it but is normalised by `new URL()` to
 * `javascript:`. `new URL()` + a two-entry protocol set is the only form that
 * survives case-folding, leading control characters, and protocol-relative
 * `//host` (which `new URL` rejects without a base).
 */
export function safeStoryHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Validates both gradient stops. A stop that is not interpolated with
 * `color-mix` is the one place a third party could smuggle a second CSS
 * declaration through a `:style` binding, so it is gated here; the caller falls
 * back to the house brand pair when this returns `null`.
 *
 * The parameter is `unknown` on purpose, not `[string, string]`: this runs
 * inside a `computed` in the render path, so a malformed payload has to fall
 * BACK, never throw. `Array.isArray` is the shape check that makes that true —
 * `123`, `true`, `{from,to}` and `{length: 2}` all throw
 * `TypeError: … is not iterable` on the destructuring line.
 */
export function safeStoryAccent(accent?: unknown): [string, string] | null {
  if (!Array.isArray(accent) || accent.length !== 2) return null;

  const [from, to] = accent as [unknown, unknown];

  if (typeof from !== "string" || typeof to !== "string") return null;
  if (!HEX.test(from) || !HEX.test(to)) return null;

  return [from, to];
}
