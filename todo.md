implement cache in apicall? properly manage 304s

viewer:
short long press [done]

wordlist
text: font, size, refs
search: 


dict: [dict, sentence + AI]
export to eudit


drawer multi page
drawer drag responsive
PWA wizard
login-page, refernal


1) Add dependency
yarn add react-virtuoso
2) Create a generic VirtualScroller
New file: client/src/components/VirtualScroller.jsx
API:
Props: totalCount, itemKey?, itemContent({ index }), onRangeChange?({ startIndex, endIndex }), onStartReached?, onEndReached?, increaseViewportBy?, onScroll?
Ref: scrollToIndex(index, align?), scrollTo(opts), scrollBy(deltaY)
Internals:
Wrap Virtuoso
Wire rangeChanged → onRangeChange, startReached/endReached → onStartReached/onEndReached
Default increaseViewportBy={{ top: 400, bottom: 800 }} (tune later)
3) Refactor SubtitleViewer to use VirtualScroller
Replace InfiniteScroll import/usage with VirtualScroller
Keep the group building logic (entries) as-is
Add a useMemo map lineIndex → groupIndex during entries build for quick seeks
Provide to VirtualScroller:
totalCount = entries.length
itemKey = (i) => entries[i][0] (the second)
itemContent = ({ index }) => render the group UI you already have for entries[index]
onRangeChange = ({ startIndex }) =>
Update progress: onProgressUpdate(startIndex + 1, entries.length)
Update currentLine using the first main line in that group (fallback to nearest)
Refresh selection overlays for the visible range only (optional optimization)
onScroll = (e) => forward to parent (toolbar/drawer behavior)
Remove the manual viewport clipping and IntersectionObserver logic:
Delete updateViewportGroups, getCurrentVisibleGroup, DOM show/hide, and the InfiniteScroll wrapper in viewer
4) Maintain the viewer’s imperative API for backward compatibility
Keep setPosition(lineIndex): compute groupIndex via the map and call virtualScrollerRef.scrollToIndex(groupIndex, 'start')
Keep refreshSelection(lineIndex?): update selected word overlays for currently visible rows only
Keep applyFontToViewport and applyLangVisibilityToViewport as thin wrappers:
Set CSS variables/classes on the viewer root; Virtuoso will remeasure automatically via ResizeObserver
No DOM traversal or manual show/hide; let rows re-render naturally
5) Minimal adjustments in SubtitleReader
Keep existing calls to viewerRef.current.setPosition, refreshSelection, applyFontToViewport, applyLangVisibilityToViewport (they remain supported but simplified)
Update handleScroll/progress: rely on onRangeChange from the viewer (no IntersectionObserver index)
Continue to manage drawers/toolbar as-is
6) Optional: range-based lazy loading
Extend useSubtitleLines to expose ensureRange(startIndex, endIndex) later
In SubtitleViewer, pass handlers to VirtualScroller:
onEndReached/onStartReached → call ensureRange with a sensible window (e.g., ±200)
Keep a simple, eager load for now; flip to lazy when ready
7) Tuning and UX polish
increaseViewportBy: start with { top: 400, bottom: 800 }; adjust for mobile smoothness
Keys: keep itemKey stable (the second timestamp)
Fonts/lang toggles: continue using CSS variables/classes on the container; no React state reflows
Selection overlays: rely on minimal re-render of visible rows; avoid deep DOM scans
8) Clean-up
Leave client/src/components/InfiniteScroll.jsx for other simple lists or mark it deprecated with a header comment
Remove dead code in SubtitleViewer related to viewport clipping and intersection machinery
9) Tests/verification checklist
Initial load renders quickly with large subtitle files
Scroll smoothness on mobile and desktop
Progress updates accurately with onRangeChange
setPosition(lineIndex) lands on the correct group and preserves selection overlays
Font size/mode and language visibility changes reflect immediately without layout glitches
Drawer/toolbar behaviors on scroll unchanged
Memory usage stays flat over long sessions
10) Future-proofing
When enabling lazy load, implement ensureRange in useSubtitleLines and hook it to VirtualScroller onStartReached/onEndReached
Add a simple “loading row” state for not-yet-loaded groups if you go lazy
Install react-virtuoso, add VirtualScroller.jsx, refactor SubtitleViewer to use it, keep current reader API stable, and remove manual viewport/observer logic.