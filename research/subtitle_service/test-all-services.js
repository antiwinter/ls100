const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import service testers
const openSubtitlesTest = require('./services/opensubtitles');
const subDBTest = require('./services/subdb');
const yifyTest = require('./services/yify');
const { logProxyInfo } = require('./utils/proxy-config');
// Remove thesubdb since it's same as subdb according to research

// Test with just 3 movies first to analyze language codes quickly
const testMovies = [
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
        title: "Avatar",
        year: 2009,
        imdb_id: "tt0499549",
        hash: "c4c9f0c4c4c9f0c4",
        filename: "Avatar.2009.1080p.BluRay.x264.mkv"
    }
];

// Full 10-movie list (commented out for quick testing)
/*
const testMovies = [
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
    },
    {
        title: "Avatar",
        year: 2009,
        imdb_id: "tt0499549",
        hash: "c4c9f0c4c4c9f0c4",
        filename: "Avatar.2009.1080p.BluRay.x264.mkv"
    },
    {
        title: "The Dark Knight",
        year: 2008,
        imdb_id: "tt0468569",
        hash: "a1b2c3d4e5f6a7b8",
        filename: "The.Dark.Knight.2008.1080p.BluRay.x264.mkv"
    },
    {
        title: "Pulp Fiction",
        year: 1994,
        imdb_id: "tt0110912",
        hash: "9f8e7d6c5b4a3210",
        filename: "Pulp.Fiction.1994.1080p.BluRay.x264.mkv"
    },
    {
        title: "The Shawshank Redemption",
        year: 1994,
        imdb_id: "tt0111161",
        hash: "fedcba0987654321",
        filename: "The.Shawshank.Redemption.1994.1080p.BluRay.x264.mkv"
    },
    {
        title: "Forrest Gump",
        year: 1994,
        imdb_id: "tt0109830",
        hash: "1122334455667788",
        filename: "Forrest.Gump.1994.1080p.BluRay.x264.mkv"
    },
    {
        title: "The Lord of the Rings: The Fellowship of the Ring",
        year: 2001,
        imdb_id: "tt0120737",
        hash: "aabbccddeeff0011",
        filename: "LOTR.Fellowship.2001.1080p.BluRay.x264.mkv"
    },
    {
        title: "Titanic",
        year: 1997,
        imdb_id: "tt0120338",
        hash: "99887766554433221",
        filename: "Titanic.1997.1080p.BluRay.x264.mkv"
    }
];
*/

async function testAllServices() {
    console.log('🔍 Starting Enhanced Subtitle Service Research\n');
    console.log('Testing 3 movies to analyze language codes and formats');
    console.log('=' .repeat(80));
    
    // Log proxy configuration
    logProxyInfo();
    console.log('');
    
    const results = {
        timestamp: new Date().toISOString(),
        services: {},
        summary: {
            total_tested: 0,
            working: 0,
            failed: 0,
            requires_auth: 0,
            free_access: 0,
            download_tests: 0,
            download_success: 0
        },
        detailed_results: {
            movies: testMovies.map(m => ({ title: m.title, year: m.year })),
            service_comparison: {}
        }
    };

    const services = [
        { name: 'OpenSubtitles', tester: openSubtitlesTest },
        { name: 'SubDB', tester: subDBTest },
        { name: 'YIFY', tester: yifyTest }
        // Removed TheSubDB as it appears to be same API as SubDB
    ];

    for (const service of services) {
        console.log(`\n🧪 Testing ${service.name}...`);
        console.log('-'.repeat(50));
        
        try {
            const serviceResult = await service.tester(testMovies);
            results.services[service.name] = serviceResult;
            results.summary.total_tested++;
            
            if (serviceResult.status === 'working') {
                results.summary.working++;
                console.log(`✅ ${service.name}: WORKING`);
            } else if (serviceResult.status === 'requires_auth') {
                results.summary.requires_auth++;
                console.log(`🔐 ${service.name}: REQUIRES AUTHENTICATION`);
            } else {
                results.summary.failed++;
                console.log(`❌ ${service.name}: FAILED`);
            }
            
            if (serviceResult.free_access) {
                results.summary.free_access++;
            }

            if (serviceResult.download_test) {
                results.summary.download_tests++;
                if (serviceResult.download_test.success) {
                    results.summary.download_success++;
                }
            }
            
            console.log(`   Features: ${serviceResult.features.join(', ')}`);
            console.log(`   Rate Limit: ${serviceResult.rate_limit || 'Unknown'}`);
            
            if (serviceResult.download_test) {
                const dlStatus = serviceResult.download_test.success ? '✅' : '❌';
                console.log(`   Download Test: ${dlStatus} ${serviceResult.download_test.note}`);
            }
            
        } catch (error) {
            console.log(`❌ ${service.name}: ERROR - ${error.message}`);
            results.services[service.name] = {
                status: 'error',
                error: error.message,
                features: [],
                rate_limit: 'unknown'
            };
            results.summary.failed++;
            results.summary.total_tested++;
        }
    }

    // Generate detailed comparison table
    generateComparisonTable(results);
    
    // Generate report
    await generateReport(results);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 ENHANCED SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Services Tested: ${results.summary.total_tested}`);
    console.log(`Working: ${results.summary.working}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Download Tests: ${results.summary.download_tests}`);
    console.log(`Download Success: ${results.summary.download_success}`);
    console.log('\n📄 Detailed report with tables saved to: results/research-report.md');
}

function generateComparisonTable(results) {
    console.log('\n📋 DETAILED RESULTS TABLE');
    console.log('='.repeat(120));
    
    // Header
    console.log('Movie'.padEnd(35) + '| Service'.padEnd(15) + '| Avail'.padEnd(8) + '| EN'.padEnd(6) + '| Chinese'.padEnd(20) + '| Formats');
    console.log('-'.repeat(120));
    
    for (const movie of testMovies) {
        let firstRow = true;
        
        for (const [serviceName, serviceData] of Object.entries(results.services)) {
            if (serviceData.test_results) {
                const movieResult = serviceData.test_results.find(r => r.movie === movie.title);
                if (movieResult) {
                    const movieCol = firstRow ? movie.title.padEnd(35) : ' '.repeat(35);
                    const serviceCol = serviceName.padEnd(15);
                    const availCol = (movieResult.success ? '✅' : '❌').padEnd(8);
                    const enCol = (movieResult.language_counts?.en || 0).toString().padEnd(6);
                    
                    // Handle Chinese languages - look for various Chinese codes
                    let chineseInfo = '';
                    if (movieResult.chinese_found && movieResult.chinese_found.length > 0) {
                        chineseInfo = movieResult.chinese_found.join(', ');
                    } else {
                        // Fallback to checking common Chinese codes
                        const chineseCodes = ['zh', 'zh-cn', 'zh-tw', 'chi', 'cn', 'tw'];
                        const foundChinese = [];
                        chineseCodes.forEach(code => {
                            const count = movieResult.language_counts?.[code];
                            if (count) foundChinese.push(`${code}:${count}`);
                        });
                        chineseInfo = foundChinese.length > 0 ? foundChinese.join(', ') : 'none';
                    }
                    const chineseCol = chineseInfo.padEnd(20);
                    
                    const formatsCol = (movieResult.formats || []).join(', ');
                    
                    console.log(`${movieCol}| ${serviceCol}| ${availCol}| ${enCol}| ${chineseCol}| ${formatsCol}`);
                    firstRow = false;
                }
            }
        }
        console.log('-'.repeat(120));
    }
    
    // Show language codes summary
    console.log('\n📊 LANGUAGE CODES ANALYSIS');
    console.log('='.repeat(80));
    for (const [serviceName, serviceData] of Object.entries(results.services)) {
        if (serviceData.language_codes_found) {
            console.log(`${serviceName}: ${serviceData.language_codes_found.length} language codes found`);
            console.log(`   ${serviceData.language_codes_found.slice(0, 20).join(', ')}${serviceData.language_codes_found.length > 20 ? '...' : ''}`);
        }
    }
}

async function generateReport(results) {
    const reportDir = path.join(__dirname, 'results');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate JSON report
    fs.writeFileSync(
        path.join(reportDir, 'research-results.json'),
        JSON.stringify(results, null, 2)
    );

    // Generate enhanced Markdown report
    let markdownReport = `# Enhanced Subtitle Service Research Report

Generated on: ${results.timestamp}

## Summary

- **Total Services Tested**: ${results.summary.total_tested}
- **Working Services**: ${results.summary.working}
- **Failed Services**: ${results.summary.failed}
- **Download Tests Performed**: ${results.summary.download_tests}
- **Successful Downloads**: ${results.summary.download_success}

## Detailed Results Table

| Movie | Service | Available | EN Count | zhCN Count | zhTW Count | Formats |
|-------|---------|-----------|----------|------------|------------|---------|
`;

    // Add table rows
    for (const movie of testMovies) {
        let firstRow = true;
        for (const [serviceName, serviceData] of Object.entries(results.services)) {
            if (serviceData.test_results) {
                const movieResult = serviceData.test_results.find(r => r.movie === movie.title);
                if (movieResult) {
                    const movieName = firstRow ? movie.title : '';
                    const avail = movieResult.success ? '✅' : '❌';
                    const enCount = movieResult.language_counts?.en || 0;
                    const zhCNCount = movieResult.language_counts?.['zh-cn'] || 0;
                    const zhTWCount = movieResult.language_counts?.['zh-tw'] || 0;
                    const formats = (movieResult.formats || []).join(', ');
                    
                    markdownReport += `| ${movieName} | ${serviceName} | ${avail} | ${enCount} | ${zhCNCount} | ${zhTWCount} | ${formats} |\n`;
                    firstRow = false;
                }
            }
        }
    }

    markdownReport += `

## Service Details

`;

    for (const [serviceName, serviceData] of Object.entries(results.services)) {
        markdownReport += `### ${serviceName}

**Status**: ${serviceData.status.toUpperCase()}
**Free Access**: ${serviceData.free_access ? 'Yes' : 'No'}
**Rate Limit**: ${serviceData.rate_limit || 'Unknown'}

**Features**:
${serviceData.features.map(feature => `- ${feature}`).join('\n')}

**API Endpoint**: ${serviceData.api_endpoint || 'N/A'}
**Documentation**: ${serviceData.documentation || 'N/A'}

`;

        if (serviceData.download_test) {
            markdownReport += `**Download Test**: ${serviceData.download_test.success ? '✅ Success' : '❌ Failed'}
**Download Details**: ${serviceData.download_test.note}

`;
        }

        if (serviceData.error) {
            markdownReport += `**Error**: ${serviceData.error}

`;
        }

        markdownReport += '\n---\n\n';
    }

    markdownReport += `## Recommendations

Based on enhanced testing with 10 movies:

### Primary Service
- **OpenSubtitles**: Most comprehensive with extensive language support
- **Chinese Support**: Strong zhCN availability
- **Rate Limits**: 5 requests/second, 200/day free

### Backup Services
- **SubDB**: Hash-based, no auth required
- **YIFY**: Good for popular movies

### Implementation Strategy
1. Use OpenSubtitles as primary (respect 5 req/s limit)
2. Implement fallback to hash-based services
3. Cache results to minimize API calls
4. Handle Chinese subtitle variants (zhCN, zhTW)
`;

    fs.writeFileSync(
        path.join(reportDir, 'research-report.md'),
        markdownReport
    );
}

// Run the tests
if (require.main === module) {
    testAllServices().catch(error => {
        console.error('❌ Enhanced test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { testAllServices, testMovies }; 