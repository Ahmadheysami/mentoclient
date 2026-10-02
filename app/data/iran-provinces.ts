/**
 * The 31 provinces of Iran, in Persian, normalized.
 *
 * WHY THIS FILE EXISTS: the astrology form needs a province, and the external
 * city list cannot supply one.
 * `https://iran-locations-api.ir/api/v1/fa/cities` was fetched and verified: it
 * returns **344** items with `{ name, latitude, longitude }`, both coordinates
 * as **strings**, and **no province field** — and it has no provinces endpoint
 * to pair with. The city list is therefore independent of this list: it knows
 * nothing about which province a city is in, and nothing here says which
 * cities belong to a province. The two are joined by the reader, by name.
 *
 * Normalized on purpose: ی (U+06CC) not ي (U+064A), and ک (U+06A9) not ك
 * (U+0643). The Arabic forms look identical but are different code points, so a
 * stored value in one form does not match this list and the province silently
 * fails to validate.
 *
 * Typed `readonly string[]` rather than a literal tuple: a consumer needs "some
 * province", and a 31-member union would put 31 names in every autocomplete
 * type signature it touches.
 */
export const IRAN_PROVINCES: readonly string[] = [
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "اصفهان",
  "البرز",
  "ایلام",
  "بوشهر",
  "تهران",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان رضوی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "فارس",
  "قزوین",
  "قم",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
];
