import { faNormalize } from "~/utils/fa";
import {
  type AstrologyCity,
  type AstrologyCityResponse,
} from "~/types/astrology";

/**
 * `GET /api/astrology/cities` — the Iranian city list for the birth-data form,
 * proxied from `https://iran-locations-api.ir/api/v1/fa/cities`.
 *
 * ## THE ONE PROXY THAT MUST NOT USE `api()`
 *
 * `server/utils/api.ts` builds its client with the Mentoya `X-Api-Key` and the
 * reader's own `Bearer` token, and it is the correct client for **every other
 * route in this folder**. It is the wrong one here, irreversibly: this request
 * leaves our infrastructure and lands on a third party, so those two headers
 * would hand a stranger our API key and a live session token. There is no
 * upstream path, no reader identity and no Mentoya account behind this call, so
 * nothing is being authenticated — the client below is a bare `$fetch` with no
 * defaults and therefore no headers at all.
 *
 * ## THE UPSTREAM API, AS VERIFIED AGAINST THE LIVE HOST
 *
 * - **308-redirects** (`http` → `https`, and the `/fa/` path). `$fetch` follows
 *   redirects by default, so the answer arrives; nothing here has to.
 * - **344 items**, each `{ name, latitude, longitude }`.
 * - **Both coordinates arrive as STRINGS** — `"38.50"`, `"46.180"`. They are
 *   parsed once, here, into `AstrologyCity`'s numbers, so no call site has to
 *   remember it. A `String` that is not a number (`Number("")` is `0`, and
 *   `Number("abc")` is `NaN`) drops its entry rather than becoming a coordinate
 *   of `0` off the coast of Africa.
 * - **There is NO province field, and no provinces endpoint.** The list knows
 *   nothing about which province a city is in; `app/data/iran-provinces.ts` is
 *   where the provinces come from, and the two are joined by the reader, by
 *   name. Do not expect this list to filter by province.
 * - **119 of the 344 names are typed in Arabic code points** («تبريز», «ميانه»),
 *   so every name goes through `faNormalize` (see `app/utils/fa.ts`).
 * - The list carries **6 exact duplicate entries** (same name, same
 *   coordinates — «حاجي آباد» ×3, and five others ×2). They are kept rather than
 *   deduplicated: the duplicates are indistinguishable in the picker, and the
 *   count this app documents is the count upstream returns.
 *
 * ## CACHE
 *
 * `cachedFunction` (Nitro's own) at **module level**, so the 344 items are
 * fetched once per process per 24h and every reader after that is served from
 * memory. The upstream list is a gazetteer: it does not change between two
 * phone loads a day apart, and re-fetching it on every form open would put a
 * third-party round trip in the middle of a form the reader is waiting on.
 * `swr: false` so a stale entry is refetched **before** being served rather than
 * after, and `getKey` is pinned because the wrapped function takes no arguments
 * and the default key is derived from them.
 *
 * ## NEVER THROWS
 *
 * A third party being down is not this feature's error to propagate: the form
 * reports an empty list and stays usable with coordinates typed by hand. Every
 * path out of this handler is a resolved response — the shape the store expects
 * on failure (`success: false`, `cities: []`), never a rejection the caller
 * would have to catch.
 */
const CITIES_MAX_AGE = 60 * 60 * 24;

/** One entry as the upstream sends it: coordinates are strings. */
interface RawCity {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

/**
 * A parsed coordinate, or `null` for anything that is not one.
 *
 * `Number("")` is `0` and `Number("  ")` is `0` too, so an empty string would
 * otherwise become a real coordinate at Null Island — the one figure on this
 * screen that must never be invented.
 */
function coordinate(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && String(value).trim() !== ""
    ? parsed
    : null;
}

const loadCities = cachedFunction(
  async (): Promise<AstrologyCity[]> => {
    const raw = await $fetch<RawCity[]>(
      "https://iran-locations-api.ir/api/v1/fa/cities",
    );

    if (!Array.isArray(raw)) return [];

    const cities: AstrologyCity[] = [];

    for (const entry of raw) {
      const label =
        typeof entry?.name === "string" ? faNormalize(entry.name.trim()) : "";
      const lat = coordinate(entry?.latitude);
      const long = coordinate(entry?.longitude);

      if (!label.length || lat === null || long === null) continue;

      cities.push({ label, lat, long });
    }

    return cities;
  },
  {
    name: "astrology-cities",
    maxAge: CITIES_MAX_AGE,
    // A refetch replaces the answer before it is served; the alternative is a
    // stale list served once and corrected afterwards.
    swr: false,
    // The wrapped function takes no arguments, so the default key (derived from
    // them) would be an empty string shared with every other cached function
    // that has the same shape.
    getKey: () => "cities",
  },
);

export default defineEventHandler(
  async (): Promise<AstrologyCityResponse> => {
    try {
      return { success: true, cities: await loadCities() };
    } catch {
      // No `message` here on purpose: this response is never shown to a reader,
      // it is a flag that turns into «فهرست شهرها بارگذاری نشد» in the form.
      return { success: false, cities: [] };
    }
  },
);