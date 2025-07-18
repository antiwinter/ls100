# OpenSubtitles API Data Structure Documentation

Generated from real API responses on: 2025-07-18

## Overview

OpenSubtitles REST API v1 returns paginated results with comprehensive metadata for each subtitle entry.

## Top-Level Response Structure

```json
{
  "total_pages": 200,        // Total number of result pages
  "total_count": 10000,      // Total subtitle entries matching query
  "per_page": 50,           // Results per page (default: 50)
  "page": 1,                // Current page number
  "data": []                // Array of subtitle objects
}
```

## Subtitle Object Structure

Each subtitle in the `data` array has the following structure:

### Root Level
```json
{
  "id": "4368177",           // Unique subtitle ID (string)
  "type": "subtitle",        // Always "subtitle"
  "attributes": {}           // Main subtitle data (see below)
}
```

### Attributes Object

The `attributes` object contains all the subtitle metadata:

#### Basic Information
```json
{
  "subtitle_id": "4368177",           // Same as root id
  "language": "en",                   // ISO language code
  "download_count": 7413,             // Total downloads
  "new_download_count": 99,           // Recent downloads
  "hearing_impaired": false,          // Accessibility flag
  "hd": false,                        // High definition flag
  "fps": 25.0,                        // Frame rate (number)
  "votes": 1,                         // User votes count
  "ratings": 5.0,                     // Average rating
  "from_trusted": false,              // Trusted uploader flag
  "foreign_parts_only": false,        // Foreign language parts only
  "upload_date": "2010-06-09T16:14:41Z", // ISO timestamp
  "ai_translated": false,             // AI translation flag
  "nb_cd": 3,                         // Number of CD parts
  "machine_translated": false         // Machine translation flag
}
```

#### Release Information
```json
{
  "slug": "3687118-the-matrix-trilogy",    // URL-friendly identifier
  "release": "The Matrix Trilogy",         // Release name/description
  "comments": "Release notes...",          // Uploader comments
  "legacy_subtitle_id": 3687118,          // Old system ID
  "legacy_uploader_id": 1210705          // Old uploader ID
}
```

#### Uploader Information
```json
{
  "uploader": {
    "uploader_id": 119465,           // User ID
    "name": "os_robot",              // Username
    "rank": "Trusted member"         // User rank/status
  }
}
```

#### Movie/Feature Details
```json
{
  "feature_details": {
    "feature_id": 646193,           // Internal feature ID
    "feature_type": "Movie",        // Content type (Movie/TV Show)
    "year": 1999,                   // Release year
    "title": "The Matrix",          // Movie title
    "movie_name": "1999 - Matrix",  // Display name
    "imdb_id": 133093,             // IMDB ID (without tt prefix)
    "tmdb_id": 603                  // TMDB ID
  }
}
```

#### URLs and Links
```json
{
  "url": "https://www.opensubtitles.com/en/subtitles/...",
  "related_links": [
    {
      "label": "All subtitles for the matrix",
      "url": "https://www.opensubtitles.com/en/movies/...",
      "img_url": "https://s7.opensubtitles.com/features/..."
    }
  ]
}
```

#### Files Array
Each subtitle can have multiple files (for multi-CD releases):

```json
{
  "files": [
    {
      "file_id": 4467084,           // Unique file ID for downloads
      "cd_number": 1,               // CD/part number
      "file_name": "The Matrix 1"   // Display filename
    },
    {
      "file_id": 4467112,
      "cd_number": 2,
      "file_name": "The Matrix 2"
    }
  ]
}
```

## Language Codes Found

Based on testing, OpenSubtitles uses standard ISO language codes:

### Common Languages
- `en` - English
- `es` - Spanish  
- `fr` - French
- `de` - German
- `it` - Italian
- `pt-BR` - Portuguese (Brazil)
- `pt-PT` - Portuguese (Portugal)
- `ru` - Russian
- `ja` - Japanese
- `ko` - Korean

### Chinese Variants
- `zh-CN` - Chinese (Simplified)
- `zh-TW` - Chinese (Traditional)

### Complete List (37 codes found)
```
ar, bg, bn, bs, cs, da, el, en, es, et, fa, fr, he, hi, hu, id, is, it, ko, ms, my, nl, no, pl, pt-BR, pt-PT, ro, ru, sl, sr, sv, th, tr, uk, vi, zh-CN, zh-TW
```

## Download API Structure

To download a subtitle file, use the file_id from the files array:

### Request
```
POST https://api.opensubtitles.com/api/v1/download
Content-Type: application/json
Api-Key: YOUR_API_KEY

{
  "file_id": 4467084
}
```

### Response
```json
{
  "link": "https://www.opensubtitles.com/download/...",
  "file_name": "subtitle.srt",
  "requests": 4,      // Remaining download quota
  "remaining": 196,   // Daily downloads remaining
  "message": "Success"
}
```

## Rate Limits

- **Search API**: 5 requests per second, 200 per day (free), 1000 per day (VIP)
- **Download API**: 5 downloads per day (free), unlimited (VIP)

## Search Parameters

The API accepts these search parameters:

```json
{
  "query": "Movie Title",        // Required: search term
  "year": 1999,                 // Optional: release year
  "season_number": 1,           // Optional: for TV shows
  "episode_number": 5,          // Optional: for TV episodes
  "languages": "en,es,fr",      // Optional: comma-separated language codes
  "moviehash": "hash",          // Optional: file hash
  "imdb_id": 133093,           // Optional: IMDB ID
  "tmdb_id": 603,              // Optional: TMDB ID
  "parent_feature_id": 12345,   // Optional: for episodes
  "type": "movie",             // Optional: movie/episode
  "order_by": "download_count", // Optional: sorting
  "order_direction": "desc"     // Optional: asc/desc
}
```

## Usage Examples

### Basic Movie Search
```javascript
const params = {
  query: "The Matrix",
  year: 1999,
  languages: "en,zh-CN"
};
```

### Multi-language Support
```javascript
// Get all available languages for a movie
const params = {
  query: "Avatar",
  year: 2009
  // No language filter = all languages
};
```

### Download Process
```javascript
// 1. Search for subtitles
// 2. Extract file_id from response.data[0].attributes.files[0].file_id
// 3. POST to download endpoint with file_id
// 4. Follow returned download link
```

## Notes

- **File Formats**: Most subtitles are SRT format, some VTT/ASS
- **Multi-CD**: Old movies may have multiple parts (nb_cd > 1)
- **Quality Indicators**: `from_trusted`, `ratings`, `download_count`
- **Accessibility**: `hearing_impaired` flag for HI subtitles
- **HD Content**: `hd` flag indicates high-definition releases 