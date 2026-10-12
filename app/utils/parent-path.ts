import type { Router, RouteLocationNormalizedLoaded } from "vue-router";

/**
 * The path one level above the current one — but only if that level is a page
 * the app can actually render. Dynamic segments (`/panels/big/goal/message/123`)
 * have parents that are not pages themselves (`/panels/big/goal/message`), so the
 * segments are walked upward until one resolves to a real route; `/` is the
 * guaranteed landing spot. Static sibling routes with indexes (`/test/done`,
 * `/panels/parent/children`) win over their dynamic parents
 * (`/test/done/[id]`, `/panels/parent/children/[childId]`) because the walk
 * starts from the nearest segment.
 */
export function getParentPath(
  route: RouteLocationNormalizedLoaded,
  router: Router,
): string {
  const segments = route.path.split("/").filter(Boolean);

  while (segments.length > 0) {
    segments.pop();
    const candidate = segments.length > 0 ? `/${segments.join("/")}` : "/";

    if (candidate === "/") return "/";

    const resolved = router.resolve(candidate);
    if (resolved.name != null && resolved.matched.length > 0) return candidate;
  }

  return "/";
}
