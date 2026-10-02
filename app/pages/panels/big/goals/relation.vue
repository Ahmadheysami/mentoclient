<script setup lang="ts">
/**
 * `/panels/big/goals/relation` — one of the SIX category pages.
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
 * ⚠️ The segment is the LITERAL upstream `category` value and doubles as the
 * query `GET /goal` validates against a `z.enum`, so one constant serves both
 * route and request. There is no translation table between them.
 *
 * `panelTitle` is this category's own Persian name, so the panel header says where
 * the reader is. The gate is spelled out in full on every page: a page that
 * forgot it would render the panel chrome with no check.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "هدف‌های احساسی",
});

useSeoMeta({ title: "هدف‌های احساسی" });
</script>

<template>
  <GoalCategoryPage domain="relation" />
</template>
