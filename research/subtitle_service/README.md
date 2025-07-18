# Subtitle Service Research Tool

This tool tests various subtitle APIs and services to determine which ones are suitable for integration into the ls100 application.

## Overview

The research tool tests the following subtitle services:

1. **OpenSubtitles** - The largest subtitle database with official API
2. **SubDB** - Hash-based subtitle database
3. **TheSubDB** - Alternative hash-based service
4. **YIFY Subtitles** - Movie-focused subtitle database

## Quick Start

1. **Install dependencies:**
   ```bash
   cd research/subtitle_service
   npm install
   ```

2. **Run all tests:**
   ```bash
   npm test
   ```

3. **Run individual service tests:**
   ```bash
   npm run test-opensubtitles
   npm run test-subdb
   npm run test-thesubdb
   npm run test-yify
   ```

## Setup and Configuration

### Environment Variables

Set up environment variables for API keys (optional but recommended for full testing):

```bash
export OPENSUBTITLES_API_KEY="your_api_key_here"
export REQUEST_TIMEOUT=10000
export RATE_LIMIT_DELAY=1000
```

### OpenSubtitles API Key

To get full functionality from OpenSubtitles:

1. Register at [OpenSubtitles.com](https://www.opensubtitles.com/en/consumers)
2. Create a new application to get your API key
3. Set the `OPENSUBTITLES_API_KEY` environment variable

**Rate Limits:**
- Free: 200 requests/day
- VIP: 1000 requests/day

## Test Results

After running tests, results are saved in the `results/` directory:

- `research-results.json` - Raw test data in JSON format
- `research-report.md` - Formatted markdown report with analysis

## Service Details

### OpenSubtitles
- **Type**: Official API
- **Authentication**: API key required
- **Search Methods**: Title, IMDB ID, file hash
- **Languages**: 60+ languages
- **Features**: Download, upload, ratings, metadata
- **Rate Limits**: 200-1000 requests/day

### SubDB
- **Type**: Hash-based API
- **Authentication**: None required
- **Search Methods**: File hash only
- **Languages**: Multiple supported
- **Features**: Download, upload
- **Rate Limits**: Unknown

### TheSubDB
- **Type**: Hash-based API (similar to SubDB)
- **Authentication**: None required
- **Search Methods**: File hash only
- **Languages**: Multiple supported
- **Features**: Download
- **Rate Limits**: Unknown

### YIFY Subtitles
- **Type**: Web scraping (no official API)
- **Authentication**: None required
- **Search Methods**: Movie title
- **Languages**: Multiple supported
- **Features**: Search, download (via scraping)
- **Rate Limits**: Depends on website

## Hash Calculation

For hash-based services (SubDB, TheSubDB), you need to calculate MD5 hash of:
- First 64KB of video file
- Last 64KB of video file
- Concatenated together

Example implementation:
```javascript
const crypto = require('crypto');
const fs = require('fs');

function calculateSubDBHash(filePath) {
    const readSize = 64 * 1024; // 64KB
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    const firstChunk = Buffer.alloc(readSize);
    const lastChunk = Buffer.alloc(readSize);
    
    const fd = fs.openSync(filePath, 'r');
    
    // Read first 64KB
    fs.readSync(fd, firstChunk, 0, readSize, 0);
    
    // Read last 64KB
    fs.readSync(fd, lastChunk, 0, readSize, fileSize - readSize);
    
    fs.closeSync(fd);
    
    const combined = Buffer.concat([firstChunk, lastChunk]);
    return crypto.createHash('md5').update(combined).digest('hex');
}
```

## Implementation Recommendations

Based on testing results, the recommended integration strategy is:

1. **Primary**: OpenSubtitles API (most reliable, feature-rich)
2. **Fallback**: SubDB or TheSubDB (for hash-based lookup)
3. **Optional**: YIFY (for popular movies, requires scraping)

### Integration Architecture

```
Subtitle Search Request
        ↓
1. Try OpenSubtitles API (title/IMDB)
        ↓ (if no results)
2. Try hash-based lookup (SubDB/TheSubDB)
        ↓ (if no results)
3. Try YIFY web scraping (popular movies)
        ↓
Return best results
```

## Error Handling

The tool includes comprehensive error handling:

- **Network timeouts**: 10-second timeout per request
- **Rate limiting**: Configurable delays between requests
- **API errors**: Graceful fallback to alternative methods
- **Missing API keys**: Tests what's possible without authentication

## Legal Considerations

When implementing subtitle downloads:

1. **Copyright compliance**: Ensure subtitles are properly licensed
2. **Attribution**: Credit subtitle creators when required
3. **Terms of service**: Follow each service's terms of use
4. **Rate limiting**: Respect API limits to avoid being blocked

## Extending the Research

To add new subtitle services:

1. Create a new file in `services/` directory
2. Follow the same testing pattern as existing services
3. Add the service to `test-all-services.js`
4. Update this README with service details

## Troubleshooting

**Common issues:**

- **Connection timeouts**: Some services may be slow or unreliable
- **API key errors**: Ensure OpenSubtitles API key is valid
- **Rate limiting**: Increase delays if getting blocked
- **CORS issues**: Some services may block browser requests

**Debug mode:**
```bash
DEBUG=1 npm test
```

## Contributing

When adding new services or improving existing tests:

1. Maintain the same result format structure
2. Include proper error handling
3. Add rate limiting to prevent blocking
4. Update documentation and examples
5. Test thoroughly with different movie titles

## License

This research tool is part of the ls100 project and follows the same license terms. 