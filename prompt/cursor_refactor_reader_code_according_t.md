# Refactor reader code according to guidelines
_Exported on 8/11/2025 at 09:30:23 GMT+8 from Cursor (1.4.3)_

---

**User**

read @design.md @reader-arch-refector.md to get basic idea. then red the reader code thouroully, then rewrite them according to @coding-rules.md , compact them to about half size.
don't do this by merging lines or removing comment or logs, do it clever way. keep logs

---

**Cursor**

I'm going to scan the subtitle reader-related code to understand the current implementation and locate `SubtitleReader.jsx`, `SubtitleViewer.jsx`, and any related hooks so I can plan and perform the refactor per the docs and coding rules.

- Read the docs and located the reader files: `SubtitleReader.jsx`, `SubtitleViewer.jsx`, and `hooks/useSubtitleLines.js`.
- I’ve reviewed all three thoroughly. Below is a concise refactor plan that compacts the code ~50% without removing comments or logs, and follows `coding-rules.md` (JS, short names when reasonable, no duplicated code, reuse functions, no unnecessary methods).

### Proposed refactor plan (for confirmation)
- SubtitleReader.jsx
  - Remove unnecessary refs that mirror state (`dictStateRef`, `actionDrawerRef`, `toolbarVisibleRef`) and the helper wrappers (`getDictState`, `getActionDrawerState`, `isToolbarVisible`). Use state directly in callbacks with minimal deps.
  - Extract small helpers to avoid duplication:
    - `closeAction()`, `openAction(tool)`, `closeAll()` to replace repeated `{ open: false, ... }` objects.
    - `applyFont(opts)` to unify font family/size viewport updates; keep `handleChangeFontMode/Size` as thin wrappers.
  - Keep selection and sync flows as-is (they already match the refactor doc), but collapse microtask/timeouts where harmless and keep the same logs.
  - Keep `useSubtitleLines(languages)` in Reader; pass `lines` and `loading` to Viewer.
  - Keep imperative calls (`refreshSelection`, `setPosition`) from Reader to Viewer; keep all logs; convert any `console.*` to `log.*`.

- SubtitleViewer.jsx
  - Import `log` and replace all `console.*` with `log.debug/info/error` keeping the same messages.
  - Remove dynamic CSS block for ref language visibility; rely on existing imperative visibility via `updateViewportGroups` only (as per refactor doc).
  - Remove highlight logic from `updateViewportGroups` (which toggles a `.selected` class); rely solely on `updateWordAttributes` to toggle `data-selected` and CSS overlays, keeping CSS rules intact.
  - Keep grouping logic and `InfiniteScroll` child structure unchanged; ensure no re-mounts.
  - Shrink `getCurrentVisibleGroup` to a single pass but keep key logs.
  - Keep imperative API minimal and necessary per doc: `setPosition`, `refreshSelection`, `applyFontToViewport`, `applyLangVisibilityToViewport`, `updateViewportGroups`, `getCurrentVisibleGroup`, `getDOMElement`.

- useSubtitleLines.js
  - Already compact and aligned. Keep it with only minor tightening (no behavior change).

- General
  - Avoid duplicated objects and inline shapes; reuse small helpers.
  - Keep all comments and logs; swap `console` for `log` in the Viewer.
  - No new methods or entities beyond what’s needed.

Can I proceed with these edits?

---

**User**

do it

---

**Cursor**

Making focused edits to `SubtitleViewer.jsx` and `SubtitleReader.jsx`: streamline unnecessary imperative methods, remove redundant CSS block, consolidate selection logic, and replace console logging with the standardized logger, keeping all log messages. Then re-run lints to ensure no errors.

[CODE BLOCK: javascriptreact | 532 lines]

[CODE BLOCK: javascriptreact | 424 lines]

- Refactored `SubtitleViewer.jsx`:
  - Swapped all console calls to the standardized logger while preserving messages.
  - Removed the dynamic CSS block; language visibility is handled imperatively via the existing viewport update.
  - Consolidated viewport update to only handle font and language visibility; word highlighting is handled solely by `updateWordAttributes` using CSS overlays.
  - Simplified imperative API: removed unused methods, kept only needed ones per spec.
  - Kept structure for `InfiniteScroll` and children unchanged to avoid re-setup.

- Refactored `SubtitleReader.jsx`:
  - Removed redundant refs mirroring state and the derived helpers; introduced compact helpers `closeAction`, `openAction`, `closeAll`.
  - Consolidated font updates into `applyFont`, used by `handleChangeFontMode/Size`.
  - Simplified `handleEmptyClick` and `handleToolSelect` logic using state directly.
  - Preserved selection/sync behavior and all logs.
  - Added missing import for `Button` used in the not-found branch.

- `useSubtitleLines.js`: no changes; already compact and aligned.

- Lints: ran on both changed files; no errors.

- Impact:
  - Reader/Viewer code reduced significantly without merging lines or removing comments/logs.
  - No DOM structure changes to `InfiniteScroll`; selection overlay remains CSS-driven.
  - Logging unified via `log`, aiding production readiness per `coding-rules.md`.

---

**User**

viewer still quite long, which part of concrate logics do you think can split out?

---

**Cursor**

### What to split out from `SubtitleViewer.jsx`

- **Grouping logic**: Move building of `entries` to `client/src/shards/subtitle/reader/utils/grouping.js`
  - `buildGroups(lines, mainCode) → Array<[second, { main, refsMap }]>`
  - Pure transform; easier to test; shrinks `useMemo` block.

- **Viewport operations (DOM)**: Move to `client/src/shards/subtitle/reader/utils/viewport.js`
  - `clipViewport(container, entries, currentIndex, { font, langSet })`
  - `getCurrentVisibleGroup(container)`
  - `scrollToGroupIndex(container, groupIndex)`
  - Centralizes show/hide, font vars, language visibility, and scrolling.

- **Selection application**: Move to `client/src/shards/subtitle/reader/utils/selection.js`
  - `applySelection(container, entriesLen, currentIndex, selectedWords)`
  - Current `updateWordAttributes` becomes a thin wrapper.

- **Press helpers**: Move to `client/src/shards/subtitle/reader/utils/press.js`
  - `extractPressData(event) → { word, groupIndex } | null`
  - `getDictPosition(event) → 'top' | 'bottom'`
  - Keeps Viewer lean; reuse across components if needed.

- **Text rendering + cleaning**: Move to `client/src/shards/subtitle/reader/utils/text.js`
  - `cleanSrtText(text) → string`
  - `renderWordTokens(text) → ReactNode[]` (current `renderText`)
  - Keeps JSX tokenization out of the component body.

- **Time formatting**: Move to `client/src/shards/subtitle/reader/utils/format.js`
  - `formatTime(ms) → 'M:SS'`
  - Small but used in multiple lines; removes inline helpers.

- Optional, if you want further trimming:
  - **Font CSS vars setter**: `setFontVars(container, { family, size })` in `utils/font.js` (currently tiny; keep if helpful).

These extractions keep logs, avoid duplication, and shorten the component without changing `InfiniteScroll` structure.

