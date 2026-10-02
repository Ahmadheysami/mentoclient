import { Marked, type Token, type Tokens } from "marked";

/**
 * The ONE renderer for text a model wrote.
 *
 * Every AI answer and every AI report in this app is Markdown that ends up in a
 * `v-html` (`Bot/ChatMessageGroup.vue`, `Astrology/Report.vue`,
 * `panels/big/goal/message/[id].vue`). The text is produced by a language model,
 * so it is **untrusted**: a response may contain whatever a prompt-injected
 * document, a poisoned retrieval or a plain mis-generation put there. Rendering
 * it is therefore not a formatting concern — it is the one place a model's output
 * becomes markup.
 *
 * Two independent defences, because each covers a gap the other leaves:
 *
 * 1. **`renderer: { html: () => "" }`** removes every raw-HTML token, block and
 *    inline, so a response cannot emit `<script>`, `<img onerror>` or
 *    `<svg onload>`. The token is dropped, not escaped: the surrounding Markdown
 *    still renders and the injected tag is simply not there.
 *
 * 2. **The `walkTokens` allowlist below** covers what defence 1 structurally
 *    cannot reach. Dropping HTML tokens does nothing to a *Markdown* link, and
 *    `[x](javascript:alert(1))` contains no HTML token at all — it renders as a
 *    perfectly ordinary `<a>`. `marked` is not a sanitiser and does not filter
 *    URL schemes, so the destination is checked here instead.
 *
 * ## WHY THE HREF IS BLANKED AT THE TOKEN LEVEL
 *
 * The obvious alternative — overriding `renderer.link` and building the `<a>`
 * by hand — is *less* safe, not more. `marked`'s own `link` renderer is what
 * escapes `href` and `title` into their attributes; a hand-written
 * `<a href="${token.href}" title="${token.title}">` throws that away and puts the
 * attack surface back:
 *
 * ```text
 * [x](https://a.b " onmouseover=alert(1) ")  →  <a href="https://a.b" title=" onmouseover=alert(1) ">x</a>
 * [x](https://a.b/"onclick="alert(1))        →  <a href="https://a.b/"onclick="alert(1)">x</a>
 * ```
 *
 * Blanking `token.href` and letting `marked` render the tag keeps its escaping
 * for `href`, `title` and an image's `alt`, so there is exactly one place in the
 * app where an attribute is written and it is not this file.
 *
 * ## WHY THE ALLOWLIST IS AN ALLOWLIST
 *
 * `isSafeDestination` keeps a destination **only** when it starts with one of
 * four schemes, and rejects everything else — including a scheme-less relative
 * URL. Denying by default is the point: a relative reference cannot execute
 * script, so rejecting one costs nothing a report could legitimately contain
 * (a model has no idea which of this app's routes exist), while an allowlist
 * cannot be defeated by a scheme nobody thought of.
 *
 * The check reads the scheme off a **stripped** copy of the value. A browser's
 * URL parser drops ASCII tab/CR/LF from anywhere in a URL and trims C0 control
 * characters and spaces from its edges, so `java\tscript:alert(1)` and
 * `javascript:alert(1)` are the same URL to a browser while looking nothing alike
 * to a regex. The control characters are therefore removed before the scheme is
 * read, and the *original* value is what gets kept, so a legitimate
 * `https://…` destination is passed through byte for byte.
 *
 * The value is also **not** HTML-entity-decoded before the check, and it must not
 * be: decoding happens later, when the browser parses the attribute `marked`
 * wrote, so `[x](java&#x73;cript:alert(1))` reaches the reader as
 * `javascript:alert(1)`. It is rejected here because the raw text does not start
 * with an allowed scheme — which is the same reason a raw
 * `&#x68;ttps://…` is rejected, a false negative that costs nothing.
 *
 * ## WHAT IT DELIBERATELY DOES NOT DO
 *
 * No sanitiser dependency: `marked` is a Markdown parser, not a sanitiser, and
 * adding one for this would be a new dependency in a stack that already parses
 * this text. No `postprocess` regex pass over the finished HTML either — that is
 * the mutation-XSS trade (`&lt;` inside a code span becoming a tag), and it is
 * only reachable by giving up the token-level guarantee above.
 *
 * ## `breaks`
 *
 * `breaks` is left at `marked`'s default (`false`), which is what the two
 * long-standing surfaces (`Bot/ChatMessageGroup.vue`, `Astrology/Report.vue`)
 * already rendered through the global `marked` instance. Soft line breaks inside
 * a paragraph therefore keep collapsing to a space, exactly as they do today.
 */

/** The only URL schemes a link or an image may point at. */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;

/**
 * Everything a browser's URL parser ignores inside a URL: tab, CR and LF
 * anywhere, and C0 controls plus space at the edges.
 *
 * Read before the scheme, or `java\tscript:alert(1)` is a relative URL to this
 * file and a `javascript:` URL to the reader.
 */
const IGNORED_BY_URL_PARSER = /[\u0000-\u0020\u007f]/g;

/**
 * Whether a link or image may keep its destination.
 *
 * `marked` escapes whatever this returns into the attribute, so a `false` here
 * becomes `href=""` — an inert, still-visible link — rather than removed markup.
 */
function isSafeDestination(href: string): boolean {
  return SAFE_SCHEME.test(href.replace(IGNORED_BY_URL_PARSER, ""));
}

/**
 * A `walkTokens` step, narrowed to the two tokens that carry a destination.
 *
 * The narrowing is a type guard rather than `token.type === "link"` inline
 * because `Tokens.Generic` — `marked`'s catch-all, with an index signature — can
 * carry any `type` string, so an inline check would leave `token.href` typed
 * `any` right where this file is doing security work.
 */
function hasDestination(token: Token): token is Tokens.Link | Tokens.Image {
  return token.type === "link" || token.type === "image";
}

/**
 * The shared instance, exported so a caller that genuinely needs a different
 * configuration can derive one — `.use()` on a copy, never a mutation of this.
 */
export const aiMarkdown = new Marked({
  gfm: true,
  // Defence 1: no raw HTML token, block or inline, ever reaches the output.
  renderer: { html: () => "" },
  // Defence 2: a Markdown destination is not an HTML token, so it survives 1.
  walkTokens(token) {
    if (hasDestination(token) && !isSafeDestination(token.href)) {
      token.href = "";
    }
  },
});

/**
 * AI Markdown → HTML, for `v-html` under `.ai-markdown`.
 *
 * Empty and absent input are `""`, so a caller never has to branch before
 * rendering and a report that does not exist cannot become an empty box.
 *
 * `async: false` is passed explicitly because `parse()` is typed
 * `string | Promise<string>`; it is the overload that narrows to `string`, which
 * is what this instance returns (`walkTokens` above is synchronous, so nothing
 * ever needs awaiting).
 */
export function renderAiMarkdown(
  source: string | null | undefined,
): string {
  if (!source) return "";

  return aiMarkdown.parse(source, { async: false });
}