const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createAxiosConfig } = require('../utils/proxy-config');

async function testOpenSubtitles(testMovies) {
    const result = {
        status: 'unknown',
        free_access: true,
        requires_auth: true,
        features: [],
        rate_limit: '5 requests/second, 200 requests per day (free), 1000 requests per day (VIP)',
        api_endpoint: 'https://api.opensubtitles.com/api/v1',
        documentation: 'https://opensubtitles.stoplight.io/docs/opensubtitles-api',
        test_results: [],
        download_test: null,
        raw_responses: [], // Store raw API responses for analysis
        language_codes_found: new Set(), // Track all language codes we encounter
        notes: ''
    };

    try {
        console.log('   Testing OpenSubtitles API v1 (Current)...');
        console.log('   📊 Testing 3 movies with ALL languages to analyze actual language codes');
        
        const API_KEY = process.env.OPENSUBTITLES_API_KEY;
        
        if (!API_KEY) {
            console.log('   ⚠️  No API key found in environment variables');
            result.status = 'requires_auth';
            result.notes = 'Requires API key registration at https://www.opensubtitles.com/en/consumers';
            return result;
        }

        const headers = {
            'Api-Key': API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'ls100 v1.0'
        };

        // Test search functionality for all 10 movies
        let englishSubtitleForDownload = null;
        
        for (const movie of testMovies) {
            try {
                const searchParams = {
                    query: movie.title,
                    year: movie.year
                    // Remove language filter to get ALL languages
                };

                console.log(`   🔍 Searching: ${movie.title} (${movie.year}) - ALL languages`);
                
                const searchUrl = 'https://api.opensubtitles.com/api/v1/subtitles';
                const axiosConfig = createAxiosConfig(searchUrl, {
                    headers,
                    params: searchParams
                });
                
                const searchResponse = await axios.get(searchUrl, axiosConfig);

                if (searchResponse.status === 200 && searchResponse.data?.data) {
                    const subtitles = searchResponse.data.data;
                    
                    // Save raw response for this movie
                    result.raw_responses.push({
                        movie: movie.title,
                        query_params: searchParams,
                        response_data: searchResponse.data,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Analyze languages and formats
                    const languageCounts = {};
                    const formats = new Set();
                    const allLanguageCodes = new Set();
                    
                    subtitles.forEach(sub => {
                        if (sub.attributes?.language) {
                            const lang = sub.attributes.language;
                            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
                            allLanguageCodes.add(lang);
                            result.language_codes_found.add(lang); // Global tracking
                        }
                        
                        if (sub.attributes?.files) {
                            sub.attributes.files.forEach(file => {
                                if (file.file_name) {
                                    const ext = file.file_name.split('.').pop()?.toLowerCase();
                                    if (ext) formats.add(ext);
                                }
                            });
                        }
                    });

                    // Look for Chinese subtitles with various possible codes
                    const chineseCodes = ['zh', 'zh-cn', 'zh-tw', 'chi', 'cn', 'tw', 'zh-hans', 'zh-hant', 'chinese'];
                    const foundChineseCodes = [];
                    
                    chineseCodes.forEach(code => {
                        if (languageCounts[code]) {
                            foundChineseCodes.push(`${code}:${languageCounts[code]}`);
                        }
                    });

                    // Store English subtitle for download test (most reliable for testing)
                    if (!englishSubtitleForDownload && languageCounts['en']) {
                        const englishSub = subtitles.find(sub => 
                            sub.attributes?.language === 'en' && 
                            sub.attributes?.files?.length > 0 &&
                            sub.attributes?.download_count > 100  // Choose popular subtitle
                        );
                        if (englishSub) {
                            englishSubtitleForDownload = {
                                fileId: englishSub.attributes.files[0].file_id,
                                movie: movie.title,
                                filename: englishSub.attributes.files[0].file_name,
                                language_code: 'en',
                                download_count: englishSub.attributes.download_count,
                                subtitle_id: englishSub.attributes.subtitle_id
                            };
                        }
                    }

                    result.test_results.push({
                        movie: movie.title,
                        success: true,
                        subtitle_count: subtitles.length,
                        language_counts: languageCounts,
                        all_language_codes: Array.from(allLanguageCodes),
                        chinese_found: foundChineseCodes,
                        formats: Array.from(formats),
                        method: 'title_search'
                    });

                    console.log(`   ✅ Found ${subtitles.length} subtitles`);
                    console.log(`   📝 Languages: ${Array.from(allLanguageCodes).slice(0, 10).join(', ')}${allLanguageCodes.size > 10 ? '...' : ''} (${allLanguageCodes.size} total)`);
                    console.log(`   🇺🇸 English: ${languageCounts['en'] || 0} subtitles`);
                    if (foundChineseCodes.length > 0) {
                        console.log(`   🇨🇳 Chinese found: ${foundChineseCodes.join(', ')}`);
                    }
                    
                } else {
                    result.test_results.push({
                        movie: movie.title,
                        success: false,
                        subtitle_count: 0,
                        language_counts: {},
                        all_language_codes: [],
                        chinese_found: [],
                        formats: [],
                        method: 'title_search'
                    });
                    console.log(`   ❌ No subtitles found for ${movie.title}`);
                }

            } catch (searchError) {
                result.test_results.push({
                    movie: movie.title,
                    success: false,
                    error: searchError.message,
                    language_counts: {},
                    all_language_codes: [],
                    chinese_found: [],
                    formats: []
                });
                console.log(`   ❌ ${movie.title}: ${searchError.message}`);
            }

            // Rate limiting: 5 requests/second = 200ms delay
            await new Promise(resolve => setTimeout(resolve, 220)); // 220ms for safety
        }

        // Save raw data to file for analysis
        const rawDataDir = path.join(__dirname, '..', 'results');
        if (!fs.existsSync(rawDataDir)) {
            fs.mkdirSync(rawDataDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(rawDataDir, 'opensubtitles-raw-responses.json'),
            JSON.stringify({
                timestamp: new Date().toISOString(),
                all_language_codes_found: Array.from(result.language_codes_found).sort(),
                raw_responses: result.raw_responses
            }, null, 2)
        );

        console.log(`   📊 Language codes found: ${Array.from(result.language_codes_found).sort().slice(0, 15).join(', ')}${result.language_codes_found.size > 15 ? '...' : ''}`);
        console.log(`   💾 Raw API responses saved to: results/opensubtitles-raw-responses.json`);

        // Test download functionality with English subtitle
        if (englishSubtitleForDownload) {
            console.log(`   📥 Testing English download: ${englishSubtitleForDownload.filename} (${englishSubtitleForDownload.download_count} downloads)`);
            try {
                const downloadUrl = 'https://api.opensubtitles.com/api/v1/download';
                const downloadConfig = createAxiosConfig(downloadUrl, {
                    headers,
                    timeout: 15000
                });
                
                const downloadResponse = await axios.post(
                    downloadUrl,
                    { file_id: englishSubtitleForDownload.fileId },
                    downloadConfig
                );

                if (downloadResponse.status === 200 && downloadResponse.data?.link) {
                    console.log(`   ✅ Download link received: ${downloadResponse.data.link}`);
                    
                    // Test actual file download
                    const fileConfig = createAxiosConfig(downloadResponse.data.link, {
                        timeout: 10000,
                        maxContentLength: 5 * 1024 * 1024 // 5MB limit
                    });
                    
                    const fileResponse = await axios.get(downloadResponse.data.link, fileConfig);
                    
                    if (fileResponse.status === 200 && fileResponse.data) {
                        const content = fileResponse.data.toString();
                        const isValidSubtitle = content.includes('-->') || content.match(/^\d+$/m);
                        
                        result.download_test = {
                            success: true,
                            note: `Successfully downloaded English subtitle for ${englishSubtitleForDownload.movie} (${englishSubtitleForDownload.filename})`,
                            language_code: englishSubtitleForDownload.language_code,
                            file_size: content.length,
                            movie: englishSubtitleForDownload.movie,
                            subtitle_format: isValidSubtitle ? 'Valid SRT/VTT format' : 'Unknown format',
                            download_count: englishSubtitleForDownload.download_count,
                            download_quota_remaining: downloadResponse.data.remaining || 'unknown'
                        };
                        console.log(`   ✅ Download successful: ${content.length} characters, ${isValidSubtitle ? 'Valid subtitle format' : 'Unknown format'}`);
                        if (downloadResponse.data.remaining) {
                            console.log(`   📊 Download quota remaining: ${downloadResponse.data.remaining}`);
                        }
                    } else {
                        result.download_test = {
                            success: false,
                            note: `Download link provided but file download failed`,
                            movie: englishSubtitleForDownload.movie
                        };
                        console.log(`   ❌ File download failed`);
                    }
                } else {
                    result.download_test = {
                        success: false,
                        note: `Download API call failed or no download link provided`,
                        movie: englishSubtitleForDownload.movie,
                        api_response: downloadResponse.data
                    };
                    console.log(`   ❌ Download API failed`);
                }
            } catch (downloadError) {
                result.download_test = {
                    success: false,
                    note: `Download failed: ${downloadError.message}`,
                    movie: englishSubtitleForDownload.movie,
                    error_details: downloadError.response?.data || downloadError.message
                };
                console.log(`   ❌ Download failed: ${downloadError.message}`);
                if (downloadError.response?.status === 406) {
                    console.log(`   ⚠️  Note: Error 406 might indicate download quota exceeded`);
                }
            }
        } else {
            result.download_test = {
                success: false,
                note: 'No English subtitles found in any of the test movies',
                movie: 'N/A'
            };
            console.log(`   ⚠️  No English subtitles found for download testing`);
        }

        // Determine overall status
        if (result.test_results.some(r => r.success)) {
            result.status = 'working';
            result.features.push(
                'Title search',
                'Year filtering', 
                'All languages supported',
                'Multiple formats',
                'Download functionality'
            );
        } else {
            result.status = 'failed';
        }

        // Add general features
        result.features.push(
            'Multiple languages',
            'IMDB integration',
            'Hash-based search',
            'User ratings',
            'Multiple subtitle formats',
            'API rate limiting (5 req/s)',
            `Language coverage (${result.language_codes_found.size} codes found)`
        );

        console.log(`   📈 Summary: ${result.test_results.filter(r => r.success).length}/${result.test_results.length} movies found`);

    } catch (error) {
        result.status = 'error';
        result.error = error.message;
        console.log(`   ❌ OpenSubtitles test failed: ${error.message}`);
    }

    // Convert Set to Array for JSON serialization
    result.language_codes_found = Array.from(result.language_codes_found);

    return result;
}

module.exports = testOpenSubtitles; 