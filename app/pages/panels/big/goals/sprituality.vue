<script setup lang="ts">
/**
 * `/panels/big/goals/sprituality` — one of the SIX category pages.
 *
 * Every category gets its own file on purpose: no `[category]` route. With a
 * dynamic segment "each category has a page" would be a runtime guess about a
 * string, and a mistyped segment would render a category page for a category that
 * does not exist. Six static files make it a fact of the route table, and a
 * seventh category is one file plus one entry in `GOAL_DOMAINS`.
 *
 * The whole screen is `GoalCategoryPage` — the list, the create sheet, the delete
 * confirmation and all four states live in there once, which is why this page is a
 * gate, a domain, and nothing else.
 *
 * ⚠️ `sprituality` is the LITERAL upstream enum value and it is **misspelled** in
 * the backend's own `app.config.json` and `panels.validation.ts`. This URL segment is
 * also the `category` query the list endpoint validates, so it must be sent
 * verbatim or the request is refused as `ERR_VALIDATION`. The Persian label in
 * `GOAL_DOMAINS_META` is the only place the misspelling is corrected.
 *
 * `panelTitle` is this category's own Persian name, so the panel header says where
 * the reader is. The gate is spelled out in full on every page: a page that
 * forgot it would render the panel chrome with no check.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "هدف‌های معنویات",
});

useSeoMeta({ title: "هدف‌های معنویات" });
</script>

<template>
  <GoalCategoryPage domain="sprituality" />
</template>
