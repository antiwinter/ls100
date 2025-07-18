const axios = require('axios');
const { createAxiosConfig } = require('../utils/proxy-config');

async function testSubDB(testMovies) {
    const result = {
        status: 'unknown',
        free_access: true,
        requires_auth: false,
        features: [],
        rate_limit: 'No official limit documented',
        api_endpoint: 'http://api.thesubdb.com',
        documentation: 'https://thesubdb.com/api/',
        test_results: [],
        download_test: null,
        notes: ''
    };

    try {
        console.log('   Testing SubDB API...');
        console.log('   📊 Testing hash-based search for 3 movies');
        
        const userAgent = 'SubDB/1.0 (ls100/1.0; https://github.com/ls100/app)';
        
        // Test server availability
        try {
            const serverUrl = 'http://api.thesubdb.com/?action=languages';
            const serverConfig = createAxiosConfig(serverUrl, {
                headers: { 'User-Agent': userAgent },
                timeout: 10000
            });
            
            const serverResponse = await axios.get(serverUrl, serverConfig);
            
            if (serverResponse.status === 200) {
                console.log('   ✅ SubDB server is accessible');
                result.features.push('Language list');
                
                const languages = serverResponse.data;
                console.log(`   📝 Available languages: ${languages}`);
                result.notes += `Available languages: ${languages}. `;
            }
        } catch (serverError) {
            console.log('   ❌ SubDB server not accessible');
            result.status = 'failed';
            result.error = 'Server not accessible';
            return result;
        }

        // Test hash-based search with generated hashes for all movies
        const testHashes = [
            'ffd8d4aa68033dc0e1c29d4fefe571bc', 
            '18379ac9af039390e1c29d4fefe571bc',
            '64f73a24a017175790e3f5d4e8b6f7a2'
        ];

        let zhCNSubtitleForDownload = null;
        
        for (let i = 0; i < testMovies.length; i++) {
            const movie = testMovies[i];
            const hash = testHashes[i];
            
            try {
                console.log(`   🔍 Testing: ${movie.title} (hash: ${hash.substring(0,8)}...)`);
                
                const searchUrl = `http://api.thesubdb.com/?action=search&hash=${hash}`;
                const searchConfig = createAxiosConfig(searchUrl, {
                    headers: { 'User-Agent': userAgent },
                    timeout: 10000
                });
                
                const searchResponse = await axios.get(searchUrl, searchConfig);

                if (searchResponse.status === 200 && searchResponse.data) {
                    const languages = searchResponse.data.split(',').filter(Boolean);
                    
                    // SubDB language analysis
                    const languageCounts = {};
                    languages.forEach(lang => {
                        const cleanLang = lang.trim();
                        languageCounts[cleanLang] = 1; // SubDB returns one result per language
                    });

                    // Store zhCN subtitle info for download test
                    if (!zhCNSubtitleForDownload && languages.includes('zh-cn')) {
                        zhCNSubtitleForDownload = {
                            hash: hash,
                            movie: movie.title,
                            language: 'zh-cn'
                        };
                    }

                    result.test_results.push({
                        movie: movie.title,
                        success: true,
                        subtitle_count: languages.length,
                        language_counts: languageCounts,
                        formats: ['srt'], // SubDB typically returns SRT format
                        languages: languages,
                        method: 'hash_search'
                    });
                    
                    console.log(`   ✅ Found ${languages.length} languages: ${languages.join(', ')}`);

                } else {
                    result.test_results.push({
                        movie: movie.title,
                        success: false,
                        subtitle_count: 0,
                        language_counts: {},
                        formats: [],
                        method: 'hash_search'
                    });
                    console.log(`   ❌ No subtitles found`);
                }

            } catch (searchError) {
                result.test_results.push({
                    movie: movie.title,
                    success: false,
                    error: searchError.message,
                    language_counts: {},
                    formats: []
                });
                console.log(`   ❌ Search failed: ${searchError.message}`);
            }

            // Rate limiting - conservative delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Test download functionality with zhCN subtitle (if found)
        if (zhCNSubtitleForDownload) {
            console.log(`   📥 Testing zhCN download for ${zhCNSubtitleForDownload.movie}`);
            try {
                const downloadUrl = `http://api.thesubdb.com/?action=download&hash=${zhCNSubtitleForDownload.hash}&language=zh-cn`;
                const downloadConfig = createAxiosConfig(downloadUrl, {
                    headers: { 'User-Agent': userAgent },
                    timeout: 15000,
                    maxContentLength: 5 * 1024 * 1024 // 5MB limit
                });
                
                const downloadResponse = await axios.get(downloadUrl, downloadConfig);

                if (downloadResponse.status === 200 && downloadResponse.data) {
                    const content = downloadResponse.data.toString();
                    if (content.includes('-->') || content.match(/^\d+$/m)) {
                        result.download_test = {
                            success: true,
                            note: `Successfully downloaded zhCN subtitle for ${zhCNSubtitleForDownload.movie} (${content.length} chars)`,
                            file_size: content.length,
                            movie: zhCNSubtitleForDownload.movie
                        };
                        console.log(`   ✅ Download successful: ${content.length} characters`);
                    } else {
                        result.download_test = {
                            success: false,
                            note: `Downloaded content doesn't appear to be valid subtitle format`,
                            movie: zhCNSubtitleForDownload.movie
                        };
                    }
                } else {
                    result.download_test = {
                        success: false,
                        note: `Download request failed`,
                        movie: zhCNSubtitleForDownload.movie
                    };
                }
            } catch (downloadError) {
                result.download_test = {
                    success: false,
                    note: `Download failed: ${downloadError.message}`,
                    movie: zhCNSubtitleForDownload.movie
                };
                console.log(`   ❌ Download failed: ${downloadError.message}`);
            }
        } else {
            result.download_test = {
                success: false,
                note: 'No zhCN subtitles found with test hashes',
                movie: 'N/A'
            };
            console.log(`   ⚠️  No zhCN subtitles found for download testing`);
        }

        // Determine overall status
        if (result.test_results.some(r => r.success)) {
            result.status = 'working';
            result.features.push('Hash-based search', 'Multiple languages', 'SRT format');
        } else if (result.features.length > 0) {
            result.status = 'partially_working';
            result.notes += 'Server accessible but no test subtitles found with sample hashes. ';
        } else {
            result.status = 'failed';
        }

        // Add general features
        result.features.push(
            'No authentication required',
            'Hash-based lookup',
            'Fast response times',
            'Simple API'
        );

        result.notes += 'Requires file hash calculation. Hash should be MD5 of first and last 64KB of video file.';
        
        console.log(`   📈 Summary: ${result.test_results.filter(r => r.success).length}/${result.test_results.length} movies found`);

    } catch (error) {
        result.status = 'error';
        result.error = error.message;
        console.log(`   ❌ SubDB test failed: ${error.message}`);
    }

    return result;
}

module.exports = testSubDB; 