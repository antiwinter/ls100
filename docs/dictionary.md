# Dictionary Module

This module provides word lookup using local Collins MDX dictionaries stored in `server/data/dict`.

## Endpoints

- GET `/api/dict/status` (auth required)
  - Returns loaded file paths and availability flags.
  - Response:
    ```json
    { "loaded": true, "files": { "ece": "...", "ee": "...", "thesaurus": "..." }, "available": { "ece": true, "ee": true, "thesaurus": true } }
    ```

- GET `/api/dict/lookup?word=...` (auth required)
  - Query params:
    - `word` (required)
  - Behavior:
    - Tries ECE first, then EE as fallback.
    - Thesaurus is always queried and attached when present.
    - If no definition found but thesaurus found, returns 200 with only thesaurus.
    - If neither found, returns 404.
  - Responses:
    - 200: `{ "searchedWord": "...", "source": "ECE|EE|null", "definitionHtml": "<html>|null", "thesaurusHtml": "<html>|null" }`
    - 400: `{ "error": "Missing 'word' query param" }`
    - 404: `{ "error": "Word not found", "searched": "..." }`
    - 500: `{ "error": "Dictionary lookup failed" }`

## Files

- `server/modules/dict/api.js` — Routes and in-memory dictionary instances

## Notes

- MDX files used:
  - `Collins-Advanced-ECE.mdx` (primary)
  - `Collins-Advanced-EE-3th.mdx` (fallback)
  - `Collins-Thesaurus.mdx` (thesaurus attachment)
- MDD assets are resolved automatically by the dictionary library when co-located.


