# Dictionary Module

This module provides word lookup using local Collins MDX dictionaries stored in `server/lib/collins/`.

## Endpoints

// Status endpoint is not implemented currently.

- GET `/api/dict/lookup?word=...` (auth required)
  - Query params:
    - `word` (required)
  - Behavior:
    - Tries ECE first, then EE as fallback.
    - Thesaurus is always queried and attached when present.
    - If nothing found, returns 200 with `found: false`.
  - Responses:
    - 200: `{ "searchedWord": "...", "source": "ECE|EE|null", "definitionHtml": "<html>|null", "thesaurusHtml": "<html>|null", "found": true|false }`
    - 400: `{ "error": "Missing 'word' query param" }`
    - 500: `{ "error": "Dictionary lookup failed" }`
  - Caching:
    - Responses include `ETag` and `Cache-Control: public, max-age=0, must-revalidate`.
    - If `If-None-Match` matches, server returns `304 Not Modified`.

## Files

- `server/modules/dict/api.js` — Routes and in-memory dictionary instances
- `server/lib/collins/index.js` — Dictionary loaders and sanitization

## Notes

- MDX files used:
  - `Collins-Advanced-ECE.mdx` (primary)
  - `Collins-Advanced-EE-3th.mdx` (fallback)
  - `Collins-Thesaurus.mdx` (thesaurus attachment)
- MDD assets are resolved automatically by the dictionary library when co-located.

## Asset management

- Dictionary `.mdx`/`.mdd` files are not tracked in Git and should be placed manually under `server/lib/collins/`.
- See `.gitignore` entries for patterns.


