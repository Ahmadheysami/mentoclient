import type { StoryGroup, StoryItem, StoryLink } from "~/types/story";

/**
 * The single mock source for the story feature.
 *
 * A **function**, not a const: a module-level `Date.now()` would be captured at
 * chunk-load time and drift, so the relative timestamps have to be computed
 * when the rail mounts.
 *
 * An **explicit import** on purpose. This file lives in `app/data/`, which Nuxt
 * does *not* auto-import, so `grep -rn "stories.mock" app/` finds every
 * consumer on the day the API phase starts and the swap is a one-line change in
 * `Features/Story.vue`. Auto-importing it would make that invisible.
 *
 * Only local `/images/...` paths: `UAvatar` renders `src` through `NuxtImg`
 * (IPX) and `image.domains` defaults to `[]`. That does NOT make a remote
 * avatar fail — `@nuxt/image` passes a non-allow-listed remote URL straight
 * through to the browser — so this is a deliberate API-phase precondition for
 * the panel, not an enforced runtime guarantee.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(now: number, ms: number): string {
  return new Date(now - ms).toISOString();
}

interface Seed {
  id: string;
  author: StoryGroup["author"];
  title: string;
  /** `offset` is measured back from the moment the rail mounts. */
  items: Array<{
    id: string;
    src: string;
    alt: string;
    width: number;
    height: number;
    offset: number;
    link?: StoryLink;
    /** Below the clamp floor, to prove `storyItemDuration` corrects it. */
    durationMs?: number;
  }>;
}

/** `undefined` is a real case, not an oversight: a frame with no CTA. */
function image(
  id: string,
  src: string,
  alt: string,
  width: number,
  height: number,
  offset: number,
  link?: StoryLink,
  durationMs?: number,
): NonNullable<Seed["items"][number]> {
  return { id, src, alt, width, height, offset, link, durationMs };
}

const SEEDS: Seed[] = [
  {
    id: "g-psycho",
    author: {
      id: "a-clinic",
      title: "کلینیک روان‌شناسی مهر",
      avatar: "/images/char/mentoya-welcome.png",
      verified: true,
    },
    title: "دوره‌های تازه کلینیک",
    items: [
      image(
        "g-psycho-1",
        "/images/bg/bb.webp",
        "پوستر معرفی دوره‌های تازه کلینیک روان‌شناسی",
        640,
        1419,
        4 * MINUTE,
        {
          variant: "colorized",
          url: "https://example.com/story",
          label: "مشاهده دوره‌ها",
          description: "ثبت‌نام تا پایان همین هفته",
          icon: "solar:calendar-bold-duotone",
          accent: ["#2b7fff", "#7c86ff"],
        },
        5000,
      ),
      image(
        "g-psycho-2",
        "/images/bg/login-bg.png",
        "تصویر پس‌زمینه دوره‌های کلینیک",
        800,
        422,
        4 * MINUTE,
        { variant: "simple", label: "جزئیات دوره", url: "https://mentoya.ir/courses" },
        5000,
      ),
      image(
        "g-psycho-3",
        "/images/test-disc.jpg",
        "پوستر آزمون‌های آنلاین کلینیک",
        600,
        747,
        3 * MINUTE,
        {
          variant: "colorized",
          url: "https://example.com/story",
          label: "شرکت در آزمون",
          description: "کمتر از ۱۵ دقیقه",
          icon: "solar:document-text-linear",
          // A rejected accent (not hex): the CTA must fall back to the house
          // brand pair rather than render an off-brand or invisible button.
          accent: ["red", "blue"],
        },
        4000,
      ),
      image(
        "g-psycho-4",
        "/images/bg/bb.webp",
        "پایان پوستر دوره‌ها",
        640,
        1419,
        2 * MINUTE,
        // No link: a pure announcement frame. It must get no bottom scrim.
        undefined,
        4000,
      ),
    ],
  },
  {
    id: "g-cafe",
    author: {
      id: "a-cafe",
      title: "کافه گفت‌وگو",
      avatar: "/images/cup-cafe.webp",
      verified: false,
    },
    title: "جلسه‌های این هفته کافه",
    items: [
      image(
        "g-cafe-1",
        "/images/cup-cafe.webp",
        "جلسه گفت‌وگوی گروهی کافه",
        700,
        700,
        2 * HOUR,
        {
          variant: "simple",
          label: "رزرو جلسه",
          url: "https://mentoya.ir/cafe",
        },
        6000,
      ),
      image(
        "g-cafe-2",
        "/images/bg/login-bg.png",
        "پوستر جلسه گفت‌وگوی گروهی",
        800,
        422,
        2 * HOUR,
        undefined,
        5000,
      ),
      image(
        "g-cafe-3",
        "/images/test-disc.jpg",
        "یادآوری جلسه کافه",
        600,
        747,
        95 * MINUTE,
        {
          variant: "simple",
          label: "دیدن برنامه کامل",
          url: "https://mentoya.ir/cafe/schedule",
        },
        5000,
      ),
    ],
  },
  {
    id: "g-empty",
    author: {
      id: "a-empty",
      title: "دپارتمان آموزش",
      avatar: "/images/char/emp.png",
      verified: false,
    },
    title: "هنوز چیزی منتشر نشده",
    // Zero items on purpose: `List.vue` must filter this group out and
    // `openGroup` must refuse it, so the edge case is visible in the demo.
    items: [],
  },
  {
    id: "g-single",
    author: {
      id: "a-single",
      title: "پشتیبانی منتویا",
      avatar: "/images/char/child.png",
      verified: true,
    },
    title: "یک استوری، بدون چندتایی",
    items: [
      image(
        "g-single-1",
        "/images/char/big.png",
        "پیام پشتیبانی منتویا",
        429,
        581,
        DAY,
        {
          variant: "simple",
          label: "گفت‌وگو با پشتیبانی",
          url: "https://mentoya.ir/support",
        },
        // Below the clamp floor: the engine must raise it to 2500 ms rather
        // than render a flickering bar.
        600,
      ),
    ],
  },
  {
    id: "g-org",
    author: {
      id: "a-org",
      title: "سامانه سازمانی",
      avatar: "/images/char/org.png",
      verified: true,
    },
    title: "گزارش تازه سازمان‌ها",
    items: [
      image(
        "g-org-1",
        "/images/bg/bb.webp",
        "گزارش تازه سامانه سازمانی",
        640,
        1419,
        26 * HOUR,
        {
          variant: "colorized",
          url: "https://example.com/story",
          label: "دریافت گزارش",
          description: "نسخه PDF و Excel",
          icon: "solar:chart-2-bold-duotone",
        },
        5000,
      ),
      image(
        "g-org-2",
        "/images/banner/mentoya-1.png",
        "نمودار عملکرد سازمان در ماه گذشته",
        1536,
        1024,
        26 * HOUR,
        {
          variant: "colorized",
          url: "https://example.com/story",
          label: "مشاهده داشبورد",
          icon: "solar:chart-square-bold-duotone",
          accent: ["#e11d74", "#7c86ff"],
        },
        4500,
      ),
      image(
        "g-org-3",
        "/images/test-disc.jpg",
        "یادآوری به‌روزرسانی سامانه",
        600,
        747,
        5 * DAY,
        // Deliberately refused: `safeStoryHref` rejects the scheme, so the CTA
        // is not rendered at all and the frame stays watchable.
        { variant: "simple", label: "مشاهده نسخه جدید", url: "javascript:alert(1)" },
        5000,
      ),
      image(
        "g-org-4",
        "/images/cup-cafe.webp",
        "پایان پویرنده‌های سازمانی",
        700,
        700,
        8 * DAY,
        undefined,
        5000,
      ),
    ],
  },
];

export function mockStoryGroups(): StoryGroup[] {
  const now = Date.now();

  return SEEDS.map((seed) => {
    const items: StoryItem[] = seed.items.map((item) => ({
      id: item.id,
      media: {
        kind: "image",
        src: item.src,
        alt: item.alt,
        width: item.width,
        height: item.height,
      },
      publishedAt: ago(now, item.offset),
      ...(item.link ? { link: item.link } : {}),
      ...(item.durationMs === undefined ? {} : { durationMs: item.durationMs }),
    }));

    return {
      id: seed.id,
      author: seed.author,
      title: seed.title,
      items,
    };
  });
}
