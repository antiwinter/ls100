## Subtitle Reader: Architecture Refactor Plan

### Goals
- Clarify ownership and contracts between `SubtitleReader`, `SubtitleViewer`, and toolbar/drawers
- Enable global word highlighting using CSS overlays without re-triggering InfiniteScroll setup
- Keep changes minimal and avoid duplicated logic

### Scope and Principles
- Reader (container) owns data fetching and sync; Viewer is presentational
- Do not change DOM structure that `InfiniteScroll` observes; avoid re-mounts of children
- Highlighting uses CSS only (no new re-renders) and existing `data-selected` attributes

### Changes
- Data ownership
  - Add `useSubtitleLines(subtitleId)` hook under `client/src/shards/subtitle/reader/hooks/useSubtitleLines.js` to fetch `lines` and loading state
  - Move line fetching out of `SubtitleViewer` into `SubtitleReader` via the hook; pass `lines` down as a prop

- Contracts cleanup
  - Remove unused `currentIndex` prop from `SubtitleReader → SubtitleViewer`
  - Expose an imperative method on `SubtitleViewer` ref: `refreshSelection(currentLineIndex)` to force a CSS-attribute refresh after selection loads/changes without re-rendering

- Highlighting (CSS-only)
  - Keep pre-rendered `.word-overlay` spans in each word
  - Keep current behavior: JS sets `data-selected` on in-view word spans by checking against the `selectedWords` Set; CSS reveals overlays:
    - Default hidden: `.word-overlay { opacity: 0 }`
    - Show when selected: `span[data-selected="true"] .word-overlay { opacity: 0.3 }`
  - Multiple words: supported naturally because the Set can hold multiple entries; as occurrences enter the viewport on scroll, their spans get `data-selected` applied without re-rendering or changing children
  - Do not introduce new elements or restructure list items; only adjust CSS rules inside the existing `sx` block of `SubtitleViewer`
  - Do not touch `InfiniteScroll` or child tree; only per-span attributes are toggled

- Sync (unchanged)
  - Keep `useSync` for diffing words and position; continue flushing on unmount and on timer

### File-level edits
- `client/src/shards/subtitle/reader/SubtitleReader.jsx`
  - Use `useSubtitleLines(subtitleId)`; pass `lines` and `loading` to viewer
  - Remove `currentIndex` prop
  - After `loadSelectedWords()`, call `viewerRef.current?.refreshSelection(currentLine - 1 || 0)` once

- `client/src/shards/subtitle/reader/SubtitleViewer.jsx`
  - Remove line-fetching logic and `apiCall` usage
  - Accept `lines` and `loading` as props; keep rendering and `InfiniteScroll` usage the same
  - Keep `updateWordAttributes(currentLineIndex)` logic and wire it to `onScroll`
  - Expose `refreshSelection(currentLineIndex)` via `useImperativeHandle` that calls `updateWordAttributes`
  - Keep CSS highlighting rules only; no structural changes to children

- `client/src/shards/subtitle/reader/hooks/useSubtitleLines.js`
  - New: fetch all lines for `subtitleId`, return `{ lines, loading }`

### Guardrails to avoid InfiniteScroll re-setup
- Do not change the number or nesting of children passed into `InfiniteScroll`
- Keep keys and grouping stable; only pass different `lines` content
- Do not add/remove wrapper nodes around the mapped list

### Acceptance criteria
- Reader loads shard, words, and lines; viewer renders given lines
- Clicking a word highlights all identical words (in and beyond current viewport) via CSS overlays; scrolling preserves highlights
- No console logs of a new IntersectionObserver setup after selection changes (the `🔍 IS setup: 111` should not reappear due to selection/highlighting)
- No duplicated fetching logic; single hook owns subtitle line fetching


