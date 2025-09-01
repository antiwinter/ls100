### Shard Anki – Feature Reference

This document outlines advanced Anki features and what they entail for a browser‑only shard implementation. Use it to decide which to include.

#### Sync (AnkiWeb/AnkiDroid/desktop) - keep
- **What**: Bidirectional sync of collection state (notes, cards, scheduling, media).
- **Why it matters**: Enables cross‑device continuity; requires conflict resolution and identity/auth.
- **Key pieces**: Network layer, protobuf/REST bridge, auth, incremental state diff, conflict handling, media upload/download, throttling.
- **Considerations**: IndexedDB ↔ server mapping; offline queue; schema parity; large media; privacy.
- **Effort**: High.

#### Deck Configs (per‑deck scheduling/settings) - keep/high
- **What**: Per‑deck parameters like steps, limits, ease factors, leech handling.
- **Why**: User control over study behavior and difficulty.
- **Key pieces**: Config schema, UI, scheduler respect for config.
- **Considerations**: Our FSRS flow ignores deck‑level overrides today.
- **Effort**: Medium.

#### Timeboxing (study session time limits) - keep/low
- **What**: Enforce session duration windows (e.g., 15 minutes).
- **Why**: Pacing and habit formation; pause/resume semantics.
- **Key pieces**: Timers, UI countdown, auto‑end, persistence across refresh.
- **Considerations**: We already have `maxTime`; needs UI/controls and resume semantics.
- **Effort**: Low‑Medium.

#### Filtered Decks (temporary custom decks from search) - drop
- **What**: Build a temporary deck based on search (tag, overdue, lapses, etc.).
- **Why**: Targeted review/cramming.
- **Key pieces**: Search language, builder, restore original deck mapping, due overrides.
- **Considerations**: Requires robust search over notes/cards and progress state.
- **Effort**: Medium‑High.

#### Notetype/Template Migration (schema evolution) - drop
- **What**: Change field lists, template HTML, and migrate existing notes without data loss.
- **Why**: Iterating on content structure at scale.
- **Key pieces**: Versioned notetypes, migration plans, preview/diff, rollback.
- **Considerations**: Our model lacks versioning; cards reference `templateIdx`.
- **Effort**: High.

#### Cloze (fill‑in‑the‑blank note type) - keep
- **What**: Cloze deletions like `{{c1::text}}` generating multiple cards.
- **Why**: Dense learning from passages.
- **Key pieces**: Parser, renderer highlighting, card generation per cloze index, editing UX.
- **Considerations**: Media/HTML safe parsing; compatibility with our `TemplateRenderer`.
- **Effort**: Medium.

#### Flags (card flags/colors) - keep/low
- **What**: User‑set flags on cards for organization.
- **Why**: Quick filtering and later review.
- **Key pieces**: New field on cards, UI toggles, filter integration.
- **Considerations**: Persistence in IndexedDB; search support.
- **Effort**: Low.

#### Suspend/Bury - keep
- **What**: Temporarily exclude cards (suspend) or hide sibling cards for a day/session (bury).
- **Why**: Reduce interference and overload.
- **Key pieces**: Card state flags, queue logic changes, UI actions.
- **Considerations**: Interaction with FSRS and due computation.
- **Effort**: Low‑Medium.

#### Leech Handling - keep
- **What**: Detect repeatedly failed cards; mark/suspend and tag as leech.
- **Why**: Avoid time sinks; prompt restructuring.
- **Key pieces**: Thresholds, counters, auto‑actions, UI surfacing.
- **Considerations**: Works with existing `reps/lapses`.
- **Effort**: Low.

#### Media Management (advanced) - keep/high
- **What**: Deduplication, orphan detection, missing media placeholders, bulk import/export.
- **Why**: Reliability at scale.
- **Key pieces**: Hashing, references graph, maintenance UI.
- **Considerations**: Current implementation is basic replacement via data URLs.
- **Effort**: Medium.

#### Search/Browser (advanced) - keep
- **What**: Full query language over fields/tags/progress.
- **Why**: Powerful filtering; needed for filtered decks.
- **Key pieces**: Indexing, parser, evaluator, UI.
- **Considerations**: Performance on IndexedDB; incremental indexes.
- **Effort**: Medium‑High.

#### Stats & Heatmaps - keep
- **What**: Review counts, streaks, intervals, calendar heatmaps.
- **Why**: Motivation and insight.
- **Key pieces**: Aggregations, caching, UI components.
- **Considerations**: Use `progressStorage` and card logs if added.
- **Effort**: Medium.

#### Undo/Redo of Reviews - keep
- **What**: Revert last rating and scheduling.
- **Why**: Fix mistakes.
- **Key pieces**: Action log, inverse ops, UI control.
- **Considerations**: Determinism with FSRS timestamps.
- **Effort**: Medium.

---

Notes for this shard today
- Storage: IndexedDB stores `notes`, `noteTypes`, `templates`, `cards`, `media`.
- Scheduler: FSRS‑based, simplified; no deck configs applied.
- Rendering: Template substitution with media URL rewriting; no cloze yet.
- Import: `.apkg` parser imports notetypes/templates/notes/media; no sync.

Decision guide
- Quick wins: Flags, suspend/bury, leech handling, timeboxing UI.
- Medium: Cloze, deck configs (subset), filtered decks (basic search).
- Heavy lifts: Sync, notetype/template migration, full search language.


