OverlayManager
Holds reducer: dict, toolbar, font {mode,size}, langSet, other tool drawers.
Exposes context: { state, actions }.
Renders Drawer/Toolbar components (Dict, FontDrawer, Toolbar, others).
Persists settings (e.g., localStorage) and hydrates on mount.
Emits controlled props for viewer: fontStyle, langSet, and handlers needed by viewer (onWordShort/onWordLong/onEmptyClick) via context.
Reader
Owns data/sync only: lines → groups, currentGroup, selectedWords, server sync.
Wraps subtree with <OverlayProvider>.
Passes to viewer: groups, selectedWords, fontStyle, langSet (via context selector or props from manager), and onCurrentGroupChange.
No UI state, no font/lang state.
Viewer
Pure render: uses groups, selectedWords, langSet, fontStyle props.
Calls overlay actions via callbacks provided by context (e.g., openDict(word,pos)) or via props passed from manager.
API sketch
OverlayManager props to reader:
children (it wraps Toolbar/Drawers)
onFontChange(font), onLangToggle(code, visible) → optional persistence hooks
Context
state: { dict, toolbar, font, langSet }
actions: { openDict, closeDict, toggleTool, setFontMode, setFontSize, toggleLang, showToolbar, hideToolbar, closeAll }
Notes
Keep selectedWords in reader (needed for sync); it remains a prop to viewer.
Viewer stays outside overlay context unless you prefer using context to wire tap handlers; both work.
Place OverlayManager as a sibling of Viewer (not inside Virtuoso container).
This yields single-source-of-truth for UI, slimmer reader, and a dumb, reusable viewer.
