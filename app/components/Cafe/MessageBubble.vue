<script lang="ts">
/**
 * The poll payload arrives inside `ICafeTableMessage.text` as JSON, which the
 * shared type cannot describe without becoming a shape the backend has not
 * promised. It is therefore typed here, next to the only component that reads
 * it — exported from this file (an SFC needs the plain `<script>` block for a
 * named export) rather than added to `app/types/cafe.ts`, which belongs to the
 * data layer.
 */

/** One rendered choice: its label, its votes, its share of them. */
export interface ICafePollOption {
  label: string;
  /** Votes held, or `null` when the payload carries no counts at all. */
  votes: number | null;
  /** 0–100. Meaningless — and drawn as no fill at all — when `votes` is null. */
  percent: number;
}

/** A poll that survived parsing. `question` is empty when the payload had none. */
export interface ICafePoll {
  question: string;
  options: ICafePollOption[];
}
</script>

<script setup lang="ts">
import type { ICafeThreadMessage } from "~/types/cafe";

/**
 * One message as Screen B draws it.
 *
 * ## `own` IS THE WHOLE DECISION
 *
 * `own` is a plain boolean on purpose: the alternative — passing `myId` and
 * letting the bubble compare ids — moves a question about *identity* into a
 * component that has no way to answer it correctly when the auth store and the
 * socket disagree about which id is the reader's, and produces a wrong-coloured
 * bubble instead of an obvious bug. One boolean, resolved once, by the caller
 * that already knows. `own === true` means **black bubble**, and in this app's
 * hard-coded RTL that places it on the physical LEFT.
 *
 * ## ⚠️ THE INLINE EDIT LIVES HERE, AND THE MESSAGES IT IS ABOUT ARE `ICafeThreadMessage`
 *
 * `ICafeTableMessage` describes what the history returns; a row this client is
 * holding may additionally be `sending`, `failed` or `provisional` and may have
 * no `sequence`, no `senderId` and no `status` yet. Those are the only fields
 * the edit affordance and the state chips below read, and every one of them is
 * nullable, so the props say `ICafeThreadMessage` — the superset — rather than
 * pretending a live bubble is a persisted message.
 *
 * ## ⚠️ EDIT IS **INLINE**, NOT A SHEET
 *
 * Doc §7 lists «ویرایش» in the context menu, and this bubble is what that row
 * turns on: the menu emits one `edit` intent and the parent switches this bubble
 * into its editor. The reason is the reader's own history — a «ویرایش» that
 * opened a sheet over a screen with thirty messages above and below it would
 * hide the very message being edited, and §12's edit is a single sentence of
 * text, which is a one-field form.
 */
const props = withDefaults(
  defineProps<{
    message: ICafeThreadMessage;
    /** True when the reader sent it. Decides the surface, the corner and the side. */
    own: boolean;
    /** Show the sender's avatar in the gutter. Ignored for `own` — see below. */
    showAvatar?: boolean;
    senderName?: string;
    senderImage?: string;
    /**
     * The author of the message this one **quotes**, resolved by the list from
     * `reaplayTo.userId`. Not this message's sender — see the blockquote.
     */
    repliedName?: string;
    /** Consecutive message from the same sender: tighter corner, no avatar. */
    grouped?: boolean;
    /** Epoch ms of "now", forwarded to `CafeMessageTimestamp`. Omit for a static label. */
    now?: number;
    /** This reader is in the message's `like` array. Drawn as a filled heart. */
    liked?: boolean;
    /** `like.length` — the count, because `like` is a flat list of user ids. */
    likeCount?: number;
    /**
     * This device has posted a read receipt covering this message
     * (`cafe.isRead(sequence)`).
     *
     * ⚠️ It is about **this client** and nothing else — §8 carries one `seen`
     * number per table per user — so it is drawn on the reader's own messages
     * only. A tick on somebody else's bubble would be a claim about another
     * person's reading that no field on the wire supports.
     */
    read?: boolean;
    /** The parent switched this row into its editor (the menu's «ویرایش»). */
    editing?: boolean;
    /** The edit request is in the air. Blocks a second save. */
    savingEdit?: boolean;
    /** The last edit was refused. The editor stays open and says why. */
    editError?: string | null;
  }>(),
  {
    showAvatar: false,
    senderName: "",
    senderImage: "",
    repliedName: "",
    grouped: false,
    liked: false,
    likeCount: 0,
    read: false,
    editing: false,
    savingEdit: false,
    editError: null,
  },
);

const emit = defineEmits<{
  /** Save. Enter saves; Escape cancels. */
  edit: [text: string];
  /** Cancel the editor — Escape, or the «انصراف» row. */
  cancelEdit: [];
  /**
   * The heart was pressed. The bubble owns no request: it flips on the props the
   * store hands down and asks the screen to send, exactly as it asks the screen to
   * run the edit.
   */
  like: [];
}>();

/**
 * ## THE TWO INKS
 *
 * - **Outgoing** is `bg-x-text-title` (`#262626`) with white text: the nearest
 *   black the project already owns, and the same token as the mic button and the
 *   unread badge, so «this side is mine» is one colour across the screen.
 * - **Incoming** is `bg-x-primary-content-50` (the project's white) with
 *   `text-x-text-body` (`#292524`) — both are body-ink tokens rather than
 *   `bg-white`/`text-black`, so the two bubbles sit inside the palette instead
 *   of beside it.
 *
 * The incoming bubble needs its `border-slate-100` hairline: white on the very
 * light gray thread reads as a hole on an OLED phone in daylight without an
 * edge. The outgoing one does not, being dark on light either way round.
 */
const SURFACE = {
  own: "bg-x-text-title text-white",
  other:
    "bg-x-primary-content-50 text-x-text-body border border-slate-100",
} as const;

const surfaceClass = computed(() =>
  props.own ? SURFACE.own : SURFACE.other,
);

/**
 * The corner nearest the sender's next message is the one that loses its radius.
 * `rounded-ee` / `rounded-es` are logical: in RTL they are the bottom-left and
 * bottom-right corners, which is the mirroring the reference's LTR mockup would
 * have drawn without anyone hard-coding a `left`/`right`.
 */
const cornerClass = computed(() => {
  if (props.grouped) return props.own ? "rounded-ee-2xl" : "rounded-es-2xl";

  return props.own ? "rounded-ee-xl" : "rounded-es-xl";
});

/** A deleted message has no body left to render, only the fact of its absence. */
const isDeleted = computed(() => props.message.status === "deleted");

/**
 * ## `voice` AND `audio` ARE TWO DIFFERENT THINGS, NOT ONE CARD
 *
 * The upload endpoint maps a file's **extension** onto the message type
 * (`docs/Cafe-Api-Docs.md`, the «نگاشت پسوند → `type` پیام» table):
 * `.ogg` → `voice`, `.mp3` → `audio`. So `voice` is a voice note — someone held
 * the record button and said something — and `audio` is a music track somebody
 * picked and attached, which arrives with artwork and a title and is meant to
 * look like a record sleeve.
 *
 * Merging them into one waveform (which is what this file used to do, and what
 * the note above it used to claim) said «somebody said this» about a song, and
 * made a thread carrying both impossible to read. Two branches, two cards.
 */
const isVoice = computed(() => props.message.type === "voice");
const isTrack = computed(() => props.message.type === "audio");

const bodyText = computed(() => props.message.text ?? "");

/**
 * ⚠️ A SOFT-MODERATED MESSAGE IS DRAWN WITH THE **SERVER'S** CENSORED TEXT.
 *
 * §11 stores a censored body and holds the message for a moderator; that is an
 * accepted send, not a refusal. This client keeps no word list of its own and has
 * no business censoring somebody's words a second time — so the two are separate
 * branches rather than a filter, and a `report` block cannot empty a bubble that
 * is perfectly readable.
 *
 * `mediaCaption`, `fallbackText` and the plain-text branch all read THIS, so a
 * censored caption under a photo is censored the same way the body is.
 */
const displayText = computed(() => {
  const censored = props.message.report?.censoredText;

  return typeof censored === "string" && censored !== "" ? censored : bodyText.value;
});

/** Media whose file never arrived must say so rather than draw an empty bubble. */
const fallbackText = computed(() =>
  displayText.value.trim().length > 0
    ? displayText.value
    : "محتوای این پیام در دسترس نیست",
);

const mediaUrl = computed(() => props.message.file?.mainUrl ?? "");
/** `thubmnail` is the backend's spelling; it stays until the API is renamed. */
const thumbnailUrl = computed(
  () => props.message.file?.thubmnail || mediaUrl.value,
);

/**
 * The music card's artwork — read from `thubmnail` and from **nothing else**.
 *
 * Deliberately not `thumbnailUrl`, which falls back to `mainUrl`: for a track
 * `mainUrl` is the `.mp3` itself, and `<img src="…/notif.mp3">` is a broken image
 * sitting in the one slot whose entire job is to look like a sleeve. A track
 * whose upload carried no artwork therefore gets the drawn fallback rather than
 * a torn photograph.
 */
const coverUrl = computed(() => props.message.file?.thubmnail || "");

/** The track's name. No text means no title line, not a placeholder for one. */
const trackTitle = computed(() => bodyText.value.trim());

/**
 * The card's second line, and the only thing below `ICafeTableMessageFile` that
 * can honestly fill it.
 *
 * There is no artist, no album and no duration on the file — only the MIME type
 * the upload stored — so the container is dropped (`audio/mpeg` → «MPEG») and
 * what remains is what a sleeve prints anyway. A track with no `fileType` has
 * no second line: an empty `<p>` under a title is a layout bug, and «موسیقی»
 * under a track named «آهنگ» says nothing the eye did not already read.
 */
const trackSubtitle = computed(() => {
  const type = props.message.file?.fileType?.trim() ?? "";
  if (type === "") return "";

  const parts = type.split("/");

  return (parts[1] ?? parts[0] ?? "").toUpperCase();
});

/** U+06F0..U+06F9, and U+0660..U+066F for an Arabic-keyboard author. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * `mm:ss` / `h:mm:ss` as a **bare token**, in any of the three digit blocks this
 * app can be handed. Anchored at both ends on purpose: a caption reading
 * «جلسهٔ بعد ساعت ۱۲:۳۰» mentions a clock, not a running time, and a duration
 * chip that appeared on it would be a claim about a video nobody timed. The
 * chip is therefore only ever drawn from a caption that is **nothing but** a
 * duration — see `videoDuration`.
 */
const DURATION_TOKEN = /^(?:[0-9۰-۹٠-٩]{1,2}:){1,2}[0-9۰-۹٠-٩]{2}$/;

/**
 * ## WHY THE **WHOLE** CAPTION IS TESTED, AND NOT ONE WORD AT A TIME
 *
 * The word this used to be built from made its own promise and broke it. Testing
 * each whitespace-separated token finds «۱۲:۳۰» inside «جلسهٔ بعد ساعت ۱۲:۳۰», so
 * a sentence about next Tuesday's meeting drew a duration chip — a claim about a
 * video nobody timed — and the sentence itself was consumed into the chip and
 * never shown. Anchoring is the contract; testing the whole trimmed caption is
 * what honouring it looks like.
 *
 * So the two answers are exclusive, and `mediaCaption` below is the other half
 * of that rule: a caption that is only a duration becomes the chip and no line,
 * and a caption with a single clock in it stays a caption and draws no chip.
 *
 * `ICafeTableMessageFile` has **no `duration` field** and inventing one on the
 * shared type would be a shape the backend has never promised. So the chip is
 * read out of the caption — the one place a uploader's timing genuinely reaches
 * the client. A missing chip is a small absence; a fabricated «۰۰:۰۰» would be a
 * lie about a real file.
 */
const videoDuration = computed(() => {
  if (props.message.type !== "video") return "";

  const caption = bodyText.value.trim();

  return DURATION_TOKEN.test(caption) ? toPersianDigits(caption) : "";
});

/**
 * Every digit block collapsed onto Persian, so the chip carries the same digits
 * as the clock printed under the bubble. `faNumber` cannot do this: it formats a
 * *number*, and `۱:۲۳` is not one.
 */
function toPersianDigits(value: string): string {
  return value.replace(/[0-9۰-۹٠-٩]/g, (glyph) => {
    const ascii = "0123456789".indexOf(glyph);
    const persian = PERSIAN_DIGITS.indexOf(glyph);
    const arabic = ARABIC_INDIC_DIGITS.indexOf(glyph);

    if (ascii >= 0) return PERSIAN_DIGITS[ascii] ?? glyph;
    if (persian >= 0) return glyph;

    return arabic >= 0 ? (PERSIAN_DIGITS[arabic] ?? glyph) : glyph;
  });
}

/**
 * ## THE SENTENCE THE SENDER TYPED UNDER A PHOTO OR A CLIP
 *
 * `message.text` on a media message is not a filename, it is what somebody
 * wrote while attaching — and this bubble used to render the media and drop it,
 * so a photo with a paragraph under it lost the paragraph. It is drawn here, once,
 * for every media branch that draws a picture.
 *
 * Two rules it obeys:
 *
 * - **Trimmed, and drawn only when something is left.** An empty `text` is a
 *   media message sent without a word, and an empty `<p>` under a picture is a
 *   layout bug rather than a caption.
 * - **A caption that is nothing but a duration is not a caption.** It has become
 *   the chip (`videoDuration`), and printing it a second time as a line would put
 *   the same «۱:۲۳` on the bubble twice. Everything else, including a sentence
 *   that merely mentions a clock, is prose and is printed as prose.
 *
 * The voice note below deliberately has no caption line at all — see the note on
 * that branch — so `mediaCaption` is not used there.
 */
const mediaCaption = computed(() => {
  const caption = displayText.value.trim();

  if (caption === "") return "";
  if (videoDuration.value !== "") return "";

  return caption;
});

const replyQuote = computed(
  () => props.message.reaplayTo?.text?.trim() ?? "",
);

/** `reaplayTo` and `messageEdited` are both nullable/empty in practice. */
const wasEdited = computed(
  () =>
    Array.isArray(props.message.messageEdited) &&
    props.message.messageEdited.length > 0,
);

/**
 * ## WHY THE WAVEFORM IS SEEDED, NOT RANDOM
 *
 * `Math.random()` in a render draws one waveform on the server and another on
 * the phone, and Vue patches the difference as a flash. The bars are therefore
 * derived from the message id with FNV-1a: the same audio message always draws
 * the same shape, on every machine, forever.
 *
 * **One seeder, two cards.** The voice note and the music track share this
 * helper rather than each growing their own: the argument for a seeded shape is
 * a property of *rendering*, not of the message type, and a second identical
 * hash loop is a second place for SSR and hydration to disagree.
 */
const WAVE_BARS = 26;
const WAVE_MIN = 8;
const WAVE_SPAN = 20;

function waveform(seed: string): number[] {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: WAVE_BARS }, (_, index) => {
    hash = Math.imul(hash ^ (index + 1), 16777619);
    const ratio = (hash >>> 0) / 4294967295;

    return WAVE_MIN + Math.round(ratio * WAVE_SPAN);
  });
}

const bars = computed(() => waveform(props.message.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * The poll lives on its own `poll` field — and the API's poll carries **no vote
 * counts per option** at this stage, only option titles. So:
 *
 * - the field is read first, and its options come back with `votes: null`, which
 *   is what tells the template to draw no bar and print no number rather than
 *   print «۰» for something the server never said;
 * - a JSON blob inside `text` is the defensive second reading, for a socket
 *   event that carries the question before the poll is hydrated. Anything that
 *   is neither answers `null` and the bubble falls through to plain text — an
 *   unreadable blob in a bubble would be a worse answer than a sentence.
 */
function readPoll(message: ICafeThreadMessage): ICafePoll | null {
  const payload: unknown = message.poll;

  if (isRecord(payload)) {
    const rawOptions = Array.isArray(payload.options)
      ? payload.options.filter(isRecord)
      : [];

    const options = rawOptions
      .map((option) => ({
        label:
          readText(option.title) ||
          readText(option.label) ||
          readText(option.text) ||
          readText(option.description),
        votes: null as number | null,
      }))
      .filter((option) => option.label.length > 0);

    if (options.length > 0) {
      return {
        question:
          readText(payload.title) ||
          readText(payload.description) ||
          readText(payload.body),
        options: withShares(options),
      };
    }
  }

  return parsePollFromText(message.text ?? "");
}

/** Cheap first gate: no message body this feature sends begins with a brace. */
function parsePollFromText(raw: string): ICafePoll | null {
  if (!raw.trimStart().startsWith("{")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const rawOptions = Array.isArray(parsed.options)
    ? parsed.options.filter(isRecord)
    : [];

  const options = rawOptions
    .map((option) => {
      // The backend has spelled the tally both ways across message types, so
      // `votes` is asked first and `count` is the fallback rather than a guess.
      const votes = readCount(option.votes);

      return {
        label:
          readText(option.label) ||
          readText(option.title) ||
          readText(option.text),
        votes: votes > 0 ? votes : readCount(option.count),
      };
    })
    .filter((option) => option.label.length > 0);

  if (options.length === 0) return null;

  return {
    question:
      readText(parsed.question) ||
      readText(parsed.title) ||
      readText(parsed.description),
    options: withShares(options),
  };
}

/**
 * Fills the share of each option from the counts that ARE present, and leaves
 * every share at 0 when none are — an empty track is the honest drawing of «we
 * were not told how anyone voted».
 */
function withShares(options: {
  label: string;
  votes: number | null;
}[]): ICafePollOption[] {
  const total = options.reduce(
    (sum, option) => sum + (option.votes ?? 0),
    0,
  );

  return options.map((option) => ({
    ...option,
    percent:
      option.votes === null || total === 0
        ? 0
        : Math.round((option.votes / total) * 100),
  }));
}

const poll = computed<ICafePoll | null>(() => readPoll(props.message));

/**
 * `submitted-for-review` and `suspended` are states a message is **in**, not
 * filters that remove it: it is still in the history and still belongs in the
 * thread, so it renders with a warning instead of disappearing. Only `deleted`
 * loses its body.
 */
const moderation = computed(() => {
  const status = props.message.status;
  if (status === "submitted-for-review") return "در انتظار تأیید";
  if (status === "suspended") return "متوقف شده";

  return "";
});

/* ------------------------------------------------------- client-only states -- */

/**
 * The three states a row can be in that the SERVER does not know about, because
 * they are statements about this client and about a request that is still in the
 * air. They are drawn, never hidden: a message the reader believes they sent and
 * cannot see is the single worst state a messenger can be in, so every one of
 * these says plainly what is true.
 *
 * - `sending` — the REST 201 has not landed. §11's 200–600 ms is the window.
 * - `failed` — the request was refused. **The row stays** (the store's own rule):
 *   a message the reader believes they sent must never vanish without saying so.
 * - `provisional` — somebody's broadcast arrived and no history read has
 *   reconciled it yet. It has no `sequence`, which is exactly why it draws
 *   quietly and why nothing may order it by time. §14.1 lets it carry
 *   `senderId`/`createdAt` and they are read when present — what it may NEVER
 *   carry is a `sequence`, or the row would claim a place in the transcript
 *   before the transcript has one.
 */
const isSending = computed(() => props.message.sending === true);
const isFailed = computed(() => props.message.failed === true);

/** ⚠️ MUTUALLY EXCLUSIVE WITH THE OTHER TWO, and checked in that order. */
const isProvisional = computed(
  () => props.message.provisional === true && !isSending.value && !isFailed.value,
);

/* ------------------------------------------------------------------- likes -- */

/**
 * §9's `like` is a flat list of user ids, so `like.length` IS the count and
 * `like.includes(myId)` is the state. The list resolves both and hands them over
 * as plain values, for the same reason `own` is a boolean: a bubble guessing
 * identity is a wrong-coloured bubble.
 *
 * The count carries the «پسند» word at every figure, so a single like does not read
 * as a bare «۱» and a large one does not need the reader to guess what is counted.
 */
const likeLabel = computed(() => {
  if (props.likeCount <= 0) return "";

  return props.likeCount === 1
    ? `${faNumber(1)} پسند`
    : `${faNumber(props.likeCount)} پسند`;
});

/**
 * ⚠️ THE HEART'S **ACCESSIBLE NAME**, and it is assembled here rather than handed
 * to `aria-label`.
 *
 * `aria-label` **overrides** the element's own content in the accessible-name
 * calculation, so the label this button used to carry deleted everything inside
 * it from the announcement: both the visible «۳ پسند» and the `sr-only` sentence
 * beside it. A toggle whose count a screen reader could not read is not a toggle —
 * and nothing on screen looked wrong, because the label still worked for every
 * button that has no content of its own.
 *
 * ⚠️ **THE NAME IS THE ACTION, NOT THE STATE.** This is a toggle button, and a
 * toggle's name is what pressing it DOES — «پسندیدن پیام» while it is off,
 * «برداشتن پسند» once it is on — because `aria-pressed` is already announcing the
 * state in its own right. Restating that state inside the name («شما این پیام را
 * پسندیده‌اید») says the same thing twice and names no action at all, which is
 * what a label like «پسندیده‌شده» leaves a reader with.
 *
 * The count is folded in here rather than left to the visible one, because that
 * one is `aria-hidden` so the count would otherwise be announced twice.
 */
const likeName = computed(() => {
  const action = props.liked ? "برداشتن پسند" : "پسندیدن پیام";

  return props.likeCount > 0 ? `${action} — ${likeLabel.value}` : action;
});

/* -------------------------------------------------------------- inline edit -- */

/**
 * §11's `MESSAGE_TEXT_MAX`, written here because `stores/cafe.ts` does not export
 * it. The screen holds the same figure and hands it to the composer; a component
 * the screen cannot reach a module constant from states its own copy, and a cap the
 * editor states is better than one it silently does not.
 */
const EDIT_TEXT_MAX = 2000;

const draft = ref("");
const editor = useTemplateRef<HTMLTextAreaElement>("editor");

/** `editing` is the PARENT's decision; the draft is this bubble's own. */
watch(
  () => props.editing,
  (editing) => {
    if (!editing) return;

    // ⚠️ The draft starts from the text on screen, never from `message.text`
    // directly: for a soft-moderated message the two differ, and an editor that
    // opened on the uncensored words would show the reader text the transcript
    // deliberately is not showing.
    draft.value = displayText.value;

    void nextTick(() => {
      editor.value?.focus();
      editor.value?.setSelectionRange(draft.value.length, draft.value.length);
    });
  },
);

/** The store refuses a blank or an over-long edit; the editor says so first. */
const editTooLong = computed(() => draft.value.length > EDIT_TEXT_MAX);
const canSaveEdit = computed(
  () =>
    !props.savingEdit &&
    !editTooLong.value &&
    draft.value.trim() !== "" &&
    draft.value !== displayText.value,
);

function saveEdit(): void {
  if (!props.editing || !canSaveEdit.value) return;

  emit("edit", draft.value);
}

/**
 * Enter saves, Shift+Enter and Escape do not.
 *
 * ⚠️ `isComposing` is the Persian IME guard, and it matters here exactly as it
 * does in `ComposerShell`: the first Enter on a half-typed Persian word ACCEPTS
 * the composed letter, and saving on that keystroke would store a broken word
 * and close the editor under the reader's hands.
 */
function onEditKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();

    // ⚠️ NOT WHILE THE SAVE IS IN THE AIR. The request has left; closing the editor
    // now would hide the row that is about to change and leave a reader pressing
    // Escape again on a message that is no longer being edited.
    if (!props.savingEdit) emit("cancelEdit");
    return;
  }

  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;

  event.preventDefault();
  saveEdit();
}

</script>

<template>
  <!--
    A deleted message keeps its side so the thread's rhythm does not jump, but
    drops the bubble: drawing an empty card where a message was would read as a
    rendering failure rather than as a deletion.
  -->
  <div
    v-if="isDeleted"
    class="flex w-full"
    :class="own ? 'justify-end' : 'justify-start'"
  >
    <p
      class="max-w-4/5 rounded-2xl bg-x-primary-content-200 px-3 py-2 text-xs text-x-text-subtitle"
    >
      این پیام حذف شده است
    </p>
  </div>

  <div
    v-else
    class="flex w-full items-end gap-2"
    :class="own ? 'justify-end' : 'justify-start'"
  >
    <!--
      The avatar belongs to the *other* side only: the reader already knows which
      messages are theirs, so a second copy of their own face in the gutter is
      the one column that could never carry information.
    -->
    <CafeAvatar
      v-if="showAvatar && !grouped && !own"
      :src="senderImage"
      :name="senderName"
      size="sm"
      class="mb-5"
    />

    <!--
      `max-w-4/5` leaves the screen edge readable: a bubble that touches both
      edges stops being a shape. `items-end`/`items-start` put the timestamp
      under the bubble's outer corner, which is the mirroring the reference
      draws.
    -->
    <div
      class="flex min-w-0 max-w-4/5 flex-col gap-1"
      :class="own ? 'items-end' : 'items-start'"
    >
      <!--
        ## THE HEADER NAMES THE **QUOTED** AUTHOR, NOT THE REPLIER

        `senderName` is whoever sent *this* message, so printing it here put
        «آرش» directly above نگار's words — a lie on every reply on screen, and a
        quiet one, because the avatar and the side of the bubble both still lined
        up. `repliedName` is the roster's answer for `reaplayTo.userId`, and the
        backend does not always send that id, so «پیام» stands in: an unlabelled
        quote is a smaller wrong than one attributed to the wrong person.
      -->
      <blockquote
        v-if="replyQuote"
        class="w-full rounded-2xl bg-x-primary-content-200 px-3 py-2"
      >
        <p class="line-clamp-1 text-xs font-bold text-x-text-subtitle">
          {{ repliedName || "پیام" }}
        </p>
        <p class="line-clamp-2 text-xs text-x-text-subtitle">
          {{ replyQuote }}
        </p>
      </blockquote>

      <!--
        ## THE INLINE EDITOR, AND WHY IT REPLACES THE BUBBLE RATHER THAN FLOATING OVER IT

        One field, one save, one cancel. §12's edit is a single sentence of text, and
        a sheet over a screen with thirty messages above and below would hide the
        very message being edited.

        ⚠️ `w-full` rather than `max-w-4/5`: the editor is a working surface, and
        capping it at four fifths of the screen would wrap a sentence the reader is
        editing into a narrower column than the sentence they are correcting. It
        stays inside the same flex column, so it is still on the message's own side.

        The surface is white with an `x-primary` ring rather than the bubble's own
        ink: it is an INPUT, not a message, and drawing it as an outgoing black
        bubble would say «this is what it will look like» while the reader is still
        typing it.
      -->
      <div
        v-if="editing"
        class="w-full rounded-3xl border border-x-primary-500 bg-white p-2"
      >
        <textarea
          ref="editor"
          v-model="draft"
          :rows="3"
          :maxlength="EDIT_TEXT_MAX"
          aria-label="ویرایش متن پیام"
          class="w-full resize-none rounded-2xl bg-transparent p-2 text-sm leading-7 text-x-text-body focus:outline-none"
          @keydown="onEditKeydown"
        />

        <!--
          The refusal is drawn inside the editor, beside the button that caused
          it. Nothing above is disabled while it shows: the point is that the
          reader can fix the sentence and try again with the words they wrote.
        -->
        <p
          v-if="editError"
          role="alert"
          class="rounded-2xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700"
        >
          {{ editError }}
        </p>

        <p
          v-else-if="editTooLong"
          role="alert"
          class="rounded-2xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700"
        >
          متن پیام نمی‌تواند بیش از {{ faNumber(EDIT_TEXT_MAX) }} نویسه باشد.
        </p>

        <!--
          `min-h-11` on both rows, for the reason every control on this screen is
          44px: the reader is typing with one hand and the save is the one control
          they must hit without looking.
        -->
        <div class="mt-1 flex items-center gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="x-primary"
            label="انصراف"
            :disabled="savingEdit"
            class="min-h-11 flex-1"
            :ui="{ base: 'min-h-11 rounded-full text-xs font-bold' }"
            @click="emit('cancelEdit')"
          />

          <UButton
            type="button"
            variant="solid"
            color="x-primary"
            label="ذخیره"
            :disabled="!canSaveEdit"
            :loading="savingEdit"
            class="min-h-11 flex-1"
            :ui="{ base: 'min-h-11 rounded-full text-xs font-bold' }"
            @click="saveEdit"
          />
        </div>
      </div>

      <div
        v-else
        class="min-w-0 rounded-3xl px-3.5 py-2.5"
        :class="[surfaceClass, cornerClass]"
      >
        <p
          v-if="message.type === 'text'"
          class="text-sm leading-7 whitespace-pre-wrap break-words"
        >
          {{ displayText }}
        </p>

        <!--
          ## THE CAPTION IS DRAWN UNDER THE MEDIA, NOT INSTEAD OF IT

          Both media branches are wrapped rather than drawn as a bare `<img>` /
          `<video>`, because `message.text` on a photo is the sentence the sender
          wrote while attaching it, and this bubble used to render the picture and
          drop that sentence on the floor. The wrapper is `w-full` so the caption
          measures its width against the media rather than against the bubble's
          own intrinsic one, and `mt-2` is the only gap between the two.

          `opacity-75` is the file's existing idiom for a second line (the track's
          MIME subtype, the file's type) and it is doing a job here: the media is
          the subject and the caption is the note, so the note is drawn quieter
          than the thing it describes. It also keeps the caption legible on
          **both** surfaces without a second colour — the bubble's own ink carries
          through, white on `#262626` and `x-text-body` on white, and a hard-coded
          grey would be wrong on one of them.
        -->
        <div
          v-else-if="message.type === 'image' && thumbnailUrl"
          class="w-full"
        >
          <img
            :src="thumbnailUrl"
            alt="تصویر ارسال‌شده در گفتگو"
            loading="lazy"
            decoding="async"
            class="max-h-72 w-full rounded-2xl object-cover"
          />

          <p
            v-if="mediaCaption"
            class="mt-2 text-sm leading-7 whitespace-pre-wrap break-words opacity-75"
          >
            {{ mediaCaption }}
          </p>
        </div>

        <div
          v-else-if="message.type === 'video' && mediaUrl"
          class="w-full"
        >
          <video
            :src="mediaUrl"
            controls
            preload="metadata"
            playsinline
            class="max-h-72 w-full rounded-2xl bg-x-text-title"
          />

          <!--
            Native controls already state the clip's length once the metadata has
            loaded, so this branch draws no chip — the chip below exists for a
            poster, which cannot say anything about itself. A caption that is
            nothing but a duration therefore leaves nothing to print here.
          -->
          <p
            v-if="mediaCaption"
            class="mt-2 text-sm leading-7 whitespace-pre-wrap break-words opacity-75"
          >
            {{ mediaCaption }}
          </p>
        </div>

        <!--
          ## THE POSTER IS A STATE, NOT A SUBSTITUTE

          This branch sits AFTER the `<video>` above and never replaces it: the
          moment the real API hands over a `mainUrl` the file plays, with native
          controls, exactly as before.

          What is left for this branch is the window the backend actually opens:
          an upload that has produced its poster but whose transcoded `mainUrl`
          has not landed yet. That is a real half-finished state of a real
          message, not a gap in the fixture — a thread that drew «محتوای این پیام
          در دسترس نیست» for a video the sender genuinely posted would be
          telling the reader a falsehood while the file was still arriving.

          The shape is the one a messenger draws in that window: the poster, a
          centred play glyph, and the length of the clip. The glyph is a real
          `disabled` `<button>` for the same reason the voice note's is — a
          live-looking control that does nothing is a worse lie than an obviously
          inert one, and Phase 1 has no playback to wire.

          `duration` is read from the caption by `videoDuration` because the file
          carries none, and only a caption that is **nothing but** a duration draws
          the chip: a sentence that happens to mention a clock draws the sentence
          (`mediaCaption`) and no chip. The two never both appear.
        -->
        <div
          v-else-if="message.type === 'video' && thumbnailUrl"
          class="w-full"
        >
          <div class="relative">
            <img
              :src="thumbnailUrl"
              alt="تصویر پیش‌نمایش ویدیو"
              loading="lazy"
              decoding="async"
              class="max-h-72 w-full rounded-2xl object-cover"
            />

            <div class="absolute inset-0 grid place-items-center">
              <button
                type="button"
                disabled
                aria-label="پخش ویدیو"
                class="grid size-12 shrink-0 place-items-center rounded-full bg-x-text-title/70 text-white disabled:cursor-not-allowed"
              >
                <UIcon name="solar:play-circle-bold" size="30" aria-hidden="true" />
              </button>
            </div>

            <span
              v-if="videoDuration"
              class="absolute end-2 bottom-2 rounded-full bg-x-text-title/80 px-2 py-0.5 text-xs leading-5 font-medium text-white tabular-nums"
            >
              {{ videoDuration }}
            </span>
          </div>

          <!--
            Outside the `relative` box on purpose: the chip is pinned over the
            poster's own corner, and a caption pinned over a picture would be read
            as part of the picture.
          -->
          <p
            v-if="mediaCaption"
            class="mt-2 text-sm leading-7 whitespace-pre-wrap break-words opacity-75"
          >
            {{ mediaCaption }}
          </p>
        </div>

        <!--
          The voice note, kept exactly as the reference draws it: a record
          button and a seeded waveform, nothing else. This is somebody's own
          voice — a sentence — so it must not borrow a sleeve, a title or a
          length it was never given. See `isVoice` for why `audio` is a
          different card.

          ## WHY IT IS ALSO THE ONE BRANCH WITH NO CAPTION

          `mediaCaption` draws the sender's words under a photo and under a clip,
          and it deliberately does not run here. Those are a **thing sent with a
          sentence about it**, and the sentence is the only extra information the
          media carries; a voice note *is* the sentence, so the two would say the
          same thing twice. Nothing above this branch writes into it either — the
          fixture's own «پیام صوتی ۰:۳۴» is a transcript marker a real sender may
          not type at all.

          The play button is a real `<button>` and it is `disabled`: Phase 1 has
          no playback wired, and a live-looking control that does nothing is a
          worse lie than an obviously inert one. It carries its Persian label so
          a screen-reader user learns what the card is even when it cannot be
          pressed. The bars take the bubble's own ink through `bg-current`,
          which is why no second colour is needed for either side.
        -->
        <div v-else-if="isVoice" class="flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-label="پخش پیام صوتی"
            class="grid size-11 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed"
            :class="
              own
                ? 'bg-x-primary-content-50 text-x-text-title'
                : 'bg-x-primary-100 text-x-primary-800'
            "
          >
            <UIcon name="solar:play-circle-bold" size="28" aria-hidden="true" />
          </button>

          <span class="flex h-8 min-w-32 flex-1 items-center gap-0.5" aria-hidden="true">
            <span
              v-for="(height, index) in bars"
              :key="index"
              class="w-0.5 shrink-0 rounded-full bg-current"
              :style="{ height: `${height}px` }"
            />
          </span>
        </div>

        <!--
          ## THE MUSIC TRACK

          A track is an **attachment somebody chose**, not a sentence somebody
          said, so it is drawn the way a messenger draws one — sleeve on the
          inline start, name, a second line, then a transport row — and never
          like the voice note above.

          - **The sleeve** is `thubmnail` only (see `coverUrl`). Without one the
            card draws a tinted square with a note glyph in it: a `type: "audio"`
            whose upload carried no artwork is ordinary, and an empty hole in
            the corner of every such track is not.
          - **The second line** is the MIME type's subtype, or nothing at all.
          - **The transport row** reuses the voice note's seeded bars through
            the same helper, so both cards wave in one vocabulary, and carries
            the same inert `disabled` button with its own Persian label.

          `min-w-48` is what keeps the card from collapsing to the width of its
          own longest word on a 320px phone; the bubble's own `max-w-4/5`
          still governs the outside, so a track can never take the screen.
        -->
        <div v-else-if="isTrack" class="w-full min-w-48">
          <div class="flex items-center gap-3">
            <div
              class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl"
              :class="
                own
                  ? 'bg-white/15 text-white/90'
                  : 'bg-x-primary-100 text-x-primary-800'
              "
            >
              <img
                v-if="coverUrl"
                :src="coverUrl"
                :alt="trackTitle || 'کاور موسیقی'"
                loading="lazy"
                decoding="async"
                class="size-full object-cover"
              />
              <UIcon
                v-else
                name="solar:music-note-2-bold"
                size="22"
                aria-hidden="true"
              />
            </div>

            <div class="min-w-0 flex-1">
              <p v-if="trackTitle" class="line-clamp-1 text-sm font-bold">
                {{ trackTitle }}
              </p>
              <p v-if="trackSubtitle" class="line-clamp-1 text-xs opacity-75">
                {{ trackSubtitle }}
              </p>
            </div>
          </div>

          <div class="mt-2 flex items-center gap-3">
            <!--
              ## WHY THIS BUTTON IS `size-11` AND NOT `size-9`

              `size-9` is 36px. The floor below which a target is hard to hit
              with a thumb is 44px (Apple's HIG and Material both land there),
              and every other control in this file is already 44 — the voice
              note's play button directly above, this component's own composer
              buttons, `CafeVoiceRecorder`'s three. A screenshot cannot show
              this and a mouse cannot feel it; a thumb on a phone can, and this
              one sits on the far inline-end of a row the reader aims at
              quickly.

              The glyph moves `22 → 28` **with** the box, because the two are
              one decision and splitting them is what would have created a new
              inconsistency: at 22 inside a 44px circle the ink is 18.3px, a
              ratio of 0.50, against 0.64 in the voice card — the same
              `play-circle-bold` at two different visual weights two hundred
              lines apart in one file. Matching it also makes the two cards'
              transport rows the same height (44px against a 32px waveform),
              which is what lets a reader read them as one control.

              The cost is honest: this row is 8px taller than it was, and so is
              the sleeve card. A 44px target is worth 8px.
            -->
            <button
              type="button"
              disabled
              aria-label="پخش موسیقی"
              class="grid size-11 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed"
              :class="
                own
                  ? 'bg-x-primary-content-50 text-x-text-title'
                  : 'bg-x-primary-100 text-x-primary-800'
              "
            >
              <UIcon name="solar:play-circle-bold" size="28" aria-hidden="true" />
            </button>

            <span
              class="flex h-8 min-w-32 flex-1 items-center justify-between gap-0.5"
              aria-hidden="true"
            >
              <span
                v-for="(height, index) in bars"
                :key="index"
                class="w-0.5 shrink-0 rounded-full bg-current"
                :style="{ height: `${height}px` }"
              />
            </span>
          </div>
        </div>

        <div
          v-else-if="message.type === 'file'"
          class="flex items-center gap-3"
        >
          <UIcon
            name="solar:folder-open-linear"
            size="26"
            class="shrink-0 opacity-75"
            aria-hidden="true"
          />
          <span class="min-w-0">
            <span class="line-clamp-1 block text-sm font-bold">
              {{ bodyText || "پیوست" }}
            </span>
            <span class="block text-xs opacity-75">
              {{ message.file?.fileType || "فایل" }}
            </span>
          </span>
        </div>

        <!--
          The poll guard is its own `v-if` rather than a compound condition: the
          payload may parse to nothing, and a bubble for a poll that carries no
          options must say so in words rather than draw an empty card.
        -->
        <template v-else-if="message.type === 'poll'">
          <div v-if="poll" class="w-full min-w-45 space-y-2">
            <p v-if="poll.question" class="text-sm font-bold leading-6">
              {{ poll.question }}
            </p>

            <ul class="space-y-1.5">
              <li
                v-for="(option, index) in poll.options"
                :key="index"
                class="relative overflow-hidden rounded-xl px-3 py-2"
                :class="own ? 'bg-white/10' : 'bg-x-primary-content-200'"
              >
                <!--
                  The fill grows from the inline start, so it fills from the
                  right in RTL — the direction the eye reads. `percent` comes
                  from the payload's own counts; a poll with no votes draws an
                  empty track.
                -->
                <span
                  class="absolute inset-y-0 start-0"
                  :class="own ? 'bg-white/25' : 'bg-x-primary-100'"
                  :style="{ width: `${option.percent}%` }"
                  aria-hidden="true"
                />
                <span class="relative flex items-center justify-between gap-2 text-xs">
                  <span class="line-clamp-1">{{ option.label }}</span>
                  <span
                    v-if="option.votes !== null"
                    class="shrink-0 tabular-nums"
                  >
                    {{ faNumber(option.votes) }}
                  </span>
                </span>
              </li>
            </ul>
          </div>

          <p v-else class="text-sm leading-7 whitespace-pre-wrap break-words">
            {{ fallbackText }}
          </p>
        </template>

        <div
          v-else-if="message.type === 'challange'"
          class="flex items-center gap-3"
        >
          <UIcon
            name="solar:target-linear"
            size="26"
            class="shrink-0 opacity-75"
            aria-hidden="true"
          />
          <p class="text-sm font-bold leading-6">{{ fallbackText }}</p>
        </div>

        <!--
          The last branch is not dead code: it is what an unknown `type` from a
          newer API, or a media message whose `file` never arrived, must show.
        -->
        <p v-else class="text-sm leading-7 whitespace-pre-wrap break-words">
          {{ fallbackText }}
        </p>
      </div>

      <!--
        The meta row: the clock, the states that are words, the like, and — on the
        reader's own side only — the read receipt.

        ⚠️ It sits UNDER the bubble rather than over it, so nothing about a
        message is ever obscured by its own metadata, and it is `flex-wrap` so a
        long thread of words wraps under a 320px phone instead of pushing the
        bubble sideways.
      -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <!--
          ⚠️ A ROW WITH NO `createdAt` HAS NO TIMESTAMP TO PRINT AND IS NOT ASKED FOR
          ONE — `CafeMessageTimestamp` answers nothing for it. §14.1 says a broadcast
          MAY carry `createdAt`, and it is rendered when it does; when it does not,
          the gap below is the honest picture of a message this client has received
          but not yet reconciled.
        -->
        <CafeMessageTimestamp
          :value="message.createdAt"
          :now="now"
          variant="bubble"
        />

        <span v-if="wasEdited" class="text-xs text-x-text-subtitle">
          ویرایش‌شده
        </span>

        <span
          v-if="moderation"
          class="rounded-full bg-x-primary-100 px-2 py-0.5 text-xs text-x-primary-800"
        >
          {{ moderation }}
        </span>

        <!--
          ⚠️ THE THREE CLIENT-ONLY STATES, IN THIS ORDER, and never hidden.

          `sending` — the 201 has not landed (§11's 200–600 ms).
          `failed` — the request was refused. **The row stays**: a message the
          reader believes they sent must never vanish without saying so.
          `provisional` — somebody's broadcast arrived and no history read has
          reconciled it, so it has no `sequence`. It may already carry a
          `senderId`/`createdAt` (§14.1), and when it does they are rendered — it
          draws quietly because it is about to change by itself, not because it is
          anonymous.
        -->
        <span
          v-if="isSending"
          class="flex items-center gap-1 text-xs text-x-text-subtitle"
        >
          <UIcon name="solar:clock-circle-linear" size="14" aria-hidden="true" />
          در حال ارسال
        </span>

        <span
          v-if="isFailed"
          class="flex items-center gap-1 text-xs text-red-600"
        >
          <UIcon name="solar:close-circle-linear" size="14" aria-hidden="true" />
          ارسال نشد
        </span>

        <span
          v-if="isProvisional"
          class="flex items-center gap-1 text-xs text-x-text-subtitle opacity-70"
        >
          <UIcon name="solar:cloud-cross-linear" size="14" aria-hidden="true" />
          در حال دریافت
        </span>

        <!--
          ⚠️ A REAL CONTROL, DRAWN ALWAYS — and both halves of that matter.

          It used to be an inert `<span>` drawn only when somebody had already
          liked the message, which made liking unreachable in the only case where
          there is anything to decide: a message nobody has liked has nothing on
          screen to press. So the heart is now always drawn, a real `<button>`,
          and it emits `like` — the store still flips `like` optimistically, so
          the heart fills on the tap rather than on the answer, and a refusal flips
          it back, which is the same visual contract in reverse. Nothing here has to
          know a request exists.

          ⚠️ **NO `aria-label` ON IT, AND THAT IS DELIBERATE.** A label overrides the
          element's own content in the accessible-name calculation, so one here
          silently deleted the count and the `sr-only` sentence from what a screen
          reader says — while looking perfectly correct to everyone else. The name
          is `likeName`, spoken from the content; `aria-pressed` stays because the
          pressed STATE is not part of a name.

          ⚠️ `@pointerdown.stop` **AND** `@contextmenu.stop`, and closing only the
          first is a bug that only shows on Android. The row around this bubble has
          TWO doors to its menu — a 500 ms press and the native `contextmenu` — so
          stopping the pointer event alone closed one and left the other open: a
          long press on the heart opened the message menu, and no `click` follows a
          long press, so nothing was liked at all. `@click.stop` is the same wall
          for the click the row swallows after its own press.

          `min-h-11` — 44px — is the floor every other control in this feature uses,
          and the one AGENTS.md §8 asks a reviewer to hold the app to. The icon
          carries `aria-hidden` because the button's text is its name. The visible
          count is printed only when there is one — an empty «۰ پسند» under a heart
          is a number nobody asked for — and it is `aria-hidden` so it is not
          announced next to the copy of itself inside `likeName`.
        -->
        <button
          type="button"
          :aria-pressed="liked"
          class="focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-x-primary-500 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs transition-colors hover:bg-x-primary-content-200"
          :class="liked ? 'text-red-500' : 'text-x-text-subtitle'"
          @click.stop="emit('like')"
          @pointerdown.stop
          @contextmenu.stop
        >
          <UIcon
            :name="liked ? 'solar:heart-bold' : 'solar:heart-linear'"
            size="14"
            aria-hidden="true"
          />
          <span v-if="likeCount > 0" aria-hidden="true">{{ likeLabel }}</span>
          <span class="sr-only">{{ likeName }}</span>
        </button>

        <!--
          ⚠️ THE READ RECEIPT IS **THIS CLIENT'S**, ON THE READER'S OWN MESSAGES, AND
          NOWHERE ELSE.

          §8 carries exactly ONE number per table per user (`seen`), and
          `GET /table/:tableId/users` returns user documents rather than participant
          records — so there is no per-sender read state anywhere on the wire, and a
          tick on somebody else's bubble would be a claim about another person's
          reading that this client cannot make. `read` is therefore the list's
          `cafe.isRead(sequence)`: «has THIS device reported this one».

          A single tick before the frontier and a doubled one after it, which is the
          Telegram idiom and is honest here for a second reason — the frontier is a
          high-water mark, so the transition the reader sees is their OWN receipt
          moving, not anybody else's.
        -->
        <span
          v-if="own && !editing"
          class="flex items-center text-x-text-subtitle"
          :aria-label="read ? 'خوانده شد' : 'ارسال شد'"
          role="img"
        >
          <UIcon
            :name="read ? 'solar:verified-check-linear' : 'solar:check-circle-linear'"
            size="16"
            aria-hidden="true"
          />
        </span>

        <!--
          ⚠️ NO RETRY BUTTON, AND THAT IS A DELIBERATE ABSENCE.

          §3.3's rule is that a refused message stays on screen with its text
          rather than vanishing — and it is right. What it does not promise is a
          way to re-send THAT ROW: `cafe.sendMessage` builds a **new** optimistic
          row with a fresh `local:` id, and nothing in the store can reuse or drop
          the failed one. A «تلاش دوباره» control would therefore leave the reader
          with a red «ارسال نشد» bubble *and* a second copy of the same words — two
          rows for one intent, which is a worse picture than no control at all.

          The retry the reader actually gets is the one the screen can offer
          honestly: the composer never cleared the draft on a refusal, so the words
          are still in the field one tap away.
        -->
      </div>
    </div>
  </div>
</template>