# Task 2 - UI Update for the Stories Section

# Project Overview
We need a story system to display events, and we would like you to design this system.
### Technology => [Vue.js 3.x, Nuxt.js 4.x, Tailwind 4.x, Nuxt UI, Pinia]

# [Summary]
The UI/UX for the Stories section must be designed with a sophisticated, professional look inspired by Instagram.
Initially, only the UI/UX should be designed; integration with the API will take place in the next phase.

### Design Requirements
- Redesign the Story section in the file `@/app/components/Features/Story.vue`
- Create a viewer for story content similar to Instagram

### Functional Requirements
- Stories must display:
- Title
- Profile picture for each story
- Timing
- Pause and stop functionality for timing
- Use Swiper/Vue for story navigation
- Navigation between items within a story and between stories themselves
- Engaging transition animations
- Dark mode interface for the story view (similar to Instagram)
- No comment input functionality
- Smooth performance
- No blur effects
- Support for two types of links: "Simple" (basic link) and "Colorized" (an attractive, UI-based button with hover effects and styling)

# [Rules]
- Stories are displayed to all users
- Design as separate, reusable components

# [Todos]
[x] Analyze Instagram and other designs to standardize UI/UX
[x] Select the best design
[x] Review UI/UX specifications for professional settings
[x] Define professional animations
[x] Design the Story list section
[x] Design the Story viewer section Implement the story items in full-screen mode, similar to Instagram.
[x] Finalize design and conduct final review + type-checking + build
[x] Code review

## Delivered (UI/UX only - API integration is the next phase)
- `app/components/Features/Story.vue` - entry component, keeps `<FeaturesStory />` on the home page
- `app/components/Features/Story/` - `List`, `Card`, `Viewer`, `ViewerHeader`, `ViewerProgress`, `ViewerSlide`, `ViewerCta`, `LinkSimple`, `LinkColorized`
- `app/types/story.ts` - types + `flattenStoryGroups` / `storyItemDuration` / `safeStoryHref` / `safeStoryAccent`
- `app/data/stories.mock.ts` - the single mock source; swapping it for the API is one import line in `Story.vue`
- `app/utils/fa.ts` - additive `faRelative()` for the Persian relative timestamp

**Verification:** `npm run build` exit 0; `npx nuxt typecheck` reports zero errors in this feature
(the 11 remaining errors are pre-existing in `pages/test/active/exam.vue`, `pages/test/index.vue`
and `server/api/wallet/deposit.post.ts`). Security gate: PASS. Code review: PASS.

**Carried to the API phase:** remote `media.src` / `author.avatar` are not host-allow-listed yet, so
`image.domains` must be configured before the backend serves remote media. The `seen` map and the
resume position are in-memory only and are not persisted.

# [Result]
By leveraging all the necessary skills for this section's design,
implement the best possible UI/UX for the user,
resulting in a high-quality story UI/UX system for this app.