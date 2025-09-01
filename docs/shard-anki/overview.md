# Anki Shard - Module Overview

This directory contains documentation for the Anki Shard implementation in LS100.

## Documentation Structure

### Core Documentation
- **[anki.md](./anki.md)** - Main Anki Shard specification and architecture
- **[overview.md](./overview.md)** - This file, module navigation guide

### Component Modules
- **[template-engine.md](./template-engine.md)** - Note+Template rendering system
- **[study-engine.md](./study-engine.md)** - FSRS algorithm and progress tracking  
- **[storage-manager.md](./storage-manager.md)** - Browser storage coordination

## Quick Reference

### Key Features
- **Note+Template Architecture** - Anki-style multi-pair cards from single notes
- **Dynamic Rendering** - Cards generated on-demand from note fields
- **RefCount Sharing** - Notes shared across shards with automatic cleanup
- **Modern FSRS** - Advanced spaced repetition algorithm
- **Two-mode Interface** - Browse notes & Study cards

### New Architecture Benefits
- **Storage Efficiency** - Notes stored once, cards are lightweight references
- **Multi-pair Cards** - One note generates multiple Q&A combinations
- **Cross-shard Sharing** - Same note can be used in multiple shards
- **Template Flexibility** - Full Anki template syntax support

### Core Modules
- **noteManager** - Note CRUD operations with refCount
- **cardGen** - Card generation and scheduling data
- **templateEngine** - Dynamic content rendering
- **ankiApi** - High-level API coordinator

### Dependencies
- **IndexedDB** - Notes, templates, cards, media storage
- **ts-fsrs** - Free Spaced Repetition Scheduler
- **Browser storage APIs** - localStorage for progress

### Integration Points
- Extends existing shard engine system
- Follows established UI/UX patterns
- Maintains consistency with subtitle shard architecture

## Implementation Status

**✅ Completed**: Note+Template architecture, import/export, browse mode, study mode, multi-pair cards

Refer to main project plan.md for current development status and phase planning.

## Related Documentation

- **[../design.md](../design.md)** - Overall LS100 architecture
- **[../shard.md](../shard.md)** - General shard system documentation
- **[../rules.md](../rules.md)** - Documentation guidelines followed