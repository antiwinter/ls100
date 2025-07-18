// Subtitle Service Research Configuration
// Copy this file to config.js and fill in your API keys

module.exports = {
    // OpenSubtitles API Key
    // Register at: https://www.opensubtitles.com/en/consumers
    // Free tier: 200 requests/day, VIP: 1000 requests/day
    opensubtitles: {
        apiKey: process.env.OPENSUBTITLES_API_KEY || '',
        userAgent: 'ls100 v1.0'
    },

    // Request timeout settings (in milliseconds)
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000,

    // Rate limiting delays (in milliseconds)
    rateLimitDelay: parseInt(process.env.RATE_LIMIT_DELAY) || 1000,

    // User agent for web requests
    userAgent: process.env.USER_AGENT || 'ls100/1.0 Subtitle Research Tool',

    // Test configuration
    test: {
        runExtendedTests: process.env.RUN_EXTENDED_TESTS === 'true',
        maxTestMovies: parseInt(process.env.MAX_TEST_MOVIES) || 3,
        
        // Test movie data
        movies: [
            {
                title: "The Matrix",
                year: 1999,
                imdb_id: "tt0133093",
                hash: "18379ac9af039390",
                filename: "The.Matrix.1999.720p.BluRay.x264.mkv"
            },
            {
                title: "Inception",
                year: 2010,
                imdb_id: "tt1375666",
                hash: "ffd8d4aa68033dc0",
                filename: "Inception.2010.1080p.BluRay.x264.mkv"
            },
            {
                title: "Interstellar",
                year: 2014,
                imdb_id: "tt0816692",
                hash: "64f73a24a0171757",
                filename: "Interstellar.2014.1080p.BluRay.x264.mkv"
            }
        ]
    },

    // Service endpoints
    endpoints: {
        opensubtitles: {
            base: 'https://api.opensubtitles.com/api/v1',
            legacy: 'https://rest.opensubtitles.org'
        },
        subdb: {
            base: 'http://api.thesubdb.com'
        },
        thesubdb: {
            base: 'http://api.thesubdb.com/'
        },
        yify: {
            base: 'https://yifysubtitles.org',
            api: 'https://yifysubtitles.org/api'
        }
    }
}; 