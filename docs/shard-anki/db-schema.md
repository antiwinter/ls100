# Anki Shard Database Schema

## Overview

This document outlines the bundle-based database schema for Anki shards in ls100. The design simplifies the traditional Anki deck/notetype separation into a unified bundle concept.

## Terminology Mapping: Anki → ls100

| Anki Term | Anki Field | ls100 Term | ls100 Field | Meaning |
|-----------|------------|------------|-------------|---------|
| **Note Type** / **Model** | `mid` | **Bundle** | `bundleId` | Content structure definition + organization unit |
| **Deck** | `did` | **VDeck** | `vdeck[]` | Organizational unit (now tag-based) |
| **Note** | `nid` | **Note** | `noteId` | Content instance |
| **Card** | `cid` | **Card** | `cardId` | Study unit |
| **Template** | `ord, did` | **Template** | `ord, vdeck` | Card generation rule |
| **Media** | _(global)_ | **Media** | _(global)_ | Resource files |
| **Virtual Deck** | _(none)_ | **VDeck** | `vdeck[]` | Organizational tags on cards |

## Database Schema

```javascript
db.version(1).stores({
  notes: 'id, bundleId, modified',
  bundles: 'id, name',
  templates: 'id, bundleId, ord', 
  cards: 'id, noteId, bundleId, due, state',
  media: 'id, filename'
})
```

## Table Schemas

### bundles
```javascript
// Bundle: Content structure definition + organization unit
// Schema: { id, name, fields[], created }
// - id: unique bundle identifier (NvId based on structure)
// - name: human-readable bundle name
// - fields: array of field definitions/names
// - created: timestamp when bundle was created
// Used by: noteManager for validation, cardGen for rendering
```

### notes
```javascript
// Note: Content instances with NvId deduplication
// Schema: { id, bundleId, fields[], tags[], created, modified }
// - id: unique note identifier (NvId based on content)
// - bundleId: reference to bundles.id
// - fields: array of field values (text content)
// - tags: array of tag strings for organization
// - created/modified: timestamps (auto-managed by hooks)
// Used by: noteManager for CRUD operations, cardGen for rendering
```

### templates
```javascript
// Template: Card generation rules for bundles
// Schema: { id, bundleId, name, qfmt, afmt, ord, vdeck?, created }
// - id: unique template identifier (NvId based on content)
// - bundleId: reference to bundles.id
// - name: template name (e.g., "Forward", "Reverse")
// - qfmt: question format template (HTML with field placeholders)
// - afmt: answer format template (HTML with field placeholders)
// - ord: template ordinal/order within bundle, 0, 1, 2, 3...
// - vdeck: optional single vdeck name for template routing (maps from Anki's 'did' field)
// - created: timestamp when template was created
// Used by: cardGen for rendering card content, noteManager for template lookup
```

### cards
```javascript
// Card: Individual study units with scheduling data
// Schema: { id, noteId, templateOrd, bundleId, vdeck[], due, state, fsrs[], created, modified }
// - id: unique card identifier (generated)
// - noteId: reference to notes.id (source note)
// - templateOrd: template ordinal used to generate this card
// - bundleId: reference to bundles.id (direct relationship)
// - vdeck: array of virtual deck names for organization (e.g., ['Spanish::Verbs::Present', 'High Priority'])
// - due: next review date (timestamp) - MIRRORED from latest fsrs[0].due for fast queries
// - state: current FSRS state (New/Learning/Review/Relearning) - MIRRORED from fsrs[0].state
// - fsrs: array of FSRS state history [newest, older, oldest] - source of truth
// - created/modified: timestamps
// Used by: studyEngine for scheduling (fast filters on due/state), cardGen for CRUD operations
```

### media
```javascript
// Media: Global binary files with reference counting
// Schema: { id, filename, blob, size, type, refCount, imported }
// - id: unique media identifier (content-based)
// - filename: original filename from APKG
// - blob: binary data blob (source of truth)
// - size: file size in bytes
// - type: MIME type (image/png, audio/mp3, etc.)
// - refCount: number of references across all bundles
// - imported: timestamp when media was imported
// Used by: mediaManager for caching, templateEngine for rendering, apkgParser for import
```

## Data Relationships

```
Shard
├── bundles (structure + organization)
│   ├── templates (card generation rules)
│   ├── cards (study units with vdeck tags)
│   └── notes (content instances)
└── media (global resources)
```

## Virtual Decks (VDecks)

Virtual decks provide flexible organization without duplicating cards or affecting FSRS tracking.

### Concept
- **Cards contain vdeck tags**: `card.vdeck = ['Spanish::Verbs::Present', 'High Priority']`
- **Multiple membership**: A card can belong to multiple vdecks independently
- **Tag-like behavior**: Similar to tags but specifically for study organization
- **Hierarchy preservation**: Anki deck paths preserved as complete `::` strings
- **Study filtering**: Users can study cards from specific vdeck(s)
- **FSRS preservation**: All FSRS tracking remains with the original card

### Example Usage
```javascript
// Card with multiple vdeck memberships
card = {
  id: 'card-123',
  bundleId: 'spanish-vocabulary',
  vdeck: ['Spanish::Verbs::Present', 'High Frequency', 'Daily Practice'],
  // ... other fields
}

// Study session filtering
studySession.filterByVDecks(['Spanish::Verbs::Present', 'High Frequency']) // Cards in either vdeck
studySession.filterByVDecks(['High Frequency'], 'all')   // Cards in all specified vdecks
```

### APKG Import Mapping
During APKG import, original Anki decks become vdeck tags:

```javascript
// APKG contains deck: "Spanish::Verbs::Present Tense"
// ls100 mapping:
card.bundleId = 'spanish-bundle'
card.vdeck = ['Spanish::Verbs::Present Tense']

// Each card belongs to the complete hierarchical deck path from Anki
// Users can add additional independent vdecks: ['Spanish::Verbs::Present Tense', 'High Priority']
```

## Implementation Strategy

### Step 1: Global Search & Replace

Perform global text replacements across the codebase:

```bash
# Primary replacements
deckId → bundleId
deckIds → bundleIds
typeId → bundleId
noteTypes → bundles
noteType → bundle
```

### Step 2: Fix Key Components

After global replacements, fix specific areas that need manual attention:

#### Database Schema (`db.js`)
```javascript
// Update table definitions and field mappings
bundles: 'id, name'  // was: noteTypes: 'id, name'
cards: 'id, noteId, bundleId, due, state'  // was: deckId
media: 'id, filename'  // remove deckId indexing
```

#### Media Manager (`mediaManager.js`)
```javascript
// Remove deckId scoping, implement global access
getMediaDataUrl(filename) // was: getMediaDataUrl(filename, deckId)
// Add refCount management
```

#### Session Store (`useSessionStore.js`)
```javascript
// Update state structure
{ bundleIds: [], ... } // was: { deckIds: [], ... }
```

#### Study Engine (`studyEngine.js`)
```javascript
// Update database queries
.where('bundleId').anyOf(ss.bundleIds) // was: deckId

// Add vdeck filtering support
.filter(card => {
  if (!ss.vdeckFilter?.length) return true
  return ss.vdeckFilter.some(vd => card.vdeck?.includes(vd))
})
```

#### APKG Parser (`apkgParser.js`)
```javascript
// Create bundles directly from APKG content
const bundleId = await genNvId('bundle', modelData + deckName)

// Map Anki deck hierarchy to complete vdeck path
const deckPath = getAnkiDeckPath(ankiCard.did) // e.g., "Spanish::Verbs::Present"
card.vdeck = [deckPath] // ['Spanish::Verbs::Present'] - preserve complete hierarchy

// Convert Anki template's 'did' field to single vdeck
if (ankiTemplate.did) {
  const targetDeckPath = getAnkiDeckPath(ankiTemplate.did)
  template.vdeck = targetDeckPath // "Spanish::Verbs::Present" - complete path
}

// Template targeting during card generation
if (template.vdeck) {
  if (!card.vdeck.includes(template.vdeck)) {
    card.vdeck.push(template.vdeck)
  }
}
```

### Step 3: Test & Validate

- Test APKG import creates proper bundles with vdeck mapping
- Verify study sessions work with bundleId filtering
- Test vdeck filtering (single and multiple vdeck selection)
- Confirm media access works without deckId scoping

## Key Design Principles

1. **Bundle = Content + Structure**: Each bundle represents a cohesive study unit
2. **Global Media**: Shared resources with reference counting
3. **NvId Deduplication**: Content-based IDs prevent duplicate notes
4. **Simplified Relationships**: Direct bundle → cards/notes/templates
5. **VDeck Organization**: Tag-like organization without card duplication or FSRS fragmentation

## Benefits of Bundle-Based Architecture

1. **Conceptual Clarity**: "Bundle" matches user mental model better than "noteType"
2. **Import Simplicity**: 1 APKG file = 1 bundle (natural mapping)
3. **Reduced Complexity**: Eliminates artificial deck/noteType separation
4. **Resource Efficiency**: Global media deduplication via refCount
5. **Flexible Organization**: VDecks provide tag-like organization without complexity
6. **FSRS Integrity**: Single FSRS history per card regardless of vdeck membership
7. **Template Flexibility**: Templates can target specific vdecks for routing
8. **Future-Proof**: Clean foundation for optional organizational features

## Intentional Limitations vs Real Anki

Our bundle-based approach intentionally simplifies several Anki features that we consider over-complicated:

### **Simplified Away (Intentional)**

#### **1. Per-Deck Scheduling Configuration**
```javascript
// Real Anki: Complex per-deck settings
FrenchDeck: { newPerDay: 20, fsrsParams: [...], intervals: [...] }
SpanishDeck: { newPerDay: 5, fsrsParams: [...], intervals: [...] }

// ls100: Single bundle configuration  
Bundle: { defaultConfig: {...} } // Unified settings
VDecks: ['French', 'Spanish'] // Organization only
```
**Rationale**: Most users don't need per-subject scheduling complexity. Unified settings reduce cognitive overhead.

#### **2. Hierarchical Deck Limits**
```javascript
// Real Anki: Inherited limits across deck tree
Languages: 50 new/day total
├── French: 30 new/day max (inherits from Languages)  
└── Spanish: 20 new/day max (inherits from Languages)

// ls100: Flat organization with simple filtering
vdeck: ['Languages', 'French'] // Tags without hierarchy enforcement
```
**Rationale**: Hierarchical limits create confusing interactions. Tag-based filtering is more intuitive.

#### **3. Complex APKG Import Structure**
```javascript
// Real Anki: Preserves complex deck hierarchies with individual settings
// ls100: Flattens to bundle + vdeck tags, loses per-deck configurations
```
**Rationale**: Most imported content works fine with unified settings. Complexity isn't worth the maintenance overhead.

### **Template Flexibility Preserved**
```javascript
// Templates can target a specific vdeck during card generation (like Anki)
templates: [
  { name: 'French Forward', vdeck: 'French' },
  { name: 'Spanish Forward', vdeck: 'Spanish' },
  { name: 'General Review', vdeck: null } // No specific targeting
]

// Card generation assigns template's vdeck (if specified) to the card's vdeck array
```

### **Migration Strategy for Complex APKGs**
```javascript
// For APKGs with complex deck structures:
// 1. Create separate bundles for significantly different configurations
// 2. Use vdeck tags to preserve organizational relationships
// 3. Manual post-import organization for edge cases

// Example:
// Anki: Medical deck with 5 sub-decks, each with different intervals
// ls100: Create 2-3 bundles based on actual study patterns
//        Use vdeck tags to maintain subject organization
```
