import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Scroll-triggered entrances for the whole app.
 *
 * A screen opts in by marking a section with `data-scroll-reveal`. This plugin
 * fades each mark up as it enters view. Three details make it safe here rather
 * than in a demo:
 *
 * 1. **The scroller is the nearest scrollable ancestor, not always `window`.**
 *    The panel layouts and the default mobile column scroll inside `<main>` /
 *    the layout root, so a `window`-scoped ScrollTrigger would fire every
 *    animation immediately and then never again.
 *
 * 2. **Late-arriving content is picked up.** Most lists render after their API
 *    call, long after `page:finish`; the observer below watches child-list
 *    changes and registers only the elements it has not seen yet.
 *
 * 3. **Reduced motion removes the setup entirely.** No opacity is applied, so
 *    the content is simply present — the preference is not a shorter animation.
 */
export default defineNuxtPlugin((nuxtApp) => {
  gsap.registerPlugin(ScrollTrigger);

  let frame: number | undefined;
  let observer: MutationObserver | undefined;
  let handled = new WeakSet<HTMLElement>();

  const prefersReducedMotion = () => {
    if (!import.meta.client) return true;

    return (
      document.documentElement.dataset.motion === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  };

  /** The nearest ancestor that scrolls vertically, or `window`. */
  const findScroller = (element: HTMLElement): HTMLElement | undefined => {
    let node = element.parentElement;

    while (node && node !== document.body) {
      const overflowY = getComputedStyle(node).overflowY;

      if (overflowY === "auto" || overflowY === "scroll") return node;
      node = node.parentElement;
    }

    return undefined;
  };

  const reveal = (target: HTMLElement) => {
    const scroller = findScroller(target);

    gsap.fromTo(
      target,
      { y: 22, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: target,
          ...(scroller && { scroller }),
          start: "top 90%",
          once: true,
        },
      },
    );
  };

  const setup = (reset: boolean) => {
    if (!import.meta.client) return;

    if (reset) {
      // A new page: drop the old page's triggers and forget its elements.
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      handled = new WeakSet();
    }

    if (prefersReducedMotion()) return;

    const targets = gsap.utils.toArray<HTMLElement>("[data-scroll-reveal]");

    targets.forEach((target) => {
      if (handled.has(target)) return;

      handled.add(target);
      reveal(target);
    });

    ScrollTrigger.refresh();
  };

  const schedule = (reset: boolean) => {
    if (!import.meta.client) return;

    if (frame) cancelAnimationFrame(frame);
    // Two frames: one for the route's DOM, one for layout/CSS to settle.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setup(reset));
    });
  };

  nuxtApp.hook("app:mounted", () => {
    observer = new MutationObserver(() => schedule(false));
    observer.observe(document.body, { childList: true, subtree: true });
    schedule(true);
  });

  nuxtApp.hook("page:finish", () => schedule(true));
});
