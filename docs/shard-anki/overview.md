# Anki Shard - Module Overview

This directory contains documentation for the Anki Shard implementation in LS100.

## Documentation Structure

### Core Documentation
- **[anki.md](./anki.md)** - Main Anki Shard specification and architecture
- **[overview.md](./overview.md)** - This file, module navigation guide

### Component Modules
- **[card-parser.md](./card-parser.md)** - Template parsing and HTML rendering
- **[study-engine.md](./study-engine.md)** - FSRS algorithm and progress tracking  
- **[storage-manager.md](./storage-manager.md)** - Browser storage coordination

## Quick Reference

### Key Features
- Frontend-only implementation (no backend changes)
- Browser storage: IndexedDB + localStorage
- Modern FSRS spaced repetition algorithm
- Two-mode interface: Browse & Study

### Dependencies
- `anki-reader` - Parse .apkg files in browser
- `ts-fsrs` - Free Spaced Repetition Scheduler
- Browser IndexedDB and localStorage APIs

### Integration Points
- Extends existing shard engine system
- Follows established UI/UX patterns
- Maintains consistency with subtitle shard architecture

## Implementation Status

Refer to main project plan.md for current development status and phase planning.

## Related Documentation

- **[../design.md](../design.md)** - Overall LS100 architecture
- **[../shard.md](../shard.md)** - General shard system documentation
- **[../rules.md](../rules.md)** - Documentation guidelines followed
